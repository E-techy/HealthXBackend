const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { requireJWT } = require('../middlewares/authMiddleware');

// Protect both routes with requireJWT
router.get('/', requireJWT, settingsController.getSettings);
router.put('/', requireJWT, settingsController.updateSettings);

module.exports = router;