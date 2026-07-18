const mongoose = require('mongoose');

const documentAccessSchema = new mongoose.Schema({
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, unique: true },
    isPublic: { type: Boolean, default: false },
    publicKey: { type: String, default: null, sparse: true },
    passwordHash: { type: String, default: null },
    sharedWithUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth' }]
}, { timestamps: true });

// PERFORMANCE INDEX:
// Optimize finding all documents shared with a specific user
documentAccessSchema.index({ sharedWithUsers: 1 });

module.exports = mongoose.model('DocumentAccess', documentAccessSchema);