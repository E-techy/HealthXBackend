const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth', 
        required: true 
    },
    subscriptionPlanId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'SubscriptionPlan', 
        required: true 
    },
    razorpayOrderId: { 
        type: String, 
        required: true,
        unique: true
    },
    razorpayPaymentId: { 
        type: String // Populated after successful payment
    },
    amount: { 
        type: Number, 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['CREATED', 'SUCCESS', 'FAILED', 'CANCELLED'], 
        default: 'CREATED' 
    }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);