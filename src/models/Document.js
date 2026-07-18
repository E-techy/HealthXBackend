const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth', 
        required: true,
        index: true 
    },
    documentName: { 
        type: String, 
        required: true 
    },
    documentType: { 
        type: String, 
        required: true // e.g., 'pdf', 'image/jpeg', 'application/msword'
    },
    documentCategory: { 
        type: String, 
        required: true,
        enum: ['HEALTH', 'DIAGNOSTICS', 'NUTRITION_MONTHLY_REPORT', 'PRESCRIPTION', 'OTHER'],
        default: 'OTHER'
    },
    serverPath: { 
        type: String, 
        required: true // Exact path on the physical server
    }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);