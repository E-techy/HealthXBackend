require('dotenv').config();
const mongoose = require('mongoose');

// Import your models and service
const UserDevice = require('../src/models/UserDevice');
const ScheduledNotification = require('../src/models/ScheduledNotification');
const { sendDataNotification, NOTIFICATION_TYPES } = require('../src/services/notificationService');

// ==========================================
// 🛠️ TEST CONFIGURATION 
// ==========================================
const TEST_CONFIG = {
    MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/healthx',
    // Replace with a valid User ID and the FCM token from your Android Logcat
    USER_ID: '6a3914746e530aadb98b9102', 
    DEVICE_ID: 'android_test_device_001',
    FCM_TOKEN: 'fV0JmmuynuPZY_yG_dzdCx:APA91bE43ELUVqMaqcSChbhRVdzEOaAwaZmZrpP-Kp1YHz92krFIS-rP_Q20TNGF_mvtai33oLimgx8nq7Jl8utUalpdpYyddTGh2E8SpEFggnxn9BdMOXg', 
    WAIT_TIME_MS: 30 * 1000 // Reduced to 30 seconds for faster testing
};

// Ensure your NOTIFICATION_TYPES in notificationService.js has 'SUBSCRIPTION'
// If it doesn't, you can temporarily hardcode the string 'SUBSCRIPTION' below.

async function runSubscriptionNotificationTest() {
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

        // 2. Schedule the Subscription Notification
        const triggerTime = Date.now() + TEST_CONFIG.WAIT_TIME_MS;
        console.log(`\n⏰ Scheduling SUBSCRIPTION notification for ${new Date(triggerTime).toLocaleTimeString()} (in 30 seconds)...`);
        
        // This payload mimics the data required by your Subscription UI/Razorpay flow
        const testNotification = await ScheduledNotification.create({
            userId: TEST_CONFIG.USER_ID,
            notificationCategory: NOTIFICATION_TYPES.SUBSCRIPTION || 'SUBSCRIPTION',
            triggerTime: triggerTime,
            status: 'PENDING',
            payload: {
                title: "Unlock HealthX Pro! 🚀",
                body: "Get unlimited AI insights and tracking. Tap to view the Pro Yearly plan.",
                
                // --- Subscription Specific Data for Android ---
                actionType: "VIEW_PLAN", // Tells the Android app what screen to open
                planId: "PRO_YEARLY", // Maps to your SubscriptionPlan model
                subscriptionDbId: "65b1a2c3e4d5f6a7b8c9d0e1", // Example ObjectId of the plan
                price: "1999",
                billingCycle: "YEARLY"
            }
        });
        console.log(`✅ Subscription Notification saved with ID: ${testNotification._id}`);

        // 3. Start the Polling Mechanism
        console.log('\n🕵️ Starting database polling (checking every 10 seconds)...');
        
        const pollInterval = setInterval(async () => {
            const currentTime = Date.now();
            console.log(`   [${new Date().toLocaleTimeString()}] Polling...`);

            const pendingNotifications = await ScheduledNotification.find({
                status: 'PENDING',
                triggerTime: { $lte: currentTime }
            }).sort({ triggerTime: 1 });

            if (pendingNotifications.length > 0) {
                console.log(`\n🚀 Found ${pendingNotifications.length} notification(s) to process!`);
                clearInterval(pollInterval); 

                for (const notification of pendingNotifications) {
                    notification.status = 'PROCESSING';
                    await notification.save();

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

                        notification.status = success ? 'SENT' : 'FAILED';
                        await notification.save();
                        console.log(`✅ Status updated to: ${notification.status}`);
                    } else {
                        console.log('⚠️ No active devices found for user.');
                        notification.status = 'FAILED';
                        await notification.save();
                    }
                }

                console.log('\n🏁 Test complete. Check your Android Logcat/System Tray!');
                await mongoose.disconnect();
                process.exit(0);
            }
        }, 10000); 

    } catch (error) {
        console.error('\n❌ Test Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

runSubscriptionNotificationTest();