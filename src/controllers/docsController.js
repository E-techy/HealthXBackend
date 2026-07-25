const Document = require('../models/Document');
const DocumentAccess = require('../models/DocumentAccess');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { renderPasswordPage } = require('../utils/publicDocTemplate');

// Helper to force file download (attachment)
const safeDownload = (res, filePath, fileName, docId) => {
    console.log(`🔄 [DocsManager] Attempting to stream download for DocID: ${docId}`);
    res.download(filePath, fileName, (err) => {
        if (err) {
            console.error(`❌ [DocsManager] Stream Error for DocID ${docId}:`, err.message);
            if (!res.headersSent) {
                res.status(404).json({ success: false, message: "File could not be found on the server or transfer failed." });
            }
        } else {
            console.log(`✅ [DocsManager] Successfully downloaded DocID: ${docId}`);
        }
    });
};

// Helper to render file inline in the browser
const safeView = (res, filePath, docId) => {
    console.log(`🔄 [DocsManager] Attempting to serve inline view for DocID: ${docId}`);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`❌ [DocsManager] View Error for DocID ${docId}:`, err.message);
            if (!res.headersSent) {
                res.status(404).send("<h2>404 - File could not be found on the server.</h2>");
            }
        } else {
            console.log(`✅ [DocsManager] Successfully viewed DocID ${docId} inline`);
        }
    });
};

