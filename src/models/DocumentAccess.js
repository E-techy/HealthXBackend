const mongoose = require('mongoose');

const documentAccessSchema = new mongoose.Schema({
    documentId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Document', 
        required: true,
        unique: true
    },
    isPublic: { 
        type: Boolean, 
        default: false 
    },
    publicKey: { 
        type: String, 
        default: null,
        sparse: true // Allows nulls while ensuring non-nulls are unique
    },
    passwordHash: { 
        type: String, 
        default: null 
    },
    sharedWithUsers: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth' 
    }]
}, { timestamps: true });

module.exports = mongoose.model('DocumentAccess', documentAccessSchema);