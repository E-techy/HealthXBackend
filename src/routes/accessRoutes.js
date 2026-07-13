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

// ... existing access routes ...
const blocklistController = require('../controllers/blocklistController');

// Get all blocked users (returns userId, name, profileImageUri)
router.get('/blocklist', blocklistController.getBlocklistedUsers);

// Remove a user from the blocklist
router.delete('/blocklist/:blockedUserId', blocklistController.removeBlockedUser);

module.exports = router;