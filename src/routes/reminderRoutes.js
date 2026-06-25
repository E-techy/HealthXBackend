const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const { requireJWT } = require('../middlewares/authMiddleware');

// Security Gatekeeper
router.use(requireJWT); 

// Core Sync Engine
router.post('/sync', reminderController.syncReminders);

// Advanced Fetching (Using GET with query params)
router.get('/fetch', reminderController.getRemindersAdvanced);

// Creation
router.post('/', reminderController.createReminders);

// Updating
router.put('/bulk-update', reminderController.bulkUpdateReminders); // Bulk
router.put('/:id', reminderController.updateReminder);              // Single

// Advanced Deletion (Using POST so we can pass a complex JSON body)
router.post('/delete-advanced', reminderController.deleteRemindersAdvanced);

module.exports = router;