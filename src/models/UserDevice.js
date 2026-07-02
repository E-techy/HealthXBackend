const mongoose = require('mongoose');

const userDeviceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    deviceId: { type: String, required: true }, // Android ANDROID_ID or custom UUID
    deviceName: { type: String }, 
    fcmToken: { type: String, required: true },
    
    isActive: { type: Boolean, default: true }, 
    
    // Using Epoch numbers
    installedAt: { type: Number, default: () => Date.now() },
    lastSyncTime: { type: Number, default: () => Date.now() } 
}, { 
    timestamps: false, 
    versionKey: false 
});

// CRITICAL INDEX: 
// - If User A logs in on Device X, it creates/updates a document.
// - If User B logs in on Device X, it creates a separate document (same deviceId, different userId).
// - If User A logs in on Device Y, it creates a separate document (different deviceId, same userId).
userDeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
userDeviceSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('UserDevice', userDeviceSchema);