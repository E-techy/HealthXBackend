require('dotenv').config(); // Assuming you use dotenv for your MongoDB URI
const mongoose = require('mongoose');

// Import your models and service
const UserDevice = require('../src/models/UserDevice');
const ScheduledNotification = require('../src/models/ScheduledNotification');
const { sendDataNotification, NOTIFICATION_TYPES } = require('../src/services/notificationService');

// ==========================================
// 🛠️ TEST CONFIGURATION (FILL THESE IN)
// ==========================================
const TEST_CONFIG = {
    MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/healthx',
    USER_ID: '6a3914746e530aadb98b9102', // Replace with a valid MongoDB ObjectId from your DB
    DEVICE_ID: 'android_test_device_001',
    FCM_TOKEN: 'fV0JmmuynuPZY_yG_dzdCx:APA91bE43ELUVqMaqcSChbhRVdzEOaAwaZmZrpP-Kp1YHz92krFIS-rP_Q20TNGF_mvtai33oLimgx8nq7Jl8utUalpdpYyddTGh2E8SpEFggnxn9BdMOXg', // Replace with the token printed in your Android Logcat
    WAIT_TIME_MS: 60 * 1000 // 1 minute
};

async function runTest() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(TEST_CONFIG.MONGO_URI);
        console.log('✅ Connected to database.');

        // 1. Seed the Device Database
        console.log(`\n📱 Registering test device for user ${TEST_CONFIG.USER_ID}...`);
        await UserDevice.findOneAndUpdate(
            { userId: TEST_CONFIG.USER_ID, deviceId: TEST_CONFIG.DEVICE_ID },
            { 
                fcmToken: TEST_CONFIG.FCM_TOKEN, 
                isActive: true, 
                lastActiveAt: Date.now() 
            },
            { upsert: true, new: true }
        );
        console.log('✅ Device registered successfully.');

        // 2. Schedule the Notification
        const triggerTime = Date.now() + TEST_CONFIG.WAIT_TIME_MS;
        console.log(`\n⏰ Scheduling notification for ${new Date(triggerTime).toLocaleTimeString()} (in 1 minute)...`);
        
        const testNotification = await ScheduledNotification.create({
            userId: TEST_CONFIG.USER_ID,
            notificationCategory: NOTIFICATION_TYPES.TEST,
            triggerTime: triggerTime,
            status: 'PENDING',
            payload: {
                title: "Test Payload from Backend",
                body: "Checking if polling and FCM delivery works!",
                customDataId: "test_123"
            }
        });
        console.log(`✅ Notification saved with ID: ${testNotification._id}`);

        // 3. Start the Polling Mechanism (Simulating your background service)
        console.log('\n🕵️ Starting database polling (checking every 10 seconds)...');
        
        const pollInterval = setInterval(async () => {
            const currentTime = Date.now();
            console.log(`   [${new Date().toLocaleTimeString()}] Polling...`);

            // Query for pending notifications that are ready to trigger
            const pendingNotifications = await ScheduledNotification.find({
                status: 'PENDING',
                triggerTime: { $lte: currentTime }
            }).sort({ triggerTime: 1 });

            if (pendingNotifications.length > 0) {
                console.log(`\n🚀 Found ${pendingNotifications.length} notification(s) to process!`);
                
                // Stop the poller for this test script
                clearInterval(pollInterval); 

                for (const notification of pendingNotifications) {
                    // Mark as processing
                    notification.status = 'PROCESSING';
                    await notification.save();

                    // Find active devices for this user
                    const devices = await UserDevice.find({ 
                        userId: notification.userId, 
                        isActive: true 
                    });

                    const tokens = devices.map(d => d.fcmToken);

                    if (tokens.length > 0) {
                        console.log(`📡 Sending to ${tokens.length} device(s)...`);
                        
                        const success = await sendDataNotification(
                            tokens, 
                            notification.userId, 
                            notification.notificationCategory, 
                            notification.payload
                        );

                        // Update final status
                        notification.status = success ? 'SENT' : 'FAILED';
                        await notification.save();
                        console.log(`✅ Status updated to: ${notification.status}`);
                    } else {
                        console.log('⚠️ No active devices found for user.');
                        notification.status = 'FAILED';
                        await notification.save();
                    }
                }

                console.log('\n🏁 Test complete. Check your Android Logcat!');
                await mongoose.disconnect();
                process.exit(0);
            }
        }, 10000); // Poll every 10 seconds

    } catch (error) {
        console.error('\n❌ Test Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

runTest();