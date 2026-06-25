const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireJWT } = require('../middlewares/authMiddleware');

// Using JWT so only logged-in users can trigger notifications
router.use(requireJWT); 

router.post('/test', notificationController.sendTestNotification);

module.exports = router;