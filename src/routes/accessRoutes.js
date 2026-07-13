const express = require('express');
const router = express.Router();
const accessController = require('../controllers/accessController');
const { requireJWT } = require('../middlewares/authMiddleware');

// Protect all access/hash routes
router.use(requireJWT);

// Create a new public hash
router.post('/hash', accessController.createHash);

// Get all generated hashes for the user
router.get('/hash', accessController.getAllHashes);

// Update status of a specific hash (Active/Unactive)
router.patch('/hash/:hashId/status', accessController.updateHashStatus);

// Completely delete a hash
router.delete('/hash/:hashId', accessController.deleteHash);

module.exports = router;