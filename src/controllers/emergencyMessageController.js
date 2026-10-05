const { broadcastEvent, broadcastGlobalEvent, EVENTS } = require('../socket/socketSetup');

// 1. Send to a specific emergency room
exports.sendCustomMessage = async (req, res) => {
    try {
        const { emergencyTrackingId } = req.params;
        const { message, level } = req.body; 

        if (!message) return res.status(400).json({ success: false, message: 'Message content required.' });

        const validLevels = ['normal', 'alert', 'event', 'crash'];
        const msgLevel = validLevels.includes(level?.toLowerCase()) ? level.toLowerCase() : 'normal';

        broadcastEvent(emergencyTrackingId, EVENTS.CUSTOM_MESSAGE, {
            senderId: req.user.id,
            level: msgLevel,
            content: message
        });

        res.status(200).json({ success: true, message: 'Broadcast dispatched to room.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Send a pinned/sticky message to a specific room
exports.sendPinnedMessage = async (req, res) => {
    try {
        const { emergencyTrackingId } = req.params;
        const { message } = req.body;

        if (!message) return res.status(400).json({ success: false, message: 'Message content required.' });

        broadcastEvent(emergencyTrackingId, EVENTS.PINNED_MESSAGE, {
            senderId: req.user.id,
            content: message,
            action: 'PIN_TO_TOP'
        });

        res.status(200).json({ success: true, message: 'Pinned broadcast dispatched to room.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. 🌍 GLOBAL BROADCAST (Sends to EVERY connected socket on the server)
exports.sendGlobalBroadcast = async (req, res) => {
    try {
        const { message, level } = req.body;

        if (!message) return res.status(400).json({ success: false, message: 'Message content required.' });

        const validLevels = ['normal', 'alert', 'event', 'crash'];
        const msgLevel = validLevels.includes(level?.toLowerCase()) ? level.toLowerCase() : 'alert';

        broadcastGlobalEvent(EVENTS.GLOBAL_MESSAGE, {
            senderId: req.user.id,
            level: msgLevel,
            content: message,
            isGlobal: true
        });

        res.status(200).json({ success: true, message: 'Global broadcast dispatched to all clients.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