exports.uploadDocument = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> uploadDocument`);
    console.log(`👤 [USER ID]: ${req.user?.id}`);
    
    try {
        if (!req.file) {
            console.warn(`⚠️ [DocsManager] Upload attempted without file by user: ${req.user?.id}`);
            return res.status(400).json({ success: false, message: "No document file provided." });
        }

        const { documentName, documentCategory } = req.body;
        console.log(`📦 [DATA RECEIVED]:`, { 
            fileName: req.file.originalname, 
            mimeType: req.file.mimetype, 
            documentName, 
            documentCategory 
        });
        
        console.log(`🔄 [STEP]: Saving document metadata to database...`);
        const newDoc = new Document({
            userId: req.user.id,
            documentName: documentName || req.file.originalname,
            documentType: req.file.mimetype,
            documentCategory: documentCategory || 'OTHER',
            serverPath: req.file.path
        });
        
        await newDoc.save();
        console.log(`✅ [STEP]: Document saved with ID: ${newDoc._id}`);

        console.log(`🔄 [STEP]: Creating default DocumentAccess record...`);
        const access = new DocumentAccess({ documentId: newDoc._id });
        await access.save();
        console.log(`✅ [STEP]: DocumentAccess record created.`);

        console.log(`✅ [SUCCESS]: Document uploaded completely.`);
        res.status(201).json({
            success: true,
            message: "Document uploaded successfully.",
            document: newDoc
        });

    } catch (error) {
        console.error(`❌ [DocsManager] UPLOAD ERROR:`, error.message);
        if (req.file && req.file.path) {
            console.log(`🔄 [STEP]: Cleaning up orphaned file on disk...`);
            fs.unlink(req.file.path, () => {
                console.log(`✅ [STEP]: Orphaned file removed.`);
            });
        }
        res.status(500).json({ success: false, message: "An unexpected error occurred while saving the document." });
    }
};

exports.makePublic = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> makePublic`);
    console.log(`👤 [USER ID]: ${req.user?.id}, 📄 [DOC ID]: ${req.params.documentId}`);

    try {
        const { documentId } = req.params;
        
        console.log(`🔄 [STEP]: Verifying document ownership...`);
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) {
            console.warn(`⚠️ [DocsManager] Document not found or unauthorized for user ${req.user?.id}`);
            return res.status(404).json({ success: false, message: "Document not found or unauthorized." });
        }

        console.log(`🔄 [STEP]: Generating public key and updating access...`);
        const publicKey = crypto.randomBytes(16).toString('hex');
        await DocumentAccess.findOneAndUpdate({ documentId }, { isPublic: true, publicKey: publicKey });
        await Document.findByIdAndUpdate(documentId, { isPublic: true });

        const publicUrl = `/api/docs/public/${publicKey}`;
        console.log(`✅ [SUCCESS]: Document made public. Key: ${publicKey}`);
        
        res.status(200).json({ success: true, message: "Document is now public.", publicUrl, publicKey });
    } catch (error) {
        console.error(`❌ [DocsManager] MAKE PUBLIC ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Failed to generate public link." });
    }
};

exports.setPassword = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> setPassword`);
    console.log(`👤 [USER ID]: ${req.user?.id}, 📄 [DOC ID]: ${req.params.documentId}`);
    
    try {
        const { documentId } = req.params;
        const { password } = req.body;
        
        if (!password) {
            console.warn(`⚠️ [DocsManager] Request missing password field.`);
            return res.status(400).json({ success: false, message: "Password is required." });
        }

        console.log(`🔄 [STEP]: Verifying document ownership...`);
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) {
            console.warn(`⚠️ [DocsManager] Document not found or unauthorized.`);
            return res.status(404).json({ success: false, message: "Document not found or unauthorized." });
        }

        console.log(`🔄 [STEP]: Hashing password and updating DB...`);
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await DocumentAccess.findOneAndUpdate({ documentId }, { passwordHash });
        await Document.findByIdAndUpdate(documentId, { isPasswordProtected: true });

        console.log(`✅ [SUCCESS]: Password protection enabled for DocID: ${documentId}`);
        res.status(200).json({ success: true, message: "Password protection enabled." });
    } catch (error) {
        console.error(`❌ [DocsManager] SET PASSWORD ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Failed to set document password." });
    }
};

exports.shareWithUser = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> shareWithUser`);
    console.log(`👤 [USER ID]: ${req.user?.id}, 📄 [DOC ID]: ${req.params.documentId}`);
    console.log(`📦 [TARGET USER]: ${req.body.targetUserId}`);

    try {
        const { documentId } = req.params;
        const { targetUserId } = req.body;
        
        if (!targetUserId) {
            console.warn(`⚠️ [DocsManager] Target User ID missing.`);
            return res.status(400).json({ success: false, message: "Target User ID is required." });
        }

        console.log(`🔄 [STEP]: Verifying document ownership...`);
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) {
            console.warn(`⚠️ [DocsManager] Document not found or unauthorized.`);
            return res.status(404).json({ success: false, message: "Document not found or unauthorized." });
        }

        console.log(`🔄 [STEP]: Adding user ${targetUserId} to shared access list...`);
        const updatedAccess = await DocumentAccess.findOneAndUpdate(
            { documentId },
            { $addToSet: { sharedWithUsers: targetUserId } },
            { new: true }
        );
        
        await Document.findByIdAndUpdate(documentId, { sharedCount: updatedAccess.sharedWithUsers.length });

        console.log(`✅ [SUCCESS]: Document shared. Total shared users: ${updatedAccess.sharedWithUsers.length}`);
        res.status(200).json({ success: true, message: "Document shared successfully." });
    } catch (error) {
        console.error(`❌ [DocsManager] SHARE DOCUMENT ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Failed to share document." });
    }
};

// === HTML RENDER ENGINE FOR PUBLIC LINKS ===
exports.downloadPublic = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> downloadPublic (HTML view)`);
    console.log(`🔑 [PUBLIC KEY]: ${req.params.publicKey}`);

    try {
        const { publicKey } = req.params;
        
        console.log(`🔄 [STEP]: Looking up public access record...`);
        const access = await DocumentAccess.findOne({ publicKey, isPublic: true }).populate('documentId');
        
        if (!access || !access.documentId) {
            console.warn(`⚠️ [DocsManager] Invalid or expired public link.`);
            return res.status(404).send("<h2>404 - Document not found or link has expired.</h2>");
        }

        // If it requires a password, serve the HTML Template
        if (access.passwordHash) {
            console.log(`🔒 [STEP]: Document is password protected. Rendering password prompt.`);
            return res.status(401).send(renderPasswordPage(publicKey));
        }

        // If no password is required, render it inline by default in the browser
        const doc = access.documentId;
        console.log(`✅ [SUCCESS]: Serving document publicly without password. DocID: ${doc._id}`);
        safeView(res, doc.serverPath, doc._id);
    } catch (error) {
        console.error(`❌ [DocsManager] DOWNLOAD PUBLIC ERROR:`, error.message);
        res.status(500).send("<h2>500 - Error accessing public document.</h2>");
    }
};

