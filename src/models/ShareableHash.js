const mongoose = require('mongoose');

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
        required: true 
    }], // e.g., ["ALL"] or ["SET_GOALS", "SEE_NUTRITION"]
    status: { 
        type: String, 
        enum: ['ACTIVE', 'UNACTIVE', 'DELETED'], 
        default: 'ACTIVE' 
    }
}, { timestamps: true });

module.exports = mongoose.model('ShareableHash', shareableHashSchema);