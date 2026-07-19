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
    serverPath: { type: String, required: true },

    // --- QUICK UI SUMMARY FIELDS ---
    // These allow the frontend to instantly show document status on the list view
    isPublic: { type: Boolean, default: false },
    isPasswordProtected: { type: Boolean, default: false },
    sharedCount: { type: Number, default: 0 }

}, { timestamps: true });

// PERFORMANCE INDEXES: 
documentSchema.index({ userId: 1, createdAt: -1 });
documentSchema.index({ userId: 1, documentCategory: 1, createdAt: -1 });

module.exports = mongoose.model('Document', documentSchema);