const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { requireJWT } = require('../middlewares/authMiddleware'); // Standard Auth Middleware

// 1. Global Registration & Setup
router.post('/register', requireJWT, vehicleController.registerVehicle);
router.patch('/:vehicleId/telemetry', requireJWT, vehicleController.updateTelemetry);

// 2. Geospatial Discovery (Find public vehicles globally)
router.get('/nearby', vehicleController.findNearby);

// 3. Emergency Integration
router.post('/:vehicleId/attach', requireJWT, vehicleController.attachToEmergency);
router.post('/:vehicleId/detach', requireJWT, vehicleController.detachFromEmergency);
router.get('/emergency/:trackingId', vehicleController.getEmergencySnapshot);

module.exports = router;
