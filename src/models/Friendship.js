const mongoose = require('mongoose');

// Sub-schema for granular toggle control
const permissionSchema = new mongoose.Schema({
    action: { type: String, required: true },
    isActive: { type: Boolean, default: true }
}, { _id: false }); // Disables auto-generating ObjectIds for each array item to keep docs lightweight

const friendshipSchema = new mongoose.Schema({
    ownerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth', 
        required: true, 
        index: true // User A (The one who showed the QR)
    },
    viewerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth', 
        required: true, 
        index: true // User B (The one who scanned)
    },
    permissions: [permissionSchema]
}, { timestamps: true });

// Prevent duplicate friendship mappings in the same direction
friendshipSchema.index({ ownerId: 1, viewerId: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', friendshipSchema);