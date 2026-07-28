const SubscriptionPlan = require('../models/SubscriptionPlan');
const Order = require('../models/Order');
const razorpayInstance = require('../config/razorpay');
const crypto = require('crypto');
const UserSubscription = require('../models/UserSubscription');

// Placeholder function to grant access after payment
const addSubscriptionToUser = async (userId, subscriptionId) => {
    console.log(`[INFO] addSubscriptionToUser - Initiating subscription upgrade. User: ${userId} | PlanID: ${subscriptionId}`);
    try {
        const plan = await SubscriptionPlan.findById(subscriptionId);
        if (!plan) {
            console.warn(`[WARN] addSubscriptionToUser - Plan not found in DB: ${subscriptionId}`);
            return;
        }

        console.log(`[DEBUG] addSubscriptionToUser - Fetched plan details: ${plan.planId}`);

        // Determine the tier based on your planId naming convention 
        // (e.g., 'PRO_YEARLY' becomes 'PRO', 'ULTRA_LIFETIME' becomes 'ULTRA')
        let newStatus = 'PRO'; 
        if (plan.planId.includes('ULTRA')) {
            newStatus = 'ULTRA';
        }

        // Upsert the status in the dedicated table
        await UserSubscription.findOneAndUpdate(
            { userId },
            { status: newStatus },
            { upsert: true, new: true }
        );

        console.log(`[INFO] addSubscriptionToUser - ✅ Successfully granted ${newStatus} subscription to user: ${userId}`);
    } catch (error) {
        console.error(`[ERROR] addSubscriptionToUser - 🔥 Error upgrading user subscription for User: ${userId}`);
        console.error(`[ERROR DETAILS] ${error.name}: ${error.message}`, error);
    }
};

// 1. Get All Active Plans (Public)
exports.getAllPlans = async (req, res) => {
    console.log(`[INFO] GET /plans - Fetching all active subscription plans`);
    try {
        const plans = await SubscriptionPlan.find({ isActive: true }).select('-__v');
        
        console.log(`[INFO] GET /plans - Successfully fetched ${plans.length} active plans.`);
        res.status(200).json({ success: true, count: plans.length, data: plans });
    } catch (error) {
        console.error(`[ERROR] GET /plans - Failed to fetch subscription plans.`);
        console.error(`[ERROR DETAILS] ${error.name}: ${error.message}`, error);
        res.status(500).json({ success: false, message: "Error fetching subscription plans." });
    }
};

// 2. Get Specific Plan by ID (Public)
exports.getPlanById = async (req, res) => {
    const planId = req.params.id;
    console.log(`[INFO] GET /plans/:id - Fetching plan details for ID: ${planId}`);
    try {
        const plan = await SubscriptionPlan.findById(planId).select('-__v');
        
        if (!plan || !plan.isActive) {
            console.warn(`[WARN] GET /plans/:id - Plan not found or inactive. ID: ${planId}`);
            return res.status(404).json({ success: false, message: "Plan not found or inactive." });
        }
        
        console.log(`[INFO] GET /plans/:id - Successfully fetched plan: ${plan.name} (${planId})`);
        res.status(200).json({ success: true, data: plan });
    } catch (error) {
        console.error(`[ERROR] GET /plans/:id - Failed to fetch plan ID: ${planId}`);
        console.error(`[ERROR DETAILS] ${error.name}: ${error.message}`, error);
        res.status(500).json({ success: false, message: "Error fetching subscription plan." });
    }
};

// 3. Create Order (Protected)
exports.createOrder = async (req, res) => {
    const userId = req.user?.id;
    console.log(`[INFO] POST /orders/create - Order creation initiated by User: ${userId}`);
    
    try {
        const { subscriptionId } = req.body;
        console.log(`[DEBUG] POST /orders/create - Requested SubscriptionID: ${subscriptionId}`);

        // Verify plan exists
        const plan = await SubscriptionPlan.findById(subscriptionId);
        if (!plan || !plan.isActive) {
            console.warn(`[WARN] POST /orders/create - Invalid or inactive subscription plan requested by User: ${userId}`);
            return res.status(404).json({ success: false, message: "Invalid subscription plan." });
        }

        // Razorpay expects amount in paise (smallest unit). So multiply INR by 100.
        const amountInPaise = plan.price * 100;
        console.log(`[DEBUG] POST /orders/create - Creating Razorpay order. Amount: ${amountInPaise} paise, Currency: ${plan.currency}`);

        const options = {
            amount: amountInPaise,
            currency: plan.currency,
            receipt: `receipt_order_${Date.now()}`,
            payment_capture: 1 // Auto capture
        };

        // Create order in Razorpay
        const razorpayOrder = await razorpayInstance.orders.create(options);
        console.log(`[INFO] POST /orders/create - Razorpay order generated successfully. Razorpay OrderID: ${razorpayOrder.id}`);

        // Save order tracking in our database
        const newOrder = await Order.create({
            userId,
            subscriptionPlanId: plan._id,
            razorpayOrderId: razorpayOrder.id,
            amount: plan.price,
            status: 'CREATED'
        });
        console.log(`[INFO] POST /orders/create - Order saved to database. DB OrderID: ${newOrder._id}`);

        const responsePayload = {
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            keyId: process.env.RAZORPAY_KEY_ID, // App needs this to initialize SDK
            planName: plan.name,
            planDescription: plan.shortDescription
        };

        console.log(`[DEBUG] POST /orders/create - Sending payload to client:`, responsePayload);

        // Send Razorpay format to the Android app
        res.status(200).json({
            success: true,
            orderData: responsePayload
        });

    } catch (error) {
        console.error(`[ERROR] POST /orders/create - 🔥 Order Creation Error for User: ${userId}`);
        console.error(`[ERROR DETAILS] ${error.name}: ${error.message}`, error);
        res.status(500).json({ success: false, message: "Failed to create payment order." });
    }
};