exports.downloadPublicSecure = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> downloadPublicSecure (POST)`);
    console.log(`🔑 [PUBLIC KEY]: ${req.params.publicKey}`);
    
    try {
        const { publicKey } = req.params;
        const { password, action } = req.body; // Action will be 'view' or 'download' from HTML form
        
        // Did this come from a Browser HTML form, or the Android App?
        const isBrowserForm = req.is('application/x-www-form-urlencoded');
        console.log(`📦 [DATA]: Action requested = ${action || 'default'}, IsBrowser = ${isBrowserForm}, Password provided = ${!!password}`);

        if (!password) {
            console.warn(`⚠️ [DocsManager] Request blocked: No password provided.`);
            if (isBrowserForm) return res.status(400).send(renderPasswordPage(publicKey, "Password is required."));
            return res.status(400).json({ success: false, message: "Password is required." });
        }

        console.log(`🔄 [STEP]: Fetching access record...`);
        const access = await DocumentAccess.findOne({ publicKey, isPublic: true }).populate('documentId');
        if (!access || !access.documentId) {
            console.warn(`⚠️ [DocsManager] Record not found for public key.`);
            if (isBrowserForm) return res.status(404).send("<h2>Invalid link.</h2>");
            return res.status(404).json({ success: false, message: "Invalid or inactive public link." });
        }

        console.log(`🔄 [STEP]: Validating password...`);
        const isMatch = await bcrypt.compare(password, access.passwordHash);
        if (!isMatch) {
            console.warn(`⚠️ [DocsManager] Incorrect password attempt.`);
            if (isBrowserForm) return res.status(401).send(renderPasswordPage(publicKey, "Incorrect password. Please try again."));
            return res.status(401).json({ success: false, message: "Incorrect password." });
        }

        const doc = access.documentId;
        console.log(`✅ [STEP]: Password validated. Proceeding to serve file.`);

        // If the browser clicked "View Inline", use safeView. Otherwise force download.
        if (isBrowserForm && action === 'view') {
            safeView(res, doc.serverPath, doc._id);
        } else {
            safeDownload(res, doc.serverPath, doc.documentName, doc._id);
        }
    } catch (error) {
        console.error(`❌ [DocsManager] SECURE PUBLIC DOWNLOAD ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Error validating secure access." });
    }
};

exports.downloadSecure = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> downloadSecure (Internal App)`);
    console.log(`📄 [DOC ID]: ${req.params.documentId}`);

    try {
        const { documentId } = req.params;
        const { password } = req.body;

        if (!password) {
            console.warn(`⚠️ [DocsManager] Password not provided.`);
            return res.status(400).json({ success: false, message: "Password is required to access this document." });
        }

        console.log(`🔄 [STEP]: Looking up access record...`);
        const access = await DocumentAccess.findOne({ documentId }).populate('documentId');
        if (!access || !access.passwordHash) {
            console.warn(`⚠️ [DocsManager] Document is not password protected or missing.`);
            return res.status(400).json({ success: false, message: "This document is not password protected." });
        }

        console.log(`🔄 [STEP]: Validating password...`);
        const isMatch = await bcrypt.compare(password, access.passwordHash);
        if (!isMatch) {
            console.warn(`⚠️ [DocsManager] Incorrect password attempt.`);
            return res.status(401).json({ success: false, message: "Incorrect password." });
        }

        const doc = access.documentId;
        console.log(`✅ [SUCCESS]: Password matched. Triggering download.`);
        safeDownload(res, doc.serverPath, doc.documentName, doc._id);
    } catch (error) {
        console.error(`❌ [DocsManager] SECURE DOWNLOAD ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Error validating secure access." });
    }
};

exports.downloadShared = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> downloadShared`);
    console.log(`👤 [USER ID]: ${req.user?.id}, 📄 [DOC ID]: ${req.params.documentId}`);

    try {
        const { documentId } = req.params;
        const userId = req.user.id;

        console.log(`🔄 [STEP]: Verifying document and access permissions...`);
        const access = await DocumentAccess.findOne({ documentId }).populate('documentId');
        if (!access || !access.documentId) {
            console.warn(`⚠️ [DocsManager] Document not found.`);
            return res.status(404).json({ success: false, message: "Document not found." });
        }

        const doc = access.documentId;
        const isOwner = doc.userId.toString() === userId.toString();
        const isSharedUser = access.sharedWithUsers.some(sharedId => sharedId.toString() === userId.toString());

        if (!isOwner && !isSharedUser) {
            console.warn(`⚠️ [DocsManager] User ${userId} unauthorized to access DocID: ${documentId}`);
            return res.status(403).json({ success: false, message: "You do not have permission to view this document." });
        }

        console.log(`✅ [SUCCESS]: Permissions verified. Triggering download.`);
        safeDownload(res, doc.serverPath, doc.documentName, doc._id);
    } catch (error) {
        console.error(`❌ [DocsManager] DOWNLOAD SHARED ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Error verifying document permissions." });
    }
};

