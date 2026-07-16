const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { requireJWT } = require('../middlewares/authMiddleware');

// 1. IMPORT DELEGATED ACCESS MIDDLEWARE
const { requireDelegatedAccess } = require('../middlewares/delegatedAccessMiddleware');

// Protect both routes with requireJWT, then apply delegated access
router.get(
    '/', 
    requireJWT, 
    requireDelegatedAccess('SEE_SETTINGS'), 
    settingsController.getSettings
);

router.put(
    '/', 
    requireJWT, 
    requireDelegatedAccess('EDIT_SETTINGS'), 
    settingsController.updateSettings
);

module.exports = router;