const UserDevice = require('../models/UserDevice'); // Ensure this path is correct

exports.syncToken = async (req, res) => {
    console.log("\n==============================================");
    console.log("📥 [FCM SYNC] Request received at /api/device/sync-token");
    
    try {
        // 1. Ensure the user is authenticated (Requires authMiddleware on the route)
        const userId = req.user.userId; // Assuming your JWT middleware attaches the decoded user here
        console.log(`👤 [FCM SYNC] Authenticated User ID: ${userId}`);

        // 2. Extract the payload from Android
        const { deviceId, deviceName, fcmToken } = req.body;
        console.log(`📱 [FCM SYNC] Payload - Device ID: ${deviceId}`);
        console.log(`📱 [FCM SYNC] Payload - Name: ${deviceName}`);
        console.log(`🔑 [FCM SYNC] Payload - Token: ${fcmToken ? fcmToken.substring(0, 20) + '...' : 'MISSING'}`);

        if (!deviceId || !fcmToken) {
            console.log("❌ [FCM SYNC] Missing required fields in payload.");
            return res.status(400).json({ success: false, message: "deviceId and fcmToken are required." });
        }

        // 3. Upsert into MongoDB
        console.log("💾 [FCM SYNC] Attempting to save to MongoDB...");
        const updatedDevice = await UserDevice.findOneAndUpdate(
            { userId: userId, deviceId: deviceId },
            { 
                deviceName: deviceName || "Unknown Android Device",
                fcmToken: fcmToken,
                isActive: true,
                lastActiveAt: Date.now()
            },
            { upsert: true, new: true } // Create if doesn't exist, update if it does
        );

        console.log(`✅ [FCM SYNC] Successfully saved to DB! Mongo _id: ${updatedDevice._id}`);
        console.log("==============================================\n");

        res.status(200).json({ success: true, message: "Device token synced successfully." });

    } catch (error) {
        console.error("🔥 [FCM SYNC CRASH]:", error);
        res.status(500).json({ success: false, message: "Internal server error during sync." });
    }
};