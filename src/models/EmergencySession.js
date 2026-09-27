const mongoose = require('mongoose');

const emergencySessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true },
    initiatedBy: { type: String, enum: ['USER', 'POLICE'], required: true },
    policeUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'PoliceUnit', default: null }, // If police initiated or claimed it
    status: { type: String, enum: ['ACTIVE', 'RESOLVED'], default: 'ACTIVE' },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('EmergencySession', emergencySessionSchema);