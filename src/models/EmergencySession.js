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
    passcodeHash: {
        type: String,
        default: null
    },
    isPasswordProtected: {
        type: Boolean,
        default: false
    },
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
        default: null
    }
}, { timestamps: true });

// Pre-save hook: Hash passcode if set or modified
emergencySessionSchema.pre('save', async function () {
    if (!this.isModified('passcodeHash') || !this.passcodeHash) {
        return;
    }
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
