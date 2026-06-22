const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userAuthSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    mfaEnabled: { type: Boolean, default: false },
    lastLoginTimestamp: { type: Date },
    accountStatus: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'], default: 'ACTIVE' },
    
    // Temporary fields for OTP
    otp: { type: String },
    otpExpires: { type: Date }
}, { timestamps: true });

// Hash password before saving
userAuthSchema.pre('save', async function() {
    if (!this.isModified('passwordHash')) return;
    
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

module.exports = mongoose.model('UserAuth', userAuthSchema);