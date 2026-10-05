const mongoose = require('mongoose');

const vehicleRegistrationSchema = new mongoose.Schema({
    vehicleId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true },
    
    // Global Visibility Flag
    isPublic: { type: Boolean, default: false },
    
    // Spatial Indexing for Radius Queries
    lastKnownLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    },

    // Array of emergencies this vehicle is currently responding to
    activeEmergencies: [{ type: String, uppercase: true }],
    
    identity: {
        vehicleName: { type: String, required: true },
        vehicleType: { 
            type: String, 
            enum: ['AMBULANCE', 'POLICE', 'AEROPLANE', 'FIRE_TRUCK', 'VICTIM_RELATIVE', 'VICTIM_FATHER', 'VICTIM_MOTHER', 'OTHER'],
            default: 'OTHER'
        },
        vehicleIcon: { type: String }, 
        licensePlate: { type: String },
        model: { type: String }
    },
    
    crew: {
        driverName: { type: String, required: true },
        teamName: { type: String },
        members: [{
            fullName: String,
            role: String,
            ssnEncrypted: String, // Kept out of APIs, decrypted only when strictly needed
            ssnMasked: String     // Safe for UI (e.g. ***-**-6789)
        }]
    },
    
    telemetry: {
        fuelPercentage: { type: Number, min: 0, max: 100 },
        batteryPercentage: { type: Number, min: 0, max: 100 },
        topSpeed: { type: Number },
        assignedTask: { type: String }
    },
    
    connectionStatus: { type: String, enum: ['CONNECTED', 'DISCONNECTED'], default: 'DISCONNECTED' }

}, { timestamps: true });

// Required for Geospatial Search ($geoNear)
vehicleRegistrationSchema.index({ lastKnownLocation: '2dsphere' });

module.exports = mongoose.model('VehicleRegistration', vehicleRegistrationSchema);
