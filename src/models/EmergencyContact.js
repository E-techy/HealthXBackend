const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true }, // The person in danger
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true }, // The trusted friend
    relation: { type: String, default: 'FAMILY' }
}, { timestamps: true });

// Ensure a user can only add a specific contact once
emergencyContactSchema.index({ ownerId: 1, contactId: 1 }, { unique: true });

module.exports = mongoose.model('EmergencyContact', emergencyContactSchema);