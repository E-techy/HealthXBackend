const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const { requireJWT } = require('../middlewares/authMiddleware');

// Route: POST /api/maps/compute-route
// The client will send origin, destination, options, and mapType in the POST body
router.post('/compute-route', requireJWT, routeController.calculateRoute);

module.exports = router;