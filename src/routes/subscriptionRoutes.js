const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { requireJWT } = require('../middlewares/authMiddleware');

// =======================
// PUBLIC ROUTES
// =======================
// Give all available plans
router.get('/plans', subscriptionController.getAllPlans);
// Give details of a specific plan
router.get('/plans/:id', subscriptionController.getPlanById);

// =======================
// PROTECTED ROUTES 
// =======================
// Apply the JWT middleware to all routes below this line
// If no JWT is present, requireJWT will automatically send a 401 code with "Please log in again."
router.use(requireJWT); 

router.post('/order/create', subscriptionController.createOrder);
router.post('/order/cancel', subscriptionController.cancelOrder);
router.post('/order/verify', subscriptionController.verifyPayment);

module.exports = router;