const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { requireJWT } = require('../middlewares/authMiddleware');

// All tracking routes require the user to be authenticated
router.use(requireJWT);

// ============================================
// REDIS: HIGH-FREQUENCY LIVE TRACKING
// ============================================

// Push instantaneous current location (Fast path)
router.post('/live', trackingController.updateLiveLocation);

// Fetch current location for a specific list of vehicles
router.post('/live/batch', trackingController.getBatchLiveLocations);

// Fetch current location for ALL vehicles attached to this emergency
router.get('/live/emergency/:emergencyTrackingId', trackingController.getAllLiveLocations);

// ============================================
// MONGODB: HISTORICAL TRAIL (TIME-SERIES)
// ============================================

// Bulk upload buffered locations (e.g., sent by the vehicle every 60 seconds)
router.post('/trail/bulk', trackingController.bulkSaveTrail);

// Fetch historical path. 
// Query Params: ?hours=1 (default) OR ?startTime=TIMESTAMP&endTime=TIMESTAMP
router.get('/trail/:emergencyTrackingId/:vehicleId', trackingController.getTrail);

module.exports = router;
