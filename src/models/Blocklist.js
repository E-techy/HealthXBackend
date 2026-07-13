const mongoose = require('mongoose');

const blocklistSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth', 
        required: true, 
        index: true 
    },
    blockedUserId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth', 
        required: true 
    }
}, { timestamps: true });

// Prevent duplicate block entries
blocklistSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });

module.exports = mongoose.model('Blocklist', blocklistSchema);