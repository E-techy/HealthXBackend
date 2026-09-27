const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const policeUnitSchema = new mongoose.Schema({
    stationName: { type: String, required: true },
    areaCode: { type: String, required: true, unique: true }, // e.g., "RANCHI_DHURWA_01"
    passwordHash: { type: String, required: true },
    contactNumber: { type: String }
}, { timestamps: true });

policeUnitSchema.pre('save', async function() {
    if (!this.isModified('passwordHash')) return;
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

module.exports = mongoose.model('PoliceUnit', policeUnitSchema);