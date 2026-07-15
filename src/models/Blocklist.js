const mongoose = require('mongoose');

const blocklistSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth', 
        required: true, 
        index: true // The person who clicked "Block"
    },
    blockedUserId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth', 
        required: true // The person being blocked
    },
    reason: {
        type: String,
        enum: ['SPAM', 'INAPPROPRIATE_BEHAVIOR', 'NO_LONGER_FRIENDS', 'PRIVACY_CONCERN', 'OTHER'],
        required: true,
        default: 'OTHER'
    },
    notes: {
        type: String, // Optional detailed explanation from the user
        maxLength: 500
    }
}, { timestamps: true });

// Prevent duplicate block entries
blocklistSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });

module.exports = mongoose.model('Blocklist', blocklistSchema);