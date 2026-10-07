const crypto = require('crypto');
const { customAlphabet } = require('nanoid');
const jwt = require('jsonwebtoken');
const EmergencySession = require('../models/EmergencySession');
const UserAuth = require('../models/UserAuth');
const { sendEmail } = require('../utils/emailService');

const alphabet = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generateTrackingPart = customAlphabet(alphabet, 4);

const generateEmergencySessionToken = (emergencyTrackingId, role = 'VIEWER', userId = null) => {
    return jwt.sign({ emergencyTrackingId, role, userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
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

const createEmergency = async ({ title, description, password, userId, baseUrl, isPublicVisibility, location, address, victims, culprits, detailedDocUri }) => {
    const trackingId = `EM-${generateTrackingPart()}-${generateTrackingPart()}`;
    const magicAuthKey = crypto.randomBytes(24).toString('hex');

    const emergencyData = {
        emergencyTrackingId: trackingId,
        title,
        description,
        passcodeHash: password || null,
        authKey: magicAuthKey,
        createdBy: userId,
        allowedUsers: [],
        isPublicVisibility: isPublicVisibility || false,
        detailedDocUri: detailedDocUri || null
    };

    if (location && location.lng && location.lat) {
        emergencyData.location = { type: 'Point', coordinates: [location.lng, location.lat] };
    }
    if (address) emergencyData.address = address;
    if (victims && Array.isArray(victims)) emergencyData.victims = victims;
    if (culprits && Array.isArray(culprits)) emergencyData.culprits = culprits;

    const emergency = new EmergencySession(emergencyData);
    await emergency.save();

    const hostUrl = baseUrl || 'http://localhost:5001';
    return {
        emergencyTrackingId: emergency.emergencyTrackingId,
        title: emergency.title,
        status: emergency.status,
        shareableLink: `${hostUrl}/emergency/join?trackingId=${trackingId}&authKey=${magicAuthKey}`,
        sessionToken: generateEmergencySessionToken(emergency.emergencyTrackingId, 'ADMIN', userId)
    };
};

const updateEmergencyDetails = async (trackingId, ownerId, updates) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() });
    if (!emergency) throw new Error('Emergency session not found.');
    if (emergency.createdBy.toString() !== ownerId.toString()) throw new Error('Unauthorized.');

    if (updates.title) emergency.title = updates.title;
    if (updates.description !== undefined) emergency.description = updates.description;
    if (updates.isPublicVisibility !== undefined) emergency.isPublicVisibility = updates.isPublicVisibility;
    if (updates.detailedDocUri !== undefined) emergency.detailedDocUri = updates.detailedDocUri;
    
    if (updates.location && updates.location.lng && updates.location.lat) {
        emergency.location = { type: 'Point', coordinates: [updates.location.lng, updates.location.lat] };
    }
    if (updates.address) emergency.address = { ...emergency.address, ...updates.address };
    
    // Completely replace arrays if provided
    if (updates.victims) emergency.victims = updates.victims;
    if (updates.culprits) emergency.culprits = updates.culprits;

    await emergency.save();
    return emergency;
};

// --- NEW: LIST MY EMERGENCIES ---
const getUserEmergencies = async (userId, filters) => {
    const query = { createdBy: userId };

    if (filters.status) query.status = filters.status.toUpperCase();
    if (filters.startDate) query.createdAt = { $gte: new Date(filters.startDate) };

    const emergencies = await EmergencySession.find(query)
        .select('-passcodeHash -authKey') // Hide ultra-sensitive keys
        .sort({ createdAt: -1 })
        .lean();

    return emergencies;
};

const updateEmergencyStatus = async (trackingId, ownerId, status) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() });
    if (!emergency || emergency.createdBy.toString() !== ownerId.toString()) throw new Error('Unauthorized.');
    emergency.status = status;
    await emergency.save();
    return emergency;
};

const deleteEmergency = async (trackingId, ownerId) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() });
    if (!emergency || emergency.createdBy.toString() !== ownerId.toString()) throw new Error('Unauthorized.');
    await emergency.deleteOne();
    return { success: true };
};

const inviteUsers = async (trackingId, ownerId, userIdsToInvite, baseUrl) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() });
    if (!emergency || emergency.createdBy.toString() !== ownerId.toString()) throw new Error('Unauthorized.');

    const users = await UserAuth.find({ _id: { $in: userIdsToInvite } });
    users.forEach(user => {
        if (!emergency.allowedUsers.includes(user._id)) emergency.allowedUsers.push(user._id);
    });
    
    await emergency.save();
    return { invitedCount: users.length };
};

