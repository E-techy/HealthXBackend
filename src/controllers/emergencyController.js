const LocationLog = require('../models/LocationLog');
const EmergencySession = require('../models/EmergencySession');
const EmergencyContact = require('../models/EmergencyContact');
const Device = require('../models/Device'); // Assuming you have a device model for FCM tokens
const { sendDataNotification, NOTIFICATION_TYPES } = require('../services/notificationService');

/**
 * 1. LOG LOCATION (Hit by Android device every 5-10s)
 * Needs to be extremely fast. No heavy DB joins here.
 */
exports.logLocation = async (req, res) => {
    try {
        const { longitude, latitude, mode, emergencySessionId } = req.body;
        
        // Fast insert into Time Series collection
        await LocationLog.create({
            userId: req.user.id,
            mode: mode || 'NORMAL',
            emergencySessionId: emergencySessionId || null,
            location: {
                type: 'Point',
                coordinates: [longitude, latitude]
            }
        });

        // Return 204 No Content to save bandwidth on high-frequency calls
        res.status(204).send();
    } catch (error) {
        console.error("🔥 Error logging location:", error.message);
        res.status(500).json({ success: false, message: "Failed to log location" });
    }
};

/**
 * 2. POLICE INITIATES TRACKING
 * Sends a silent push to the user's phone to force GPS hardware on.
 */
exports.policeInitiateTracking = async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const policeUnitId = req.policeUnit.id;

        // 1. Create a new emergency session
        const session = await EmergencySession.create({
            userId: targetUserId,
            initiatedBy: 'POLICE',
            policeUnitId: policeUnitId
        });

        // 2. Fetch user's registered devices
        const userDevices = await Device.find({ userId: targetUserId }).select('fcmToken');
        const tokens = userDevices.map(d => d.fcmToken).filter(t => t);

        if (tokens.length > 0) {
            // 3. Send silent FCM to wake up app and start broadcasting
            await sendDataNotification(
                tokens,
                targetUserId,
                'EMERGENCY_TRACKING_INITIATED', // Custom type for Android to parse
                {
                    emergencySessionId: session._id.toString(),
                    message: "Police have initiated emergency tracking."
                }
            );
        }

        res.status(200).json({ 
            success: true, 
            message: "Tracking initiated. Ping sent to device.", 
            emergencySessionId: session._id 
        });
    } catch (error) {
        console.error("🔥 Error initiating tracking:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * 3. GET LIVE LOCATIONS (Used by Police OR Delegated Contacts)
 */
exports.getLiveLocations = async (req, res) => {
    try {
        // Support both direct target request (Police) or Delegated Context (req.user.id swapped by middleware)
        const targetUserId = req.query.targetUserId || req.user.id; 
        const { limit = 20, mode } = req.query;

        // Security Check: If standard user is calling without Delegated Middleware swap, block them
        if (!req.policeUnit && req.user.id !== targetUserId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const query = { userId: targetUserId };
        if (mode) query.mode = mode;

        // Fetch latest coordinates, sorted by timestamp descending
        const locations = await LocationLog.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .select('location timestamp mode emergencySessionId');

        res.status(200).json({ success: true, data: locations });
    } catch (error) {
        console.error("🔥 Error fetching locations:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * 4. ADD EMERGENCY CONTACT
 */
exports.addEmergencyContact = async (req, res) => {
    try {
        const { contactId, relation } = req.body;

        await EmergencyContact.create({
            ownerId: req.user.id,
            contactId: contactId,
            relation: relation
        });

        res.status(201).json({ success: true, message: "Emergency contact added." });
    } catch (error) {
        // Handle duplicate index error safely
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Contact already exists." });
        }
        res.status(500).json({ success: false, message: "Server error" });
    }
};