const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { requireJWT } = require('../middlewares/authMiddleware');

// 1. IMPORT DELEGATED ACCESS MIDDLEWARE
const { requireDelegatedAccess } = require('../middlewares/delegatedAccessMiddleware');

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
router.use(requireJWT); 

// 🚨 CRITICAL SECURITY GUARDRAIL 🚨
// Do NOT add delegated access to financial routes. 
// Only the true account owner (identified by requireJWT) can make payments.
router.post('/order/create', subscriptionController.createOrder);
router.post('/order/cancel', subscriptionController.cancelOrder);
router.post('/order/verify', subscriptionController.verifyPayment);

// It IS safe to let a delegated user check the subscription status
router.get(
    '/status', 
    requireDelegatedAccess('SEE_SUBSCRIPTION'), 
    subscriptionController.getSubscriptionStatus
);

module.exports = router;