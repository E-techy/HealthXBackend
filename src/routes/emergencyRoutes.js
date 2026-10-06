const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');
const messageController = require('../controllers/emergencyMessageController');
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
// PUBLIC DISCOVERY ROUTES (NEW)
// ============================================
// Must be declared before `/:id` routes
router.get('/search', emergencyController.searchPublic);

// ============================================
// PUBLIC & PARTICIPANT AUTHENTICATION
// ============================================
router.post('/join/magic', emergencyController.joinViaMagicKey);
router.post('/join/credentials', emergencyController.joinViaCredentials);
router.get('/:id/info', emergencyController.getInfo);

// ============================================
// LIVE BROADCAST ROUTES (Sockets)
// ============================================
router.post('/broadcast/global', requireJWT, messageController.sendGlobalBroadcast);
router.post('/:emergencyTrackingId/broadcast/custom', requireJWT, messageController.sendCustomMessage);
router.post('/:emergencyTrackingId/broadcast/pin', requireJWT, messageController.sendPinnedMessage);

module.exports = router;
