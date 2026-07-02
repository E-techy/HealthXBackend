const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { requireJWT } = require('../middlewares/authMiddleware'); // Your JWT middleware

// POST /api/device/sync-token
router.post('/sync-token', requireJWT , deviceController.syncToken);

module.exports = router;