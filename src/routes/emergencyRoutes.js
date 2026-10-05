const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');
const messageController = require('../controllers/emergencyMessageController'); // NEW
const { requireJWT } = require('../middlewares/authMiddleware');

// ============================================
// OWNER / ADMIN ROUTES
// ============================================
router.post('/create', requireJWT, emergencyController.create);
router.put('/:id', requireJWT, emergencyController.updateDetails);
router.patch('/:id/status', requireJWT, emergencyController.updateStatus);
router.delete('/:id', requireJWT, emergencyController.deleteSession);
router.post('/:id/invite', requireJWT, emergencyController.invite);

// ============================================
// PUBLIC & PARTICIPANT ROUTES
// ============================================
router.post('/join/magic', emergencyController.joinViaMagicKey);
router.post('/join/credentials', emergencyController.joinViaCredentials);
router.get('/:id/info', emergencyController.getInfo);

// ============================================
// 📣 LIVE BROADCAST ROUTES (New)
// ============================================
// Global broadcast to ALL listeners
router.post('/broadcast/global', requireJWT, messageController.sendGlobalBroadcast);

// Room-specific broadcasts
router.post('/:emergencyTrackingId/broadcast/custom', requireJWT, messageController.sendCustomMessage);
router.post('/:emergencyTrackingId/broadcast/pin', requireJWT, messageController.sendPinnedMessage);

module.exports = router;
