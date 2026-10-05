const mongoose = require('mongoose');

const vehicleBreadcrumbSchema = new mongoose.Schema({
    timestamp: { type: Date, required: true, default: Date.now },
    metadata: {
        emergencyTrackingId: { type: String, required: true },
        vehicleId: { type: String, required: true }
    },
    location: {
        type: { type: String, enum: ['Point'], required: true, default: 'Point' },
        coordinates: { type: [Number], required: true } // [longitude, latitude]
    },
    altitude: { type: Number },
    speed: { type: Number },
    heading: { type: Number, min: 0, max: 360 }
}, { 
    timeseries: {
        timeField: 'timestamp',
        metaField: 'metadata',
        granularity: 'seconds'
    }
});

module.exports = mongoose.model('VehicleBreadcrumb', vehicleBreadcrumbSchema, 'vehicle_location_trails');
