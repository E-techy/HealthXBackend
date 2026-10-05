const crypto = require('crypto');
const { customAlphabet } = require('nanoid');
const jwt = require('jsonwebtoken');
const EmergencySession = require('../models/EmergencySession');
const UserAuth = require('../models/UserAuth');
const { sendEmail } = require('../utils/emailService');

const alphabet = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generateTrackingPart = customAlphabet(alphabet, 4);

/**
 * Generate a JWT token specifically scoped to an emergency session
 */
const generateEmergencySessionToken = (emergencyTrackingId, role = 'VIEWER', userId = null) => {
    return jwt.sign(
        { emergencyTrackingId, role, userId },
        process.env.JWT_SECRET || 'healthx_emergency_secret_key',
        { expiresIn: '24h' }
    );
};

/**
 * Check Access Control List
 */
const checkUserAccess = (emergency, requestingUserId) => {
    // If allowedUsers is empty, it's public (open to anyone with link/password)
    if (!emergency.allowedUsers || emergency.allowedUsers.length === 0) return true;

    if (!requestingUserId) return false; // Guest trying to access a restricted emergency

    const isCreator = emergency.createdBy.toString() === requestingUserId.toString();
    const isAllowed = emergency.allowedUsers.some(id => id.toString() === requestingUserId.toString());

    return isCreator || isAllowed;
};

// ------------------------------------------------------------------
// OWNER ACTIONS (Requires creator rights)
// ------------------------------------------------------------------

const createEmergency = async ({ title, description, password, userId, baseUrl }) => {
    const trackingId = `EM-${generateTrackingPart()}-${generateTrackingPart()}`;
    const magicAuthKey = crypto.randomBytes(24).toString('hex');

    const emergency = new EmergencySession({
        emergencyTrackingId: trackingId,
        title,
        description,
        passcodeHash: password ? password : null,
        authKey: magicAuthKey,
        createdBy: userId,
        allowedUsers: [] // Empty by default
    });

    await emergency.save();

    const hostUrl = baseUrl || 'http://localhost:5001';
    const shareableLink = `${hostUrl}/emergency/join?trackingId=${trackingId}&authKey=${magicAuthKey}`;

    return {
        emergencyTrackingId: emergency.emergencyTrackingId,
        title: emergency.title,
        status: emergency.status,
        isPasswordProtected: emergency.isPasswordProtected,
        authKey: emergency.authKey,
        shareableLink,
        sessionToken: generateEmergencySessionToken(emergency.emergencyTrackingId, 'ADMIN', userId)
    };
};

const updateEmergencyDetails = async (trackingId, ownerId, { title, description }) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() });
    if (!emergency) throw new Error('Emergency session not found.');
    if (emergency.createdBy.toString() !== ownerId.toString()) throw new Error('Unauthorized: Only the creator can update details.');

    if (title) emergency.title = title;
    if (description !== undefined) emergency.description = description;

    await emergency.save();
    return emergency;
};

const updateEmergencyStatus = async (trackingId, ownerId, status) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() });
    if (!emergency) throw new Error('Emergency session not found.');
    if (emergency.createdBy.toString() !== ownerId.toString()) throw new Error('Unauthorized: Only the creator can change status.');

    if (!['ACTIVE', 'PAUSED', 'RESOLVED'].includes(status)) throw new Error('Invalid status.');

    emergency.status = status;
    await emergency.save();
    return emergency;
};

const deleteEmergency = async (trackingId, ownerId) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() });
    if (!emergency) throw new Error('Emergency session not found.');
    if (emergency.createdBy.toString() !== ownerId.toString()) throw new Error('Unauthorized: Only the creator can delete this session.');

    await emergency.deleteOne();
    return { success: true };
};

