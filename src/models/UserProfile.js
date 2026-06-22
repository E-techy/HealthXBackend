const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true },
    name: { type: String, required: true },
    profileImageUri: { type: String, default: null },
    gender: { type: String, default: 'UNSPECIFIED' },
    dateOfBirth: { type: Date },
    
    // Storing complex objects as embedded JSON documents
    contactInfo: { type: Object, default: {} },
    vitalStats: { type: Object, default: {} },
    medicalHistory: { type: Object, default: {} },
    
    activeMedications: [{ type: Object }],
    historicalMedications: [{ type: Object }],
    
    encryptedApiKey: { type: String, default: null },
    ownedChatIds: [{ type: String }],
    
    lastSyncTime: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('UserProfile', userProfileSchema);