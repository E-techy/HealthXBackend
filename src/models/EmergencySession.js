const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const emergencySessionSchema = new mongoose.Schema({
    emergencyTrackingId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        uppercase: true,
        trim: true
    },
    title: {
        type: String,
        required: [true, 'Emergency title or incident name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    // Hashed password for standard login
    passcodeHash: {
        type: String,
        default: null
    },
    isPasswordProtected: {
        type: Boolean,
        default: false
    },
    // Magic token for instant link-based joining
    authKey: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'PAUSED', 'RESOLVED'],
        default: 'ACTIVE',
        index: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserAuth',
        default: null // Optional: can be null if emergency is initialized by unauthenticated device
    }
}, { timestamps: true });

// Pre-save hook: Hash passcode if set or modified
emergencySessionSchema.pre('save', async function (next) {
    if (!this.isModified('passcodeHash') || !this.passcodeHash) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.passcodeHash = await bcrypt.hash(this.passcodeHash, salt);
    this.isPasswordProtected = true;
    next();
});

// Compare password helper
emergencySessionSchema.methods.comparePasscode = async function (candidatePassword) {
    if (!this.passcodeHash) return true; // If no password was configured
    return bcrypt.compare(candidatePassword, this.passcodeHash);
};

module.exports = mongoose.model('EmergencySession', emergencySessionSchema);
