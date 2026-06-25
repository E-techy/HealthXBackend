const express = require('express');
const router = express.Router();
const { registerDevice } = require('../controllers/deviceController');
const { authenticateToken } = require('../middlewares/authMiddleware'); // Your JWT middleware

// POST /api/devices/register
router.post('/register', authenticateToken, registerDevice);

module.exports = router;