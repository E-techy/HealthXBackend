const vehicleService = require('../services/vehicleService');

exports.registerVehicle = async (req, res) => {
    try {
        const vehicle = await vehicleService.registerOrUpdateVehicle(req.user.id, req.body);
        res.status(200).json({ success: true, message: 'Vehicle registered/updated.', data: vehicle });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.attachToEmergency = async (req, res) => {
    try {
        const { emergencyTrackingId } = req.body;
        const vehicle = await vehicleService.attachToEmergency(req.params.vehicleId, emergencyTrackingId, req.user.id);
        res.status(200).json({ success: true, message: 'Attached to emergency.', data: vehicle });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.detachFromEmergency = async (req, res) => {
    try {
        const { emergencyTrackingId } = req.body;
        const vehicle = await vehicleService.detachFromEmergency(req.params.vehicleId, emergencyTrackingId, req.user.id);
        res.status(200).json({ success: true, message: 'Detached from emergency.', data: vehicle });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateTelemetry = async (req, res) => {
    try {
        const vehicle = await vehicleService.updateTelemetry(req.params.vehicleId, req.user.id, req.body);
        res.status(200).json({ success: true, message: 'Telemetry updated.', data: vehicle });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.findNearby = async (req, res) => {
    try {
        const lng = parseFloat(req.query.lng);
        const lat = parseFloat(req.query.lat);
        const radius = parseFloat(req.query.radius) || 10; // Default 10km

        if (isNaN(lng) || isNaN(lat)) {
            return res.status(400).json({ success: false, message: 'Valid lng and lat query parameters are required.' });
        }

        const vehicles = await vehicleService.findNearbyPublicVehicles(lng, lat, radius);
        res.status(200).json({ success: true, count: vehicles.length, data: vehicles });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getEmergencySnapshot = async (req, res) => {
    try {
        const snapshot = await vehicleService.getEmergencySnapshot(req.params.trackingId);
        res.status(200).json({ success: true, data: snapshot });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
