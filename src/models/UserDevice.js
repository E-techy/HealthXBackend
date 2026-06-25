const mongoose = require('mongoose');

const userDeviceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    deviceId: { type: String, required: true }, // e.g., Android ANDROID_ID or iOS IDFV
    deviceName: { type: String }, // e.g., "Samsung Galaxy S23"
    fcmToken: { type: String, required: true },
    
    // Key params to keep track of working vs dead tokens
    isActive: { type: Boolean, default: true }, 
    
    // Using Epoch numbers to match your architecture
    installedAt: { type: Number, default: () => Date.now() },
    lastActiveAt: { type: Number, default: () => Date.now() }
}, { 
    timestamps: false, // Disabling default timestamps since we use explicit Epoch numbers
    versionKey: false 
});

// CRITICAL INDEX: Ensures a user only has one active token per specific device.
// When the user logs in or refreshes their token, you can do an upsert on this combination.
userDeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

// Optional: Index to quickly find all active tokens for a specific user
userDeviceSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('UserDevice', userDeviceSchema);