// ------------------------------------------------------------------
// PUBLIC DISCOVERY
// ------------------------------------------------------------------

const searchPublicEmergencies = async (filters) => {
    const query = { isPublicVisibility: true, status: 'ACTIVE' };

    if (filters.lng && filters.lat && filters.radiusKm) {
        query.location = {
            $near: {$geometry: { type: "Point", coordinates: [parseFloat(filters.lng), parseFloat(filters.lat)] },
                $maxDistance: parseFloat(filters.radiusKm) * 1000
            }
        };
    }

    if (filters.state) query['address.state'] = { $regex: new RegExp(`^${filters.state}$`, 'i') };
    if (filters.city) query['address.city'] = { $regex: new RegExp(`^${filters.city}$`, 'i') };
    if (filters.country) query['address.country'] = { $regex: new RegExp(`^${filters.country}$`, 'i') };
    if (filters.startDate) query.createdAt = { $gte: new Date(filters.startDate) };

    let emergencies = await EmergencySession.find(query)
        .select('-passcodeHash -authKey -allowedUsers')
        .sort({ createdAt: -1 })
        .limit(parseInt(filters.limit) || 50)
        .lean();

    // Sanitize Victims and Culprits for Public
    emergencies = emergencies.map(em => {
        if (em.victims) em.victims = em.victims.filter(v => v.isPublic);
        if (em.culprits) em.culprits = em.culprits.filter(c => c.isPublic);
        
        // Hide detailed doc if not public
        if (!em.isPublicVisibility) em.detailedDocUri = null;
        return em;
    });

    return emergencies;
};

// ------------------------------------------------------------------
// PARTICIPANT ACTIONS (Join & Get Info)
// ------------------------------------------------------------------

const authenticateViaAuthKey = async (trackingId, authKey, requestingUserId = null) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase(), authKey, status: 'ACTIVE' });
    if (!emergency || !checkUserAccess(emergency, requestingUserId)) throw new Error('Access denied.');
    const isOwner = requestingUserId && emergency.createdBy.toString() === requestingUserId.toString();
    return { trackingId, token: generateEmergencySessionToken(trackingId, isOwner ? 'ADMIN' : 'PARTICIPANT', requestingUserId) };
};

const authenticateViaCredentials = async (trackingId, password, requestingUserId = null) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase(), status: 'ACTIVE' });
    if (!emergency || !checkUserAccess(emergency, requestingUserId)) throw new Error('Access denied.');
    
    if (emergency.isPasswordProtected) {
        if (!(await emergency.comparePasscode(password))) throw new Error('Invalid passcode.');
    }
    const isOwner = requestingUserId && emergency.createdBy.toString() === requestingUserId.toString();
    return { title: emergency.title, token: generateEmergencySessionToken(trackingId, isOwner ? 'ADMIN' : 'PARTICIPANT', requestingUserId) };
};

const getEmergencyPublicInfo = async (trackingId, requestingUserId = null) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() }).lean();
    if (!emergency) throw new Error('Emergency not found.');

    const isAuthorized = checkUserAccess(emergency, requestingUserId);

    // If public OR user is authorized, show arrays (filtered by public flag if just a random guest)
    if (emergency.victims && !isAuthorized) emergency.victims = emergency.victims.filter(v => v.isPublic);
    if (emergency.culprits && !isAuthorized) emergency.culprits = emergency.culprits.filter(c => c.isPublic);

    // Nullify document link if private and user isn't authorized
    if (!emergency.isPublicVisibility && !isAuthorized) emergency.detailedDocUri = null;

    delete emergency.passcodeHash;
    delete emergency.authKey;

    return emergency;
};

// --- NEW: VALIDATE DOC DOWNLOAD ACCESS ---
const validateDocumentAccess = async (trackingId, requestingUserId) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: trackingId.toUpperCase() });
    if (!emergency) throw new Error('Emergency not found.');
    if (!emergency.detailedDocUri) throw new Error('No document attached.');

    // If emergency is strictly private and user isn't allowed
    if (!emergency.isPublicVisibility && !checkUserAccess(emergency, requestingUserId)) {
        throw new Error('Access denied. You do not have permission to view this document.');
    }
    
    return emergency.detailedDocUri;
};

module.exports = {
    createEmergency,
    updateEmergencyDetails,
    updateEmergencyStatus,
    deleteEmergency,
    inviteUsers,
    searchPublicEmergencies,
    getUserEmergencies,
    authenticateViaAuthKey,
    authenticateViaCredentials,
    getEmergencyPublicInfo,
    validateDocumentAccess
};
