const admin = require('../config/firebase');

// Matches the top-level NotificationCategory enum in the Android app
const NOTIFICATION_TYPES = {
    OTP: 'OTP',
    NEW_DEVICE_REGISTERED: 'NEW_DEVICE_REGISTERED',
    NEW_AI_CHAT_RECEIVED: 'NEW_AI_CHAT_RECEIVED',
    ADVERTISEMENT: 'ADVERTISEMENT',
    REMINDER: 'REMINDER',
    SUBSCRIPTION: 'SUBSCRIPTION',
    PAYMENT: 'PAYMENT',
    DATA_SYNCING: 'DATA_SYNCING',
    DOWNLOADING_MEDIA: 'DOWNLOADING_MEDIA',
    FEEDBACK_REVIEW: 'FEEDBACK_REVIEW',
    ACCOUNT_DELETION: 'ACCOUNT_DELETION',
    ACCOUNT_LOGGED_OUT: 'ACCOUNT_LOGGED_OUT',
    
    // Developer utility (not strictly in the Android enum, but useful for testing scripts)
    TEST: 'TEST' 
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