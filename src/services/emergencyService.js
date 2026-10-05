const crypto = require('crypto');
const { customAlphabet } = require('nanoid');
const jwt = require('jsonwebtoken');
const EmergencySession = require('../models/EmergencySession');

// Human-friendly short tracking ID (e.g. EM-7K8P-2N4Q)
const alphabet = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generateTrackingPart = customAlphabet(alphabet, 4);

/**
 * Generate a JWT token specifically scoped to an emergency session
 */
const generateEmergencySessionToken = (emergencyTrackingId, role = 'VIEWER') => {
    return jwt.sign(
        { emergencyTrackingId, role },
        process.env.JWT_SECRET || 'healthx_emergency_secret_key',
        { expiresIn: '24h' }
    );
};

/**
 * Create a new emergency incident session
 */
const createEmergency = async ({ title, description, password, userId, baseUrl }) => {
    const trackingId = `EM-${generateTrackingPart()}-${generateTrackingPart()}`;
    const magicAuthKey = crypto.randomBytes(24).toString('hex');

    const emergency = new EmergencySession({
        emergencyTrackingId: trackingId,
        title,
        description,
        passcodeHash: password ? password : null,
        isPasswordProtected: Boolean(password),
        authKey: magicAuthKey,
        createdBy: userId || null
    });

    await emergency.save();

    // Construct magic join URL
    const hostUrl = baseUrl || 'http://localhost:5000';
    const shareableLink = `${hostUrl}/emergency/join?trackingId=${trackingId}&authKey=${magicAuthKey}`;

    return {
        emergencyTrackingId: emergency.emergencyTrackingId,
        title: emergency.title,
        status: emergency.status,
        isPasswordProtected: emergency.isPasswordProtected,
        authKey: emergency.authKey,
        shareableLink,
        sessionToken: generateEmergencySessionToken(emergency.emergencyTrackingId, 'ADMIN')
    };
};

/**
 * Authenticate via magic auth key (link access)
 */
const authenticateViaAuthKey = async (emergencyTrackingId, authKey) => {
    const emergency = await EmergencySession.findOne({
        emergencyTrackingId: emergencyTrackingId.toUpperCase(),
        authKey: authKey,
        status: 'ACTIVE'
    });

    if (!emergency) {
        throw new Error('Invalid tracking ID, expired link, or emergency session is closed.');
    }

    return {
        emergencyTrackingId: emergency.emergencyTrackingId,
        title: emergency.title,
        token: generateEmergencySessionToken(emergency.emergencyTrackingId, 'PARTICIPANT')
    };
};

/**
 * Authenticate via Tracking ID + Password
 */
const authenticateViaCredentials = async (emergencyTrackingId, password) => {
    const emergency = await EmergencySession.findOne({
        emergencyTrackingId: emergencyTrackingId.toUpperCase(),
        status: 'ACTIVE'
    });

    if (!emergency) {
        throw new Error('Emergency session not found or has been resolved.');
    }

    if (emergency.isPasswordProtected) {
        if (!password) {
            throw new Error('Passcode required for this emergency session.');
        }
        const isMatch = await emergency.comparePasscode(password);
        if (!isMatch) {
            throw new Error('Invalid passcode.');
        }
    }

    return {
        emergencyTrackingId: emergency.emergencyTrackingId,
        title: emergency.title,
        token: generateEmergencySessionToken(emergency.emergencyTrackingId, 'PARTICIPANT')
    };
};

/**
 * Get public session status & metadata
 */
const getEmergencyPublicInfo = async (emergencyTrackingId) => {
    const emergency = await EmergencySession.findOne(
        { emergencyTrackingId: emergencyTrackingId.toUpperCase() },
        'emergencyTrackingId title description status isPasswordProtected createdAt'
    );

    if (!emergency) {
        throw new Error('Emergency session not found.');
    }

    return emergency;
};

module.exports = {
    createEmergency,
    authenticateViaAuthKey,
    authenticateViaCredentials,
    getEmergencyPublicInfo,
    generateEmergencySessionToken
};
