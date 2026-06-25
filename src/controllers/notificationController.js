const { sendDataNotification, NOTIFICATION_TYPES } = require('../services/notificationService');

exports.sendTestNotification = async (req, res) => {
    try {
        // In a real scenario, you fetch the user's FCM tokens from the Database using req.user.id
        // For testing, we will pass the token directly in the request body
        const { fcmToken, accountId, title, message } = req.body;

        if (!fcmToken || !accountId) {
            return res.status(400).json({ success: false, message: "fcmToken and accountId are required." });
        }

        const payload = {
            title: title || "HealthX Test",
            body: message || "This is a test notification payload.",
            actionUrl: "healthx://test" // Example of deep linking
        };

        const result = await sendDataNotification(
            [fcmToken], // Put the single token in an array
            accountId,
            NOTIFICATION_TYPES.TEST,
            payload
        );

        if (result) {
            res.status(200).json({ success: true, message: "Test notification sent to Firebase." });
        } else {
            res.status(500).json({ success: false, message: "Failed to send notification." });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};