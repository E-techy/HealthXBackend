const crypto = require('crypto');
const { customAlphabet } = require('nanoid');
const jwt = require('jsonwebtoken');
const EmergencySession = require('../models/EmergencySession');
const UserAuth = require('../models/UserAuth');
const { sendEmail } = require('../utils/emailService');

const alphabet = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generateTrackingPart = customAlphabet(alphabet, 4);

const generateEmergencySessionToken = (emergencyTrackingId, role = 'VIEWER', userId = null) => {
    return jwt.sign(
        { emergencyTrackingId, role, userId },
        process.env.JWT_SECRET || 'healthx_emergency_secret_key',
        { expiresIn: '24h' }
    );
};

const checkUserAccess = (emergency, requestingUserId) => {
    if (!emergency.allowedUsers || emergency.allowedUsers.length === 0) return true;
    if (!requestingUserId) return false; 
    const isCreator = emergency.createdBy.toString() === requestingUserId.toString();
    const isAllowed = emergency.allowedUsers.some(id => id.toString() === requestingUserId.toString());
    return isCreator || isAllowed;
};

// ------------------------------------------------------------------
// OWNER ACTIONS
// ------------------------------------------------------------------

const createEmergency = async ({ title, description, password, userId, baseUrl, isPublicVisibility, location, address, victimMetadata }) => {
    const trackingId = `EM-${generateTrackingPart()}-${generateTrackingPart()}`;
    const magicAuthKey = crypto.randomBytes(24).toString('hex');

    const emergencyData = {
        emergencyTrackingId: trackingId,
        title,
        description,
        passcodeHash: password ? password : null,
        authKey: magicAuthKey,
        createdBy: userId,
        allowedUsers: [],
        isPublicVisibility: isPublicVisibility || false
    };

    if (location && location.lng && location.lat) {
        emergencyData.location = { type: 'Point', coordinates: [location.lng, location.lat] };
    }
    if (address) emergencyData.address = address;
    if (victimMetadata) emergencyData.victimMetadata = victimMetadata;

    const emergency = new EmergencySession(emergencyData);
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

const updateEmergencyDetails = async (trackingId, ownerId, updates) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() });
    if (!emergency) throw new Error('Emergency session not found.');
    if (emergency.createdBy.toString() !== ownerId.toString()) throw new Error('Unauthorized: Only the creator can update details.');

    // Standard updates
    if (updates.title) emergency.title = updates.title;
    if (updates.description !== undefined) emergency.description = updates.description;
    if (updates.isPublicVisibility !== undefined) emergency.isPublicVisibility = updates.isPublicVisibility;
    
    // Geospatial updates
    if (updates.location && updates.location.lng && updates.location.lat) {
        emergency.location = { type: 'Point', coordinates: [updates.location.lng, updates.location.lat] };
    }
    // Address updates
    if (updates.address) {
        emergency.address = { ...emergency.address, ...updates.address };
    }
    // Victim updates
    if (updates.victimMetadata) {
        emergency.victimMetadata = { ...emergency.victimMetadata, ...updates.victimMetadata };
    }

    await emergency.save();
    return emergency;
};

const updateEmergencyStatus = async (trackingId, ownerId, status) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() });
    if (!emergency) throw new Error('Emergency session not found.');
    if (emergency.createdBy.toString() !== ownerId.toString()) throw new Error('Unauthorized.');
    if (!['ACTIVE', 'PAUSED', 'RESOLVED'].includes(status)) throw new Error('Invalid status.');

    emergency.status = status;
    await emergency.save();
    return emergency;
};

const deleteEmergency = async (trackingId, ownerId) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() });
    if (!emergency) throw new Error('Emergency session not found.');
    if (emergency.createdBy.toString() !== ownerId.toString()) throw new Error('Unauthorized.');

    await emergency.deleteOne();
    return { success: true };
};

const inviteUsers = async (trackingId, ownerId, userIdsToInvite, baseUrl) => {
    // ... [existing invite logic remains completely unchanged] ...
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() });
    if (!emergency) throw new Error('Emergency session not found.');
    if (emergency.createdBy.toString() !== ownerId.toString()) throw new Error('Unauthorized.');

    const users = await UserAuth.find({ _id: { $in: userIdsToInvite } });
    if (!users.length) throw new Error('No valid users found.');

    users.forEach(user => {
        if (!emergency.allowedUsers.includes(user._id)) emergency.allowedUsers.push(user._id);
    });
    
    await emergency.save();
    const hostUrl = baseUrl || 'http://localhost:5001';
    const shareableLink = `${hostUrl}/emergency/join?trackingId=${trackingId}&authKey=${emergency.authKey}`;

    const emailPromises = users.map(user => {
        const subject = `HealthX Emergency Alert: ${emergency.title}`;
        const body = `Incident: ${emergency.title}\nTracking ID: ${trackingId}\nLink: ${shareableLink}`;
        return sendEmail(user.email, subject, body).catch(e => console.error(e));
    });

    await Promise.all(emailPromises);
    return { invitedCount: users.length, updatedAllowedUsers: emergency.allowedUsers };
};

