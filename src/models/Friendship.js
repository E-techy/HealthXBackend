const mongoose = require('mongoose');
const DELEGATED_PERMISSIONS = require('../config/permissions');

const validActions = Object.keys(DELEGATED_PERMISSIONS);

// Sub-schema for granular toggle control
const permissionSchema = new mongoose.Schema({
    action: { 
        type: String, 
        required: true,
        enum: {
            values: validActions,
            message: '"{VALUE}" is not a valid permission action.'
        }
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { _id: false });

const friendshipSchema = new mongoose.Schema({
    ownerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth', 
        required: true, 
        index: true 
    },
    viewerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth', 
        required: true, 
        index: true 
    },
    permissions: [permissionSchema]
}, { timestamps: true });

// Prevent duplicate friendship mappings in the same direction
friendshipSchema.index({ ownerId: 1, viewerId: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', friendshipSchema);