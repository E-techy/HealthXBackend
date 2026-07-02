const express = require('express');
const router = express.Router();
const { syncToken } = require('../controllers/deviceController');
const { requireJWT } = require('../middlewares/authMiddleware'); // Verify this matches your auth middleware

// POST /api/device/sync-token
router.post('/sync-token', requireJWT, syncToken);

module.exports = router;