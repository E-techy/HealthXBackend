const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const { requireJWT } = require('../middlewares/authMiddleware'); // Assuming this is your auth middleware

// Apply JWT middleware to all reminder routes
router.use(requireJWT); 

router.post('/sync', reminderController.syncReminders);
router.post('/', reminderController.createReminders);
router.put('/:id', reminderController.updateReminder);

// Optional: You likely still need these standard routes for the UI
// router.get('/', reminderController.getAllReminders);
// router.delete('/', reminderController.deleteReminders);

module.exports = router;