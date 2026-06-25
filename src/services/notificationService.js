const admin = require('../config/firebase');

// Define standard categories to keep the app organized
const NOTIFICATION_TYPES = {
    TEST: 'TEST_NOTIFICATION',
    OTP: 'OTP_VERIFICATION',
    ADVERTISEMENT: 'PROMO_AD',
    UPDATE: 'APP_UPDATE',
    REMINDER: 'REMINDER_ALERT',
    CHAT: 'NEW_CHAT_MESSAGE',
    SYNC: 'SILENT_DATA_SYNC'
};

/**
 * Core function to send data-only FCM messages
 */
const sendDataNotification = async (fcmTokens, accountId, type, payload) => {
    // If no tokens are provided, fail silently (user has no active devices)
    if (!fcmTokens || fcmTokens.length === 0) return false;

    const message = {
        tokens: fcmTokens, // Send to multiple devices at once
        data: {
            // Data payloads must be strictly Strings. Android will parse them.
            accountId: accountId.toString(),
            notificationType: type,
            timestamp: Date.now().toString(),
            
            // Stringify the dynamic payload (title, body, specific IDs)
            payloadData: JSON.stringify(payload)
        },
        android: {
            priority: 'high' // Required to wake up the device from Doze mode
        }
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`FCM Success: ${response.successCount}, Failures: ${response.failureCount}`);
        
        // Optional: You can loop through response.responses here to find 
        // failed tokens (e.g., user uninstalled app) and delete them from your DB.
        
        return true;
    } catch (error) {
        console.error("🔥 FCM Send Error:", error);
        return false;
    }
};

module.exports = {
    NOTIFICATION_TYPES,
    sendDataNotification
};