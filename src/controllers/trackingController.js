const trackingService = require('../services/trackingService');
const EmergencySession = require('../models/EmergencySession');

// --- Security Helper ---
// Ensures the user requesting/pushing data is actually authorized for this emergency
const verifyEmergencyAccess = async (emergencyTrackingId, userId) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: emergencyTrackingId.toUpperCase() });
    
    if (!emergency) throw new Error('Emergency session not found.');
    if (emergency.status !== 'ACTIVE') throw new Error('Emergency session is no longer active.');

    // If ACL is empty, it's open to anyone logged in. 
    // If ACL exists, check if user is Creator or in the allowedUsers list.
    if (emergency.allowedUsers && emergency.allowedUsers.length > 0) {
        const isCreator = emergency.createdBy.toString() === userId.toString();
        const isAllowed = emergency.allowedUsers.includes(userId);
        
        if (!isCreator && !isAllowed) {
            throw new Error('Access denied. You are not authorized for this incident.');
        }
    }
    return true;
};

// 1. Update Live Location (Redis)
exports.updateLiveLocation = async (req, res) => {
    try {
        const { emergencyTrackingId, vehicleId, locationData } = req.body;
        
        await verifyEmergencyAccess(emergencyTrackingId, req.user.id);

        if (!locationData.longitude || !locationData.latitude) {
            return res.status(400).json({ success: false, message: 'Longitude and latitude are required.' });
        }

        const result = await trackingService.updateLiveLocation(emergencyTrackingId, vehicleId, locationData);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(403).json({ success: false, message: error.message });
    }
};

// 2. Fetch Live Locations for Specific Vehicles (Redis)
exports.getBatchLiveLocations = async (req, res) => {
    try {
        const { emergencyTrackingId, vehicleIds } = req.body; // vehicleIds is an array
        
        await verifyEmergencyAccess(emergencyTrackingId, req.user.id);

        const locations = await trackingService.getBatchLiveLocations(emergencyTrackingId, vehicleIds);
        res.status(200).json({ success: true, count: locations.length, data: locations });
    } catch (error) {
        res.status(403).json({ success: false, message: error.message });
    }
};

// 3. Fetch All Live Locations for an Emergency (Redis)
exports.getAllLiveLocations = async (req, res) => {
    try {
        const { emergencyTrackingId } = req.params;
        
        await verifyEmergencyAccess(emergencyTrackingId, req.user.id);

        const locations = await trackingService.getAllLiveLocationsForEmergency(emergencyTrackingId);
        res.status(200).json({ success: true, count: locations.length, data: locations });
    } catch (error) {
        res.status(403).json({ success: false, message: error.message });
    }
};

// 4. Bulk Save Buffered Trail Data (MongoDB)
exports.bulkSaveTrail = async (req, res) => {
    try {
        const { emergencyTrackingId, vehicleId, breadcrumbs } = req.body;
        
        await verifyEmergencyAccess(emergencyTrackingId, req.user.id);

        if (!Array.isArray(breadcrumbs) || breadcrumbs.length === 0) {
            return res.status(400).json({ success: false, message: 'Valid breadcrumbs array required.' });
        }

        const result = await trackingService.bulkSaveTrail(emergencyTrackingId, vehicleId, breadcrumbs);
        res.status(201).json({ success: true, message: `Saved ${result.insertedCount} trailing points.` });
    } catch (error) {
        res.status(403).json({ success: false, message: error.message });
    }
};

// 5. Fetch Historical Trail (MongoDB)
exports.getTrail = async (req, res) => {
    try {
        const { emergencyTrackingId, vehicleId } = req.params;
        let { hours, startTime, endTime } = req.query;

        await verifyEmergencyAccess(emergencyTrackingId, req.user.id);

        // Default to last 1 hour if no times provided
        if (!startTime || !endTime) {
            const rangeHours = parseFloat(hours) || 1;
            endTime = new Date();
            startTime = new Date(endTime.getTime() - (rangeHours * 60 * 60 * 1000));
        }

        const trail = await trackingService.getVehicleTrail(emergencyTrackingId, vehicleId, startTime, endTime);
        res.status(200).json({ success: true, count: trail.length, data: trail });
    } catch (error) {
        res.status(403).json({ success: false, message: error.message });
    }
};