// 4. Cancel Order (Protected)
exports.cancelOrder = async (req, res) => {
    const userId = req.user?.id;
    console.log(`[INFO] POST /orders/cancel - Cancellation requested by User: ${userId}`);
    
    try {
        const { razorpayOrderId } = req.body;
        console.log(`[DEBUG] POST /orders/cancel - Target Razorpay OrderID: ${razorpayOrderId}`);
        
        const order = await Order.findOne({ razorpayOrderId, userId });
        if (!order) {
            console.warn(`[WARN] POST /orders/cancel - Order not found. User: ${userId} | OrderID: ${razorpayOrderId}`);
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        if (order.status === 'SUCCESS') {
            console.warn(`[WARN] POST /orders/cancel - Attempted to cancel a successful order. User: ${userId} | OrderID: ${razorpayOrderId}`);
            return res.status(400).json({ success: false, message: "Cannot cancel an already successful order." });
        }

        order.status = 'CANCELLED';
        await order.save();

        console.log(`[INFO] POST /orders/cancel - Order cancelled successfully. User: ${userId} | OrderID: ${razorpayOrderId}`);
        res.status(200).json({ success: true, message: "Order cancelled successfully." });
    } catch (error) {
        console.error(`[ERROR] POST /orders/cancel - Failed to cancel order for User: ${userId}`);
        console.error(`[ERROR DETAILS] ${error.name}: ${error.message}`, error);
        res.status(500).json({ success: false, message: "Failed to cancel order." });
    }
};

// 5. Verify Payment & Grant Access (Protected)
exports.verifyPayment = async (req, res) => {
    const userId = req.user?.id;
    console.log(`[INFO] POST /orders/verify - Payment verification initiated by User: ${userId}`);
    
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
        console.log(`[DEBUG] POST /orders/verify - Payload received -> OrderID: ${razorpayOrderId}, PaymentID: ${razorpayPaymentId}`);

        // Find the pending order
        const order = await Order.findOne({ razorpayOrderId, userId });
        if (!order) {
            console.warn(`[WARN] POST /orders/verify - Order not found for verification. User: ${userId} | OrderID: ${razorpayOrderId}`);
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        // Verify the Razorpay signature using crypto
        console.log(`[DEBUG] POST /orders/verify - Calculating expected signature...`);
        const body = razorpayOrderId + "|" + razorpayPaymentId;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature === razorpaySignature) {
            console.log(`[INFO] POST /orders/verify - Signature VALID! Payment verified. User: ${userId} | OrderID: ${razorpayOrderId}`);
            
            // Signature is valid, payment is successful
            order.status = 'SUCCESS';
            order.razorpayPaymentId = razorpayPaymentId;
            await order.save();

            // CALL THE PLACEHOLDER FUNCTION
            await addSubscriptionToUser(userId, order.subscriptionPlanId);

            return res.status(200).json({ success: true, message: "Payment verified. Subscription activated!" });
        } else {
            console.warn(`[WARN] POST /orders/verify - Signature INVALID! Possible fraud attempt. User: ${userId} | OrderID: ${razorpayOrderId}`);
            
            // Invalid signature
            order.status = 'FAILED';
            await order.save();
            return res.status(400).json({ success: false, message: "Payment verification failed. Invalid signature." });
        }

    } catch (error) {
        console.error(`[ERROR] POST /orders/verify - 🔥 Payment Verification Error for User: ${userId}`);
        console.error(`[ERROR DETAILS] ${error.name}: ${error.message}`, error);
        res.status(500).json({ success: false, message: "Server error during payment verification." });
    }
};

// 6. Get User's Active Subscription Status (Protected)
exports.getSubscriptionStatus = async (req, res) => {
    const userId = req.user?.id;
    console.log(`[INFO] GET /subscription/status - Fetching subscription status for User: ${userId}`);
    
    try {
        const userSub = await UserSubscription.findOne({ userId });

        // If no record exists, they are implicitly on the FREE tier
        if (!userSub) {
            console.log(`[INFO] GET /subscription/status - No subscription record found. Defaulting to FREE tier for User: ${userId}`);
            return res.status(200).json({ 
                success: true, 
                status: "FREE" 
            });
        }

        console.log(`[INFO] GET /subscription/status - Found active subscription. Tier: ${userSub.status} | User: ${userId}`);
        
        // Return the active status (PRO or ULTRA)
        res.status(200).json({ 
            success: true, 
            status: userSub.status 
        });

    } catch (error) {
        console.error(`[ERROR] GET /subscription/status - 🔥 Error fetching subscription status for User: ${userId}`);
        console.error(`[ERROR DETAILS] ${error.name}: ${error.message}`, error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};