// ------------------------------------------------------------------
// PUBLIC DISCOVERY (Search Engine)
// ------------------------------------------------------------------

const searchPublicEmergencies = async (filters) => {
    const query = { isPublicVisibility: true, status: 'ACTIVE' }; // Base filter

    // 1. Geospatial Radius Search
    if (filters.lng && filters.lat && filters.radiusKm) {
        query.location = {
            $near: {$geometry: { type: "Point", coordinates: [parseFloat(filters.lng), parseFloat(filters.lat)] },
                $maxDistance: parseFloat(filters.radiusKm) * 1000 // Convert km to meters
            }
        };
    }

    // 2. Exact Match Filters (State, City, Country)
    if (filters.state) query['address.state'] = { $regex: new RegExp(`^${filters.state}$`, 'i') };
    if (filters.city) query['address.city'] = { $regex: new RegExp(`^${filters.city}$`, 'i') };
    if (filters.country) query['address.country'] = { $regex: new RegExp(`^${filters.country}$`, 'i') };

    // 3. Time Filter (Started after a certain date)
    if (filters.startDate) {
        query.createdAt = { $gte: new Date(filters.startDate) };
    }

    // Fetch the data, excluding secure fields
    let emergencies = await EmergencySession.find(query)
        .select('emergencyTrackingId title description status isPasswordProtected location address victimMetadata createdAt')
        .sort({ createdAt: -1 })
        .limit(parseInt(filters.limit) || 50)
        .lean(); // Use lean() for faster read and easy object manipulation

    // 4. Sanitize Victim Data (Hide if victimMetadata.isPublic is false)
    emergencies = emergencies.map(em => {
        if (em.victimMetadata && !em.victimMetadata.isPublic) {
            delete em.victimMetadata; 
        }
        return em;
    });

    return emergencies;
};

// ------------------------------------------------------------------
// PARTICIPANT ACTIONS
// ------------------------------------------------------------------

const authenticateViaAuthKey = async (emergencyTrackingId, authKey, requestingUserId = null) => {
    // ... [existing logic unchanged] ...
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: emergencyTrackingId.toUpperCase(), authKey: authKey, status: 'ACTIVE' });
    if (!emergency) throw new Error('Invalid tracking ID or closed session.');
    if (!checkUserAccess(emergency, requestingUserId)) throw new Error('Access denied.');

    const isOwner = requestingUserId && emergency.createdBy.toString() === requestingUserId.toString();
    return { emergencyTrackingId: emergency.emergencyTrackingId, title: emergency.title, token: generateEmergencySessionToken(emergency.emergencyTrackingId, isOwner ? 'ADMIN' : 'PARTICIPANT', requestingUserId) };
};

const authenticateViaCredentials = async (emergencyTrackingId, password, requestingUserId = null) => {
    // ... [existing logic unchanged] ...
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: emergencyTrackingId.toUpperCase(), status: 'ACTIVE' });
    if (!emergency) throw new Error('Session not found.');
    if (!checkUserAccess(emergency, requestingUserId)) throw new Error('Access denied.');

    if (emergency.isPasswordProtected) {
        if (!password) throw new Error('Passcode required.');
        if (!(await emergency.comparePasscode(password))) throw new Error('Invalid passcode.');
    }

    const isOwner = requestingUserId && emergency.createdBy.toString() === requestingUserId.toString();
    return { emergencyTrackingId: emergency.emergencyTrackingId, title: emergency.title, token: generateEmergencySessionToken(emergency.emergencyTrackingId, isOwner ? 'ADMIN' : 'PARTICIPANT', requestingUserId) };
};

const getEmergencyPublicInfo = async (emergencyTrackingId) => {
    const emergency = await EmergencySession.findOne(
        { emergencyTrackingId: emergencyTrackingId.toUpperCase() },
        'emergencyTrackingId title description status isPasswordProtected isPublicVisibility address location victimMetadata createdAt'
    ).lean();

    if (!emergency) throw new Error('Emergency session not found.');
    
    // Protect victim privacy on direct info fetch too
    if (emergency.victimMetadata && !emergency.victimMetadata.isPublic) {
        delete emergency.victimMetadata;
    }

    return emergency;
};

module.exports = {
    createEmergency,
    updateEmergencyDetails,
    updateEmergencyStatus,
    deleteEmergency,
    inviteUsers,
    searchPublicEmergencies,
    authenticateViaAuthKey,
    authenticateViaCredentials,
    getEmergencyPublicInfo
};
