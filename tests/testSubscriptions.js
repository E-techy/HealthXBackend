require('dotenv').config();
const mongoose = require('mongoose');
const SubscriptionPlan = require('../src/models/SubscriptionPlan'); // Adjust path if needed

const SERVER_URL = `http://localhost:${process.env.PORT || 5001}`;

const runSubscriptionTests = async () => {
    try {
        console.log("⏳ Connecting to Database...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Database Connected.");

        // 1. Clear old plans and Create Dummy Plans
        console.log("\n⏳ Resetting Subscription Plans in DB...");
        await SubscriptionPlan.deleteMany({});
        
        const plansToInsert = [
            {
                planId: 'BASIC_MONTHLY',
                name: 'Basic Plan',
                shortDescription: 'Essential tracking for everyday use.',
                detailedDescription: 'Get access to basic health tracking and daily step counts.',
                price: 199,
                billingCycle: 'MONTHLY',
                features: ['Step Tracking', 'Basic Insights']
            },
            {
                planId: 'PRO_YEARLY',
                name: 'Pro Plan',
                shortDescription: 'Advanced tracking and AI insights.',
                detailedDescription: 'Full access to AI health models, unlimited tracking, and export features.',
                price: 1999,
                billingCycle: 'YEARLY',
                features: ['Unlimited Tracking', 'AI Insights', 'Data Export']
            }
        ];

        const createdPlans = await SubscriptionPlan.insertMany(plansToInsert);
        console.log(`✅ Inserted ${createdPlans.length} plans directly into DB.`);

        // 2. Test GET All Plans Route
        console.log("\n🚀 TESTING: GET /api/subscriptions/plans");
        const allPlansRes = await fetch(`${SERVER_URL}/api/subscriptions/plans`);
        const allPlansData = await allPlansRes.json();
        
        console.log("📥 RESPONSE:");
        console.dir(allPlansData, { depth: null, colors: true });

        // 3. Test GET Single Plan Route
        const targetPlanId = allPlansData.data[0]._id;
        console.log(`\n🚀 TESTING: GET /api/subscriptions/plans/${targetPlanId}`);
        
        const singlePlanRes = await fetch(`${SERVER_URL}/api/subscriptions/plans/${targetPlanId}`);
        const singlePlanData = await singlePlanRes.json();

        console.log("📥 RESPONSE:");
        console.dir(singlePlanData, { depth: null, colors: true });

        // Grab this ID for the payment test!
        console.log(`\n🎯 COPY THIS ID TO YOUR .ENV AS 'PAYMENT_TEST_PLAN_ID': ${targetPlanId}`);

    } catch (error) {
        console.error("❌ Test Failed:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\n🔌 Disconnected from DB.");
        process.exit(0);
    }
};

runSubscriptionTests();