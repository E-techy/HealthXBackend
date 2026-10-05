const emergencyService = require('../services/emergencyService');

exports.create = async (req, res) => {
    try {
        const { title, description, password } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, message: 'Title is required for the emergency.' });
        }

        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        const userId = req.user ? req.user.id : null;

        const result = await emergencyService.createEmergency({
            title,
            description,
            password,
            userId,
            baseUrl
        });

        return res.status(201).json({
            success: true,
            message: 'Emergency session initialized successfully.',
            data: result
        });
    } catch (error) {
        console.error('Error creating emergency:', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

exports.joinViaMagicKey = async (req, res) => {
    try {
        const { emergencyTrackingId, authKey } = req.body;

        if (!emergencyTrackingId || !authKey) {
            return res.status(400).json({
                success: false,
                message: 'Both emergencyTrackingId and authKey are required.'
            });
        }

        const result = await emergencyService.authenticateViaAuthKey(emergencyTrackingId, authKey);

        return res.status(200).json({
            success: true,
            message: 'Authenticated via link successfully.',
            data: result
        });
    } catch (error) {
        return res.status(401).json({ success: false, message: error.message });
    }
};

exports.joinViaCredentials = async (req, res) => {
    try {
        const { emergencyTrackingId, password } = req.body;

        if (!emergencyTrackingId) {
            return res.status(400).json({
                success: false,
                message: 'emergencyTrackingId is required.'
            });
        }

        const result = await emergencyService.authenticateViaCredentials(emergencyTrackingId, password);

        return res.status(200).json({
            success: true,
            message: 'Authenticated successfully.',
            data: result
        });
    } catch (error) {
        return res.status(401).json({ success: false, message: error.message });
    }
};

exports.getInfo = async (req, res) => {
    try {
        const { emergencyTrackingId } = req.params;
        const info = await emergencyService.getEmergencyPublicInfo(emergencyTrackingId);

        return res.status(200).json({
            success: true,
            data: info
        });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};
