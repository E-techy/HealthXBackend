const express = require('express');
const router = express.Router();
const accessController = require('../controllers/accessController');
const blocklistController = require('../controllers/blocklistController');
const friendshipController = require('../controllers/friendshipController');
const { requireJWT } = require('../middlewares/authMiddleware');

// Protect all access routes
router.use(requireJWT);

// --- HASH ROUTES (Phase 1) ---
router.post('/hash', accessController.createHash);
router.get('/hash', accessController.getAllHashes);
router.patch('/hash/:hashId/status', accessController.updateHashStatus);
router.patch('/hash/:hashId/actions', accessController.updateHashActions); 
router.delete('/hash/:hashId', accessController.deleteHash);

// --- CONNECTION ROUTE (Phase 2) --- 
router.post('/connect/:hashId', friendshipController.connectWithHash);

// --- DASHBOARD / MANAGEMENT ROUTES (Phase 3) ---

// User A viewing people they gave access to
router.get('/friends/granted', friendshipController.getGrantedAccess);

// User B viewing people whose data they can see
router.get('/friends/received', friendshipController.getReceivedAccess);

// User A updating User B's granular permissions
router.patch('/friends/:targetUserId/permissions', friendshipController.updateFriendPermissions);

// Block & Report a user (Works for both A blocking B, or B blocking A)
router.post('/friends/:targetUserId/block', friendshipController.blockAndReportUser);

// --- BLOCKLIST ROUTES ---
router.get('/blocklist', blocklistController.getBlocklistedUsers);
router.delete('/blocklist/:blockedUserId', blocklistController.removeBlockedUser);

module.exports = router;