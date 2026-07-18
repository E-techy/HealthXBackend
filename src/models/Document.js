const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true },
    documentName: { type: String, required: true },
    documentType: { type: String, required: true },
    documentCategory: { 
        type: String, 
        required: true,
        enum: ['HEALTH', 'DIAGNOSTICS', 'NUTRITION_MONTHLY_REPORT', 'PRESCRIPTION', 'OTHER'],
        default: 'OTHER'
    },
    serverPath: { type: String, required: true }
}, { timestamps: true });

// PERFORMANCE INDEXES: 
// 1. Optimize fetching a user's docs sorted by time
documentSchema.index({ userId: 1, createdAt: -1 });
// 2. Optimize fetching a user's docs filtered by category and sorted by time
documentSchema.index({ userId: 1, documentCategory: 1, createdAt: -1 });

module.exports = mongoose.model('Document', documentSchema);