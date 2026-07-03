const SubscriptionPlan = require('../models/SubscriptionPlan');
const Order = require('../models/Order');
const razorpayInstance = require('../config/razorpay');
const crypto = require('crypto');
const UserSubscription = require('../models/UserSubscription');

// Placeholder function to grant access after payment
const addSubscriptionToUser = async (userId, subscriptionId) => {
    try {
        const plan = await SubscriptionPlan.findById(subscriptionId);
        if (!plan) return;

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

        console.log(`✅ Granted ${newStatus} subscription to user ${userId}`);
    } catch (error) {
        console.error("🔥 Error upgrading user subscription:", error);
    }
};

// 1. Get All Active Plans (Public)
exports.getAllPlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find({ isActive: true }).select('-__v');
        res.status(200).json({ success: true, count: plans.length, data: plans });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching subscription plans." });
    }
};

// 2. Get Specific Plan by ID (Public)
exports.getPlanById = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findById(req.params.id).select('-__v');
        if (!plan || !plan.isActive) {
            return res.status(404).json({ success: false, message: "Plan not found or inactive." });
        }
        res.status(200).json({ success: true, data: plan });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching subscription plan." });
    }
};

// 3. Create Order (Protected)
exports.createOrder = async (req, res) => {
    try {
        const { subscriptionId } = req.body;
        const userId = req.user.id;

        // Verify plan exists
        const plan = await SubscriptionPlan.findById(subscriptionId);
        if (!plan || !plan.isActive) {
            return res.status(404).json({ success: false, message: "Invalid subscription plan." });
        }

        // Razorpay expects amount in paise (smallest unit). So multiply INR by 100.
        const amountInPaise = plan.price * 100;

        const options = {
            amount: amountInPaise,
            currency: plan.currency,
            receipt: `receipt_order_${Date.now()}`,
            payment_capture: 1 // Auto capture
        };

        // Create order in Razorpay
        const razorpayOrder = await razorpayInstance.orders.create(options);

        // Save order tracking in our database
        const newOrder = await Order.create({
            userId,
            subscriptionPlanId: plan._id,
            razorpayOrderId: razorpayOrder.id,
            amount: plan.price,
            status: 'CREATED'
        });

        // Send Razorpay format to the Android app
        res.status(200).json({
            success: true,
            orderData: {
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                keyId: process.env.RAZORPAY_KEY_ID, // App needs this to initialize SDK
                planName: plan.name,
                planDescription: plan.shortDescription
            }
        });

    } catch (error) {
        console.error("🔥 Order Creation Error:", error);
        res.status(500).json({ success: false, message: "Failed to create payment order." });
    }
};

// 4. Cancel Order (Protected)
exports.cancelOrder = async (req, res) => {
    try {
        const { razorpayOrderId } = req.body;
        
        const order = await Order.findOne({ razorpayOrderId, userId: req.user.id });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        if (order.status === 'SUCCESS') {
            return res.status(400).json({ success: false, message: "Cannot cancel an already successful order." });
        }

        order.status = 'CANCELLED';
        await order.save();

        res.status(200).json({ success: true, message: "Order cancelled successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to cancel order." });
    }
};

// 5. Verify Payment & Grant Access (Protected)
exports.verifyPayment = async (req, res) => {
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
        const userId = req.user.id;

        // Find the pending order
        const order = await Order.findOne({ razorpayOrderId, userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        // Verify the Razorpay signature using crypto
        const body = razorpayOrderId + "|" + razorpayPaymentId;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature === razorpaySignature) {
            // Signature is valid, payment is successful
            order.status = 'SUCCESS';
            order.razorpayPaymentId = razorpayPaymentId;
            await order.save();

            // CALL THE PLACEHOLDER FUNCTION
            await addSubscriptionToUser(userId, order.subscriptionPlanId);

            return res.status(200).json({ success: true, message: "Payment verified. Subscription activated!" });
        } else {
            // Invalid signature
            order.status = 'FAILED';
            await order.save();
            return res.status(400).json({ success: false, message: "Payment verification failed. Invalid signature." });
        }

    } catch (error) {
        console.error("🔥 Payment Verification Error:", error);
        res.status(500).json({ success: false, message: "Server error during payment verification." });
    }
};


// 6. Get User's Active Subscription Status (Protected)
exports.getSubscriptionStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const userSub = await UserSubscription.findOne({ userId });

        // If no record exists, they are implicitly on the FREE tier
        if (!userSub) {
            return res.status(200).json({ 
                success: true, 
                status: "FREE" 
            });
        }

        // Return the active status (PRO or ULTRA)
        res.status(200).json({ 
            success: true, 
            status: userSub.status 
        });

    } catch (error) {
        console.error("🔥 Error fetching subscription status:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};