const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Common fields for Rewards
const rewardSchema = new mongoose.Schema({
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    note: { type: String, trim: true }
}, { _id: false });

// Sub-schema for Victims
const victimSchema = new mongoose.Schema({
    isPublic: { type: Boolean, default: false },
    name: { type: String, trim: true },
    age: { type: Number },
    gender: { type: String, trim: true },
    type: { type: String, trim: true, default: 'Adult' }, // e.g. Minor, Adult, Elderly, Disabled
    identifications: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    lastSeenLocation: { type: String, trim: true },
    address: { type: String, trim: true },
    skinColor: { type: String, trim: true },
    ethnicity: { type: String, trim: true },
    nationality: { type: String, trim: true },
    primaryImage: { type: String }, // URL (Internal or External)
    attachedPhotos: [{ type: String }], // Array of URLs
    reward: rewardSchema,
    extraDetails: { type: String, trim: true }
});

// Sub-schema for Culprits
const culpritSchema = new mongoose.Schema({
    isPublic: { type: Boolean, default: false },
    name: { type: String, trim: true },
    age: { type: Number },
    gender: { type: String, trim: true },
    culpritType: { type: String, trim: true, default: 'Suspect' }, // e.g. Murderer, Thief, Assailant
    identifications: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    lastSeenLocation: { type: String, trim: true },
    address: { type: String, trim: true },
    skinColor: { type: String, trim: true },
    ethnicity: { type: String, trim: true },
    nationality: { type: String, trim: true },
    primaryImage: { type: String },
    attachedPhotos: [{ type: String }],
    reward: rewardSchema,
    extraDetails: { type: String, trim: true }
});

const emergencySessionSchema = new mongoose.Schema({
    emergencyTrackingId: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    title: { type: String, required: [true, 'Emergency title required'], trim: true },
    description: { type: String, trim: true, default: '' },
    
    // Auth & Security
    passcodeHash: { type: String, default: null },
    isPasswordProtected: { type: Boolean, default: false },
    authKey: { type: String, required: true, unique: true, index: true },
    
    // Status & ACL
    status: { type: String, enum: ['ACTIVE', 'PAUSED', 'RESOLVED'], default: 'ACTIVE', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth' }],

    // Public Discovery & Spatial
    isPublicVisibility: { type: Boolean, default: false, index: true },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] } 
    },
    address: {
        city: { type: String, trim: true, index: true },
        state: { type: String, trim: true, index: true },
        country: { type: String, trim: true, index: true }
    },

    // Arrays for multiple entities
    victims: [victimSchema],
    culprits: [culpritSchema],

    // Secure Document Link
    detailedDocUri: { type: String, default: null }

}, { timestamps: true });

emergencySessionSchema.index({ location: '2dsphere' });

emergencySessionSchema.pre('save', async function () {
    if (!this.isModified('passcodeHash') || !this.passcodeHash) return;
    const salt = await bcrypt.genSalt(10);
    this.passcodeHash = await bcrypt.hash(this.passcodeHash, salt);
    this.isPasswordProtected = true;
});

emergencySessionSchema.methods.comparePasscode = async function (candidatePassword) {
    if (!this.passcodeHash) return true;
    return bcrypt.compare(candidatePassword, this.passcodeHash);
};

module.exports = mongoose.model('EmergencySession', emergencySessionSchema);
