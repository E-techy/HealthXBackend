const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { requireJWT } = require('../middlewares/authMiddleware');

// Route: GET /api/config/maps-key
router.get('/maps-key', requireJWT, configController.getMapsApiKey);

module.exports = router;