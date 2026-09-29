const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const { requireJWT } = require('../middlewares/authMiddleware');

// PRODUCTION ROUTE (Requires login)
router.post('/compute-route', requireJWT, routeController.calculateRoute);

// TESTING ROUTE (No JWT required - used ONLY by testRoutesApi.js)
router.post('/test-compute-route', routeController.calculateRoute);

module.exports = router;