exports.getMyDocuments = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> getMyDocuments`);
    console.log(`👤 [USER ID]: ${req.user?.id}, 🔍 [QUERY]:`, req.query);

    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const sortOrder = req.query.sort === 'asc' ? 1 : -1;
        const category = req.query.category;

        const query = { userId: req.user.id };
        if (category) query.documentCategory = category;

        console.log(`🔄 [STEP]: Fetching documents from DB...`);
        const [docs, total] = await Promise.all([
            Document.find(query).sort({ createdAt: sortOrder }).skip((page - 1) * limit).limit(limit).select('-serverPath').lean(),
            Document.countDocuments(query)
        ]);

        console.log(`✅ [SUCCESS]: Fetched ${docs.length} docs (Total: ${total}) for page ${page}`);
        res.status(200).json({ 
            success: true, 
            data: docs, 
            pagination: { totalDocuments: total, currentPage: page, totalPages: Math.ceil(total / limit), hasNextPage: (page * limit) < total } 
        });
    } catch (error) {
        console.error(`❌ [DocsManager] GET MY DOCS ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Failed to retrieve documents." });
    }
};

exports.getSharedWithMe = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> getSharedWithMe`);
    console.log(`👤 [USER ID]: ${req.user?.id}, 🔍 [QUERY]:`, req.query);

    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const sortOrder = req.query.sort === 'asc' ? 1 : -1;
        const category = req.query.category;

        console.log(`🔄 [STEP]: Finding access records shared with user...`);
        const accessRecords = await DocumentAccess.find({ sharedWithUsers: req.user.id }).select('documentId').lean();
        const sharedDocIds = accessRecords.map(record => record.documentId);

        if (sharedDocIds.length === 0) {
            console.log(`✅ [SUCCESS]: No shared documents found for user.`);
            return res.status(200).json({ success: true, data: [], pagination: { totalDocuments: 0, currentPage: 1, totalPages: 0, hasNextPage: false } });
        }

        const query = { _id: { $in: sharedDocIds } };
        if (category) query.documentCategory = category;

        console.log(`🔄 [STEP]: Fetching ${sharedDocIds.length} shared document details from DB...`);
        const [docs, total] = await Promise.all([
            Document.find(query).sort({ createdAt: sortOrder }).skip((page - 1) * limit).limit(limit).select('-serverPath').lean(),
            Document.countDocuments(query)
        ]);

        console.log(`✅ [SUCCESS]: Fetched ${docs.length} shared docs.`);
        res.status(200).json({ 
            success: true, 
            data: docs, 
            pagination: { totalDocuments: total, currentPage: page, totalPages: Math.ceil(total / limit), hasNextPage: (page * limit) < total } 
        });
    } catch (error) {
        console.error(`❌ [DocsManager] GET SHARED WITH ME ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Failed to retrieve shared documents." });
    }
};

exports.getDocumentAccessDetails = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> getDocumentAccessDetails`);
    console.log(`👤 [USER ID]: ${req.user?.id}, 📄 [DOC ID]: ${req.params.documentId}`);

    try {
        const { documentId } = req.params;
        
        console.log(`🔄 [STEP]: Verifying ownership...`);
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) {
            console.warn(`⚠️ [DocsManager] Document not found or unauthorized.`);
            return res.status(404).json({ success: false, message: "Document not found or unauthorized." });
        }

        console.log(`🔄 [STEP]: Fetching access details and populating user info...`);
        const access = await DocumentAccess.findOne({ documentId }).populate('sharedWithUsers', 'name email profileImageUri');
        
        console.log(`✅ [SUCCESS]: Access details fetched successfully.`);
        res.status(200).json({ 
            success: true, 
            data: { 
                isPublic: access.isPublic, 
                publicUrl: access.isPublic ? `/api/docs/public/${access.publicKey}` : null, 
                isPasswordProtected: !!access.passwordHash, 
                sharedUsers: access.sharedWithUsers 
            } 
        });
    } catch (error) {
        console.error(`❌ [DocsManager] GET ACCESS DETAILS ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Failed to fetch access details." });
    }
};

exports.revokePublic = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> revokePublic`);
    console.log(`👤 [USER ID]: ${req.user?.id}, 📄 [DOC ID]: ${req.params.documentId}`);

    try {
        const { documentId } = req.params;
        
        console.log(`🔄 [STEP]: Verifying ownership...`);
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) {
            console.warn(`⚠️ [DocsManager] Document not found or unauthorized.`);
            return res.status(404).json({ success: false, message: "Document not found or unauthorized." });
        }

        console.log(`🔄 [STEP]: Revoking public access in DB...`);
        await DocumentAccess.findOneAndUpdate({ documentId }, { isPublic: false, publicKey: null });
        await Document.findByIdAndUpdate(documentId, { isPublic: false });

        console.log(`✅ [SUCCESS]: Public access revoked.`);
        res.status(200).json({ success: true, message: "Public access revoked. The link is now dead." });
    } catch (error) {
        console.error(`❌ [DocsManager] REVOKE PUBLIC ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Failed to revoke public access." });
    }
};

