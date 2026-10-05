const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');

// 1. Create a new emergency session (Generates tracking ID, password hash, magic key, and link)
router.post('/create', emergencyController.create);

// 2. Direct link login (Validates authKey from the shared link, returns session token)
router.post('/join/magic', emergencyController.joinViaMagicKey);

// 3. Manual login (Tracking ID + password)
router.post('/join/credentials', emergencyController.joinViaCredentials);

// 4. Public details check (Checks title, if password is required, status)
router.get('/:emergencyTrackingId/info', emergencyController.getInfo);

module.exports = router;
