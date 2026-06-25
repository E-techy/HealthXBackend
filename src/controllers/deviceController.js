const UserDevice = require('../models/UserDevice');

/**
 * Register or update an FCM token for an authenticated user's device
 */
const registerDevice = async (req, res) => {
    try {
        const userId = req.user.id; // Extracted from your JWT payload by middleware
        const { deviceId, deviceName, fcmToken } = req.body;

        // Validation
        if (!deviceId || !fcmToken) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields: deviceId and fcmToken are mandatory.' 
            });
        }

        // Upsert operations: Find by userId + deviceId, update the token and active status
        const updatedDevice = await UserDevice.findOneAndUpdate(
            { userId, deviceId },
            {
                deviceName: deviceName || 'Unknown Android Device',
                fcmToken: fcmToken,
                isActive: true,
                lastActiveAt: Date.now()
            },
            { 
                upsert: true, // Create a new document if it doesn't exist
                new: true,    // Return the updated document
                setDefaultsOnInsert: true 
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Device FCM token registered successfully.',
            data: {
                deviceId: updatedDevice.deviceId,
                isActive: updatedDevice.isActive
            }
        });

    } catch (error) {
        console.error('🔥 Device Registration Error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error occurred while registering the device.' 
        });
    }
};

module.exports = {
    registerDevice
};