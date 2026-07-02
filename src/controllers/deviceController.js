const UserDevice = require('../models/UserDevice');

/**
 * Syncs the FCM token for a specific user and device combination.
 * Creates a new record if it doesn't exist, updates it if it does.
 */
exports.syncToken = async (req, res) => {
    try {
        const userId = req.user.id; // Extracted from the JWT
        const { deviceId, deviceName, fcmToken } = req.body;

        // Validation based on your API docs
        if (!deviceId || !fcmToken) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields: deviceId and fcmToken are mandatory.' 
            });
        }

        // Upsert operation
        const updatedDevice = await UserDevice.findOneAndUpdate(
            { userId, deviceId },
            {
                deviceName: deviceName || 'Unknown Android Device',
                fcmToken: fcmToken,
                isActive: true,
                lastSyncTime: Date.now() // Record the exact moment of the sync
            },
            { 
                upsert: true, 
                new: true,    
                setDefaultsOnInsert: true 
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Device FCM token synced successfully.',
            data: {
                deviceId: updatedDevice.deviceId,
                isActive: updatedDevice.isActive,
                lastSyncTime: updatedDevice.lastSyncTime
            }
        });

    } catch (error) {
        console.error('🔥 Token Sync Error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error occurred while syncing the token.' 
        });
    }
};