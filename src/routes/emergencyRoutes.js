const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');
const { requireJWT } = require('../middlewares/authMiddleware');
const { requireDelegatedAccess } = require('../middlewares/delegatedAccessMiddleware');
const { requirePoliceJWT } = require('../middlewares/policeAuthMiddleware');

// ==========================================
// USER ROUTES (Android App)
// ==========================================

// High-frequency endpoint for the device to post data
router.post('/log-location', requireJWT, emergencyController.logLocation);

// User manages their emergency contacts
router.post('/contacts', requireJWT, emergencyController.addEmergencyContact);

// ==========================================
// DELEGATED ACCESS ROUTES (Emergency Contacts)
// ==========================================

// A trusted contact views the location. 
// Requires "X-Target-User-Id" header from the Android app.
router.get(
    '/locations/shared', 
    requireJWT, 
    requireDelegatedAccess('SEE_EMERGENCY_LOCATION'), 
    emergencyController.getLiveLocations
);

// ==========================================
// POLICE PORTAL ROUTES (Web Dashboard)
// ==========================================

// Police trigger the remote start of the tracking session
router.post(
    '/police/initiate', 
    requirePoliceJWT, 
    emergencyController.policeInitiateTracking
);

// Police fetch the live stream of data
router.get(
    '/police/locations', 
    requirePoliceJWT, 
    emergencyController.getLiveLocations
);

module.exports = router;