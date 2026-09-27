const mongoose = require('mongoose');

const locationLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true },
    mode: { type: String, enum: ['NORMAL', 'EMERGENCY'], required: true },
    emergencySessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmergencySession', default: null },
    location: {
        type: { type: String, enum: ['Point'], required: true },
        coordinates: { type: [Number], required: true } // Array: [longitude, latitude]
    },
    timestamp: { type: Date, default: Date.now }
}, {
    // THIS IS CRITICAL FOR HIGH LOAD GPS DATA
    timeseries: {
        timeField: 'timestamp',
        metaField: 'userId',
        granularity: 'seconds' // Optimized for 5-10 second intervals
    }
});

// Create a geospatial index for radius queries (e.g., "Find police cars near this point")
locationLogSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('LocationLog', locationLogSchema);