const inviteUsers = async (trackingId, ownerId, userIdsToInvite, baseUrl) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() });
    if (!emergency) throw new Error('Emergency session not found.');
    if (emergency.createdBy.toString() !== ownerId.toString()) throw new Error('Unauthorized: Only the creator can invite users.');

    // Find valid users
    const users = await UserAuth.find({ _id: { $in: userIdsToInvite } });
    if (!users.length) throw new Error('No valid users found from provided IDs.');

    // Add to allowed list (avoid duplicates)
    users.forEach(user => {
        if (!emergency.allowedUsers.includes(user._id)) {
            emergency.allowedUsers.push(user._id);
        }
    });
    
    await emergency.save();

    const hostUrl = baseUrl || 'http://localhost:5001';
    const shareableLink = `${hostUrl}/emergency/join?trackingId=${trackingId}&authKey=${emergency.authKey}`;

    // Send Emails
    const emailPromises = users.map(user => {
        const subject = `HealthX Emergency Alert: ${emergency.title}`;
        const body = `
            You have been assigned to an emergency response team.\n
            Incident: ${emergency.title}
            Tracking ID: ${trackingId}\n
            Access Link (Magic Auth): ${shareableLink}\n
            If prompted for credentials on manual login, use the tracking ID provided by dispatch.
        `;
        return sendEmail(user.email, subject, body).catch(e => console.error(`Failed to send email to ${user.email}`, e));
    });

    await Promise.all(emailPromises);

    return { invitedCount: users.length, updatedAllowedUsers: emergency.allowedUsers };
};

// ------------------------------------------------------------------
// PARTICIPANT ACTIONS (Join & View)
// ------------------------------------------------------------------

const authenticateViaAuthKey = async (emergencyTrackingId, authKey, requestingUserId = null) => {
    const emergency = await EmergencySession.findOne({
        emergencyTrackingId: emergencyTrackingId.toUpperCase(),
        authKey: authKey,
        status: 'ACTIVE'
    });

    if (!emergency) throw new Error('Invalid tracking ID, expired link, or session is closed.');
    if (!checkUserAccess(emergency, requestingUserId)) throw new Error('Access denied. You are not on the permitted responder list.');

    const isOwner = requestingUserId && emergency.createdBy.toString() === requestingUserId.toString();
    
    return {
        emergencyTrackingId: emergency.emergencyTrackingId,
        title: emergency.title,
        token: generateEmergencySessionToken(emergency.emergencyTrackingId, isOwner ? 'ADMIN' : 'PARTICIPANT', requestingUserId)
    };
};

const authenticateViaCredentials = async (emergencyTrackingId, password, requestingUserId = null) => {
    const emergency = await EmergencySession.findOne({
        emergencyTrackingId: emergencyTrackingId.toUpperCase(),
        status: 'ACTIVE'
    });

    if (!emergency) throw new Error('Emergency session not found or resolved.');
    if (!checkUserAccess(emergency, requestingUserId)) throw new Error('Access denied. You are not on the permitted responder list.');

    if (emergency.isPasswordProtected) {
        if (!password) throw new Error('Passcode required for this emergency session.');
        const isMatch = await emergency.comparePasscode(password);
        if (!isMatch) throw new Error('Invalid passcode.');
    }

    const isOwner = requestingUserId && emergency.createdBy.toString() === requestingUserId.toString();

    return {
        emergencyTrackingId: emergency.emergencyTrackingId,
        title: emergency.title,
        token: generateEmergencySessionToken(emergency.emergencyTrackingId, isOwner ? 'ADMIN' : 'PARTICIPANT', requestingUserId)
    };
};

const getEmergencyPublicInfo = async (emergencyTrackingId) => {
    const emergency = await EmergencySession.findOne(
        { emergencyTrackingId: emergencyTrackingId.toUpperCase() },
        'emergencyTrackingId title description status isPasswordProtected createdAt createdBy allowedUsers'
    );

    if (!emergency) throw new Error('Emergency session not found.');
    return emergency;
};

module.exports = {
    createEmergency,
    updateEmergencyDetails,
    updateEmergencyStatus,
    deleteEmergency,
    inviteUsers,
    authenticateViaAuthKey,
    authenticateViaCredentials,
    getEmergencyPublicInfo
};
