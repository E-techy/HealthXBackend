const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth', 
        required: true, 
        unique: true // One status per user
    },
    status: { 
        type: String, 
        enum: ['FREE', 'PRO', 'ULTRA'], // Exactly matching your Kotlin expectations
        default: 'FREE' 
    }
}, { timestamps: true });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);