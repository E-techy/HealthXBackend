const emergencyService = require('../services/emergencyService');
const jwt = require('jsonwebtoken');

// Helper to extract JWT ID if present (used for joining routes to check against ACL)
const getOptionalUserId = (req) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            return decoded.id;
        } catch (e) {
            return null; // Invalid token
        }
    }
    return null; // No token provided
};

exports.create = async (req, res) => {
    try {
        const { title, description, password } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'Title is required.' });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        // requireJWT middleware ensures req.user is set
        const result = await emergencyService.createEmergency({ title, description, password, userId: req.user.id, baseUrl });

        return res.status(201).json({ success: true, message: 'Emergency session created.', data: result });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateDetails = async (req, res) => {
    try {
        const updated = await emergencyService.updateEmergencyDetails(req.params.id, req.user.id, req.body);
        return res.status(200).json({ success: true, message: 'Emergency details updated.', data: updated });
    } catch (error) {
        return res.status(403).json({ success: false, message: error.message });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const updated = await emergencyService.updateEmergencyStatus(req.params.id, req.user.id, status);
        return res.status(200).json({ success: true, message: `Emergency status updated to ${status}.`, data: updated });
    } catch (error) {
        return res.status(403).json({ success: false, message: error.message });
    }
};

exports.deleteSession = async (req, res) => {
    try {
        await emergencyService.deleteEmergency(req.params.id, req.user.id);
        return res.status(200).json({ success: true, message: 'Emergency session permanently deleted.' });
    } catch (error) {
        return res.status(403).json({ success: false, message: error.message });
    }
};

exports.invite = async (req, res) => {
    try {
        const { userIds } = req.body; // Array of user IDs
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Provide an array of userIds to invite.' });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const result = await emergencyService.inviteUsers(req.params.id, req.user.id, userIds, baseUrl);
        
        return res.status(200).json({ success: true, message: `Successfully invited and emailed ${result.invitedCount} responders.`, data: result });
    } catch (error) {
        return res.status(403).json({ success: false, message: error.message });
    }
};

exports.joinViaMagicKey = async (req, res) => {
    try {
        const { emergencyTrackingId, authKey } = req.body;
        const requestingUserId = getOptionalUserId(req); // Identify user to check against ACL

        const result = await emergencyService.authenticateViaAuthKey(emergencyTrackingId, authKey, requestingUserId);
        return res.status(200).json({ success: true, message: 'Authenticated via link successfully.', data: result });
    } catch (error) {
        return res.status(401).json({ success: false, message: error.message });
    }
};

exports.joinViaCredentials = async (req, res) => {
    try {
        const { emergencyTrackingId, password } = req.body;
        const requestingUserId = getOptionalUserId(req); // Identify user to check against ACL

        const result = await emergencyService.authenticateViaCredentials(emergencyTrackingId, password, requestingUserId);
        return res.status(200).json({ success: true, message: 'Authenticated successfully.', data: result });
    } catch (error) {
        return res.status(401).json({ success: false, message: error.message });
    }
};

exports.getInfo = async (req, res) => {
    try {
        const info = await emergencyService.getEmergencyPublicInfo(req.params.id);
        return res.status(200).json({ success: true, data: info });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};
