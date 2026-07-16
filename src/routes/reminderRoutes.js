const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const { requireJWT } = require('../middlewares/authMiddleware');

// 1. IMPORT DELEGATED ACCESS MIDDLEWARE
const { requireDelegatedAccess } = require('../middlewares/delegatedAccessMiddleware');

// Security Gatekeeper (applies to all routes in this file)
router.use(requireJWT); 

// Advanced Fetching (Read-Only)
router.get(
    '/fetch', 
    requireDelegatedAccess('SEE_REMINDERS'), 
    reminderController.getRemindersAdvanced
);

// Core Sync Engine (Write)
router.post(
    '/sync', 
    requireDelegatedAccess('EDIT_REMINDERS'), 
    reminderController.syncReminders
);

// Creation (Write)
router.post(
    '/', 
    requireDelegatedAccess('EDIT_REMINDERS'), 
    reminderController.createReminders
);

// Updating (Write)
router.put(
    '/bulk-update', 
    requireDelegatedAccess('EDIT_REMINDERS'), 
    reminderController.bulkUpdateReminders
); 

router.put(
    '/:id', 
    requireDelegatedAccess('EDIT_REMINDERS'), 
    reminderController.updateReminder
);              

// Advanced Deletion (Write/Destroy)
router.post(
    '/delete-advanced', 
    requireDelegatedAccess('EDIT_REMINDERS'), 
    reminderController.deleteRemindersAdvanced
);

module.exports = router;