const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');
const messageController = require('../controllers/emergencyMessageController');
const { requireJWT } = require('../middlewares/authMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware'); // NEW

// ============================================
// OWNER / ADMIN ROUTES
// ============================================
// Create, manage, and fetch OWNED emergencies
router.post('/create', requireJWT, emergencyController.create);
router.get('/my-list', requireJWT, emergencyController.getUserEmergencies); // NEW
router.put('/:id', requireJWT, emergencyController.updateDetails);
router.patch('/:id/status', requireJWT, emergencyController.updateStatus);
router.delete('/:id', requireJWT, emergencyController.deleteSession);
router.post('/:id/invite', requireJWT, emergencyController.invite);

// ============================================
// FILE UPLOAD & SECURE DOCUMENT ACCESS
// ============================================
// Accepts files. Field names should be: victimImage, culpritImage, or detailedDoc
router.post('/upload', requireJWT, uploadMiddleware.any(), emergencyController.uploadFiles); // NEW

// Secure Download: Validates via ACL or Public flag before streaming the file
router.get('/:id/document', emergencyController.downloadSecureDocument); // NEW

// ============================================
// PUBLIC DISCOVERY ROUTES
// ============================================
// Must be declared BEFORE `/:id/info` routes to avoid param collision
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
