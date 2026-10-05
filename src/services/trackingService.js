const redis = require('../config/redis');
const VehicleBreadcrumb = require('../models/VehicleBreadcrumb');
const VehicleRegistration = require('../models/VehicleRegistration');
const EmergencySession = require('../models/EmergencySession');

// Helper to construct Redis keys
const getRedisKey = (emergencyId, vehicleId) => `em:${emergencyId.toUpperCase()}:veh:${vehicleId}:loc`;

/**
 * ---------------------------------------------------------
 * FAST PATH (REDIS) - LIVE LOCATIONS
 * ---------------------------------------------------------
 */

// 1. Update single live location in Redis
const updateLiveLocation = async (emergencyTrackingId, vehicleId, locationData) => {
    const key = getRedisKey(emergencyTrackingId, vehicleId);
    
    // Store as Hash in Redis for fast individual field updates/reads
    await redis.hset(key, {
        lng: locationData.longitude,
        lat: locationData.latitude,
        alt: locationData.altitude || 0,
        speed: locationData.speed || 0,
        heading: locationData.heading || 0,
        timestamp: locationData.timestamp || Date.now()
    });

    // Set TTL (Time To Live) to 24 hours so stale data auto-clears
    await redis.expire(key, 86400);
    
    return { success: true, timestamp: locationData.timestamp };
};

// 2. Get batch live locations for specific vehicles
const getBatchLiveLocations = async (emergencyTrackingId, vehicleIds) => {
    // Use Redis Pipeline to fetch multiple keys in a single network roundtrip
    const pipeline = redis.pipeline();
    
    vehicleIds.forEach(vId => {
        pipeline.hgetall(getRedisKey(emergencyTrackingId, vId));
    });

    const results = await pipeline.exec();
    
    const locations = [];
    results.forEach((result, index) => {
        const [err, data] = result;
        if (!err && data && Object.keys(data).length > 0) {
            locations.push({
                vehicleId: vehicleIds[index],
                longitude: parseFloat(data.lng),
                latitude: parseFloat(data.lat),
                altitude: parseFloat(data.alt),
                speed: parseFloat(data.speed),
                heading: parseFloat(data.heading),
                timestamp: parseInt(data.timestamp, 10)
            });
        }
    });

    return locations;
};

// 3. Get all live locations for an entire emergency session
const getAllLiveLocationsForEmergency = async (emergencyTrackingId) => {
    // First, find all vehicles currently attached to this emergency
    const attachedVehicles = await VehicleRegistration.find({ 
        activeEmergencies: emergencyTrackingId.toUpperCase(),
        connectionStatus: 'CONNECTED'
    }).select('vehicleId');

    const vehicleIds = attachedVehicles.map(v => v.vehicleId);
    
    if (vehicleIds.length === 0) return [];

    // Then fetch their live locations using the batch method
    return await getBatchLiveLocations(emergencyTrackingId, vehicleIds);
};

/**
 * ---------------------------------------------------------
 * AUDIT PATH (MONGODB) - HISTORICAL TRAILS
 * ---------------------------------------------------------
 */

// 4. Bulk save buffered trail data (e.g., client sends 60 points every minute)
const bulkSaveTrail = async (emergencyTrackingId, vehicleId, breadcrumbs) => {
    const docs = breadcrumbs.map(b => ({
        timestamp: new Date(b.timestamp),
        metadata: {
            emergencyTrackingId: emergencyTrackingId.toUpperCase(),
            vehicleId: vehicleId
        },
        location: {
            type: 'Point',
            coordinates: [b.longitude, b.latitude] // GeoJSON format: [lng, lat]
        },
        altitude: b.altitude || 0,
        speed: b.speed || 0,
        heading: b.heading || 0
    }));

    // Efficient bulk insert into Time-Series collection
    await VehicleBreadcrumb.insertMany(docs);
    return { insertedCount: docs.length };
};

// 5. Query historical trail for a specific vehicle
const getVehicleTrail = async (emergencyTrackingId, vehicleId, startTime, endTime) => {
    const query = {
        'metadata.emergencyTrackingId': emergencyTrackingId.toUpperCase(),
        'metadata.vehicleId': vehicleId,
        timestamp: { $gte: new Date(startTime),$lte: new Date(endTime) }
    };

    // Sorted oldest to newest to form a continuous path
    const trail = await VehicleBreadcrumb.find(query)
        .sort({ timestamp: 1 })
        .select('timestamp location altitude speed heading -_id');

    // Format output for easier client consumption
    return trail.map(point => ({
        longitude: point.location.coordinates[0],
        latitude: point.location.coordinates[1],
        altitude: point.altitude,
        speed: point.speed,
        heading: point.heading,
        timestamp: point.timestamp
    }));
};

module.exports = {
    updateLiveLocation,
    getBatchLiveLocations,
    getAllLiveLocationsForEmergency,
    bulkSaveTrail,
    getVehicleTrail
};
