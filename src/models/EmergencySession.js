const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const emergencySessionSchema = new mongoose.Schema({
    emergencyTrackingId: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    title: { type: String, required: [true, 'Emergency title or incident name is required'], trim: true },
    description: { type: String, trim: true, default: '' },
    
    // Auth & Security
    passcodeHash: { type: String, default: null },
    isPasswordProtected: { type: Boolean, default: false },
    authKey: { type: String, required: true, unique: true, index: true },
    
    // Status & ACL
    status: { type: String, enum: ['ACTIVE', 'PAUSED', 'RESOLVED'], default: 'ACTIVE', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true },
    allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth' }],

    // ==========================================
    // NEW: PUBLIC DISCOVERY & METADATA
    // ==========================================
    
    isPublicVisibility: { type: Boolean, default: false, index: true },

    // Spatial Indexing for Radius Search
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    },

    // Regional Filters
    address: {
        city: { type: String, trim: true, index: true },
        state: { type: String, trim: true, index: true },
        country: { type: String, trim: true, index: true }
    },

    victimMetadata: {
        isPublic: { type: Boolean, default: false }, 
        name: { type: String, trim: true },
        age: { type: Number },                     // <-- ADD THIS
        gender: { type: String, trim: true },      // <-- ADD THIS
        imageUri: { type: String }, 
        rewardAmount: { type: Number, default: 0 },
        rewardCurrency: { type: String, default: 'USD' },
        extraDetails: { type: String, trim: true } 
    }

}, { timestamps: true });

// Required for Geospatial Radius Searches
emergencySessionSchema.index({ location: '2dsphere' });

// Pre-save hook: Hash passcode if set or modified
emergencySessionSchema.pre('save', async function () {
    if (!this.isModified('passcodeHash') || !this.passcodeHash) return;
    
    const salt = await bcrypt.genSalt(10);
    this.passcodeHash = await bcrypt.hash(this.passcodeHash, salt);
    this.isPasswordProtected = true;
});

// Compare password helper
emergencySessionSchema.methods.comparePasscode = async function (candidatePassword) {
    if (!this.passcodeHash) return true;
    return bcrypt.compare(candidatePassword, this.passcodeHash);
};

module.exports = mongoose.model('EmergencySession', emergencySessionSchema);
