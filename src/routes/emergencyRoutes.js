const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');
const { requireJWT } = require('../middlewares/authMiddleware');

// ============================================
// OWNER / ADMIN ROUTES (Requires User Auth)
// ============================================

// Create a new emergency session (Current user becomes Owner)
router.post('/create', requireJWT, emergencyController.create);

// Update details (title, description) - Owner Only
router.put('/:id', requireJWT, emergencyController.updateDetails);

// Change status (ACTIVE, PAUSED, RESOLVED) - Owner Only
router.patch('/:id/status', requireJWT, emergencyController.updateStatus);

// Permanently delete emergency - Owner Only
router.delete('/:id', requireJWT, emergencyController.deleteSession);

// Invite users to the emergency (Adds to ACL & emails them) - Owner Only
router.post('/:id/invite', requireJWT, emergencyController.invite);

// ============================================
// PUBLIC & PARTICIPANT ROUTES
// ============================================

// Direct link login (Validates authKey). Requires Bearer token ONLY if the incident has an Access Control List.
router.post('/join/magic', emergencyController.joinViaMagicKey);

// Manual login (Tracking ID + password). Requires Bearer token ONLY if the incident has an Access Control List.
router.post('/join/credentials', emergencyController.joinViaCredentials);

// Public details check (Checks title, if password is required, status)
router.get('/:id/info', emergencyController.getInfo);

module.exports = router;
