const mongoose = require('mongoose');
const DELEGATED_PERMISSIONS = require('../config/permissions'); // Adjust the path if needed

// Dynamically extract the valid action keys (e.g., ['SEE_NUTRITION', 'EDIT_NUTRITION', ...])
const validActions = Object.keys(DELEGATED_PERMISSIONS);

const shareableHashSchema = new mongoose.Schema({
    hashId: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true 
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth', 
        required: true, 
        index: true 
    },
    actions: [{ 
        type: String, 
        required: true,
        enum: {
            values: validActions,
            message: '"{VALUE}" is not a valid permission action.'
        }
    }],
    status: { 
        type: String, 
        enum: ['ACTIVE', 'UNACTIVE', 'DELETED'], 
        default: 'ACTIVE' 
    }
}, { timestamps: true });

module.exports = mongoose.model('ShareableHash', shareableHashSchema);