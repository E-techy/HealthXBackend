require('dotenv').config();
const crypto = require('crypto');

const SERVER_URL = `http://localhost:${process.env.PORT || 5001}`;
const JWT_TOKEN = process.env.PAYMENT_TEST_USER_JWT;
const PLAN_ID = process.env.PAYMENT_TEST_PLAN_ID;
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!JWT_TOKEN || !PLAN_ID || !RAZORPAY_SECRET) {
    console.error("❌ Missing required environment variables! Check PAYMENT_TEST_USER_JWT, PAYMENT_TEST_PLAN_ID, and RAZORPAY_KEY_SECRET.");
    process.exit(1);
}

const runPaymentTests = async () => {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${JWT_TOKEN}`
        };

        // 1. Create the Order
        console.log("\n🚀 TESTING: POST /api/subscriptions/order/create");
        const createRes = await fetch(`${SERVER_URL}/api/subscriptions/order/create`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ subscriptionId: PLAN_ID })
        });
        
        const createData = await createRes.json();
        console.log("📥 CREATION RESPONSE:");
        console.dir(createData, { depth: null, colors: true });

        if (!createData.success) {
            console.error("❌ Failed to create order. Aborting.");
            return;
        }

        const razorpayOrderId = createData.orderData.orderId;

        // 2. Simulate Razorpay SDK Payment (Mocking the verification data)
        console.log("\n⏳ Simulating successful payment in Razorpay SDK...");
        
        // We make up a fake payment ID that Razorpay would normally return
        const fakePaymentId = `pay_test_${Date.now()}`; 
        
        // We cryptographically generate the exact signature your server is expecting to see
        const signatureBody = razorpayOrderId + "|" + fakePaymentId;
        const expectedSignature = crypto
            .createHmac("sha256", RAZORPAY_SECRET)
            .update(signatureBody.toString())
            .digest("hex");

        const verificationPayload = {
            razorpayOrderId: razorpayOrderId,
            razorpayPaymentId: fakePaymentId,
            razorpaySignature: expectedSignature
        };

        console.log("📤 SENDING VERIFICATION PAYLOAD:", verificationPayload);

        // 3. Verify the Payment
        console.log("\n🚀 TESTING: POST /api/subscriptions/order/verify");
        const verifyRes = await fetch(`${SERVER_URL}/api/subscriptions/order/verify`, {
            method: 'POST',
            headers,
            body: JSON.stringify(verificationPayload)
        });

        const verifyData = await verifyRes.json();
        console.log("📥 VERIFICATION RESPONSE:");
        console.dir(verifyData, { depth: null, colors: true });

    } catch (error) {
        console.error("❌ Test Failed:", error);
    }
};

runPaymentTests();