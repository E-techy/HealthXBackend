const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
    planId: { 
        type: String, 
        required: true, 
        unique: true,
        index: true // e.g., 'BASIC_MONTHLY', 'PREMIUM_YEARLY'
    },
    name: { 
        type: String, 
        required: true 
    },
    shortDescription: { 
        type: String, 
        required: true 
    },
    detailedDescription: { 
        type: String, 
        required: true 
    },
    price: { 
        type: Number, 
        required: true // Stored in normal INR (e.g., 499)
    },
    currency: {
        type: String,
        default: 'INR'
    },
    billingCycle: {
        type: String,
        enum: ['MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME'],
        required: true
    },
    features: [{ 
        type: String // Array of features for the UI to display as bullet points
    }],
    isActive: { 
        type: Boolean, 
        default: true // Allows you to hide old plans without deleting them
    }
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);