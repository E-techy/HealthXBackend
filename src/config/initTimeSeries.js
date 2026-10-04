const mongoose = require('mongoose');

const initTimeSeriesCollection = async () => {
    try {
        const db = mongoose.connection.db;
        const collections = await db.listCollections({ name: 'vehicle_location_trails' }).toArray();

        if (collections.length === 0) {
            await db.createCollection('vehicle_location_trails', {
                timeseries: {
                    timeField: 'timestamp',
                    metaField: 'metadata',
                    granularity: 'seconds'
                },
                expireAfterSeconds: 60 * 60 * 24 * 30 // Retain 30 days of breadcrumb trail
            });
            console.log('✔ TimeSeries collection "vehicle_location_trails" initialized.');
        } else {
            console.log('✔ TimeSeries collection "vehicle_location_trails" already exists.');
        }

        // Ensure compound index for fast temporal filtering
        await db.collection('vehicle_location_trails').createIndex({
            'metadata.emergencyTrackingId': 1,
            'metadata.vehicleId': 1,
            'timestamp': -1
        });
    } catch (error) {
        console.error('✘ Error initializing TimeSeries collection:', error.message);
    }
};

module.exports = initTimeSeriesCollection;