exports.removeSharedUser = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> removeSharedUser`);
    console.log(`👤 [USER ID]: ${req.user?.id}, 📄 [DOC ID]: ${req.params.documentId}`);
    console.log(`📦 [TARGET USER ID]: ${req.body.targetUserId}`);

    try {
        const { documentId } = req.params;
        const { targetUserId } = req.body;
        
        if (!targetUserId) {
            console.warn(`⚠️ [DocsManager] Target User ID missing.`);
            return res.status(400).json({ success: false, message: "Target User ID is required." });
        }

        console.log(`🔄 [STEP]: Verifying ownership...`);
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) {
            console.warn(`⚠️ [DocsManager] Document not found or unauthorized.`);
            return res.status(404).json({ success: false, message: "Document not found or unauthorized." });
        }

        console.log(`🔄 [STEP]: Removing target user from shared access list...`);
        const updatedAccess = await DocumentAccess.findOneAndUpdate(
            { documentId }, 
            { $pull: { sharedWithUsers: targetUserId } }, 
            { new: true }
        );
        
        await Document.findByIdAndUpdate(documentId, { sharedCount: updatedAccess.sharedWithUsers.length });

        console.log(`✅ [SUCCESS]: User removed. Remaining shared users: ${updatedAccess.sharedWithUsers.length}`);
        res.status(200).json({ success: true, message: "User access revoked." });
    } catch (error) {
        console.error(`❌ [DocsManager] REMOVE SHARED USER ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Failed to remove user access." });
    }
};

exports.updateDocument = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> updateDocument`);
    console.log(`👤 [USER ID]: ${req.user?.id}, 📄 [DOC ID]: ${req.params.documentId}`);
    
    try {
        const { documentId } = req.params;
        const { documentName, documentCategory } = req.body;

        const updateData = {};
        if (documentName) updateData.documentName = documentName;
        if (documentCategory) updateData.documentCategory = documentCategory;

        console.log(`📦 [DATA TO UPDATE]:`, updateData);

        console.log(`🔄 [STEP]: Updating document metadata in DB...`);
        const doc = await Document.findOneAndUpdate(
            { _id: documentId, userId: req.user.id }, 
            { $set: updateData }, 
            { new: true }
        );
        
        if (!doc) {
            console.warn(`⚠️ [DocsManager] Document not found or unauthorized.`);
            return res.status(404).json({ success: false, message: "Document not found or unauthorized." });
        }

        console.log(`✅ [SUCCESS]: Document metadata updated.`);
        res.status(200).json({ success: true, message: "Document updated.", document: doc });
    } catch (error) {
        console.error(`❌ [DocsManager] UPDATE DOCUMENT ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Failed to update document." });
    }
};

exports.deleteDocument = async (req, res) => {
    console.log(`\n👉 [ROUTE HIT]: DocsManager -> deleteDocument`);
    console.log(`👤 [USER ID]: ${req.user?.id}, 📄 [DOC ID]: ${req.params.documentId}`);

    try {
        const { documentId } = req.params;
        
        console.log(`🔄 [STEP]: Verifying ownership before deletion...`);
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) {
            console.warn(`⚠️ [DocsManager] Document not found or unauthorized.`);
            return res.status(404).json({ success: false, message: "Document not found or unauthorized." });
        }

        console.log(`🔄 [STEP]: Deleting physical file from server...`);
        if (doc.serverPath && fs.existsSync(doc.serverPath)) {
            fs.unlinkSync(doc.serverPath);
            console.log(`✅ [STEP]: Physical file deleted.`);
        } else {
            console.warn(`⚠️ [DocsManager] Physical file not found at path: ${doc.serverPath}`);
        }

        console.log(`🔄 [STEP]: Deleting DB records...`);
        await DocumentAccess.findOneAndDelete({ documentId });
        await Document.findOneAndDelete({ _id: documentId });

        console.log(`✅ [SUCCESS]: Document permanently deleted.`);
        res.status(200).json({ success: true, message: "Document permanently deleted." });
    } catch (error) {
        console.error(`❌ [DocsManager] DELETE DOCUMENT ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Failed to delete document." });
    }
};