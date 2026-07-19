const express = require('express');
const router = express.Router();
const docsController = require('../controllers/docsController');
const { requireJWT } = require('../middlewares/authMiddleware');
const uploadDocs = require('../middlewares/uploadDocsMiddleware');

// === 1. UPLOAD (Requires Auth) ===
// 'documentFile' is the key the Android app will use in its Multipart/Form-Data request
router.post('/upload', requireJWT, uploadDocs.single('documentFile'), docsController.uploadDocument);

// Get logged-in user's documents
router.get('/my-docs', requireJWT, docsController.getMyDocuments);

// Get documents shared explicitly with the logged-in user
router.get('/shared-with-me', requireJWT, docsController.getSharedWithMe);

// === 2. OWNER MANAGEMENT (Requires Auth) ===
router.post('/:documentId}/make-public', requireJWT, docsController.makePublic);
router.post('/:documentId}/set-password', requireJWT, docsController.setPassword);
router.post('/:documentId}/share', requireJWT, docsController.shareWithUser);
// Get access status (Who can see this?)
router.get('/:documentId/access-details', requireJWT, docsController.getDocumentAccessDetails);

// Revoke access routes
router.post('/:documentId/revoke-public', requireJWT, docsController.revokePublic);
router.post('/:documentId/revoke-share', requireJWT, docsController.removeSharedUser);

// Update & Delete routes
router.put('/:documentId', requireJWT, docsController.updateDocument);
router.delete('/:documentId', requireJWT, docsController.deleteDocument);

// === 3. FILE DOWNLOAD/ACCESS ROUTES ===
// Public URL (No Auth needed)
router.get('/public/:publicKey', docsController.downloadPublic);

// Password Protected URL (No Auth needed, requires password in body)
router.post('/secure/:documentId', docsController.downloadSecure);

// Shared / Owned Access (Requires JWT Auth)
router.get('/shared/:documentId', requireJWT, docsController.downloadShared);

module.exports = router;