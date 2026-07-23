const Document = require('../models/Document');
const DocumentAccess = require('../models/DocumentAccess');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { renderPasswordPage } = require('../utils/publicDocTemplate');

// Helper to force file download (attachment)
const safeDownload = (res, filePath, fileName, docId) => {
    res.download(filePath, fileName, (err) => {
        if (err) {
            console.error(`[DocsManager] ❌ Stream Error for DocID ${docId}:`, err.message);
            if (!res.headersSent) {
                res.status(404).json({ success: false, message: "File could not be found on the server or transfer failed." });
            }
        } else {
            console.log(`[DocsManager] ✅ Successfully downloaded DocID ${docId}`);
        }
    });
};

// Helper to render file inline in the browser
const safeView = (res, filePath, docId) => {
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`[DocsManager] ❌ View Error for DocID ${docId}:`, err.message);
            if (!res.headersSent) {
                res.status(404).send("<h2>404 - File could not be found on the server.</h2>");
            }
        } else {
            console.log(`[DocsManager] ✅ Successfully viewed DocID ${docId} inline`);
        }
    });
};

exports.uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            console.warn(`[DocsManager] ⚠️ Upload attempted without file by user: ${req.user.id}`);
            return res.status(400).json({ success: false, message: "No document file provided." });
        }

        const { documentName, documentCategory } = req.body;
        
        const newDoc = new Document({
            userId: req.user.id,
            documentName: documentName || req.file.originalname,
            documentType: req.file.mimetype,
            documentCategory: documentCategory || 'OTHER',
            serverPath: req.file.path
        });
        
        await newDoc.save();

        const access = new DocumentAccess({ documentId: newDoc._id });
        await access.save();

        console.log(`[DocsManager] ✅ Document uploaded successfully. ID: ${newDoc._id}`);
        res.status(201).json({
            success: true,
            message: "Document uploaded successfully.",
            document: newDoc
        });

    } catch (error) {
        console.error(`[DocsManager] ❌ UPLOAD ERROR:`, error.message);
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, () => {});
        }
        res.status(500).json({ success: false, message: "An unexpected error occurred while saving the document." });
    }
};

exports.makePublic = async (req, res) => {
    try {
        const { documentId } = req.params;
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) return res.status(404).json({ success: false, message: "Document not found or unauthorized." });

        const publicKey = crypto.randomBytes(16).toString('hex');
        await DocumentAccess.findOneAndUpdate({ documentId }, { isPublic: true, publicKey: publicKey });
        await Document.findByIdAndUpdate(documentId, { isPublic: true });

        const publicUrl = `/api/docs/public/${publicKey}`;
        res.status(200).json({ success: true, message: "Document is now public.", publicUrl, publicKey });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to generate public link." });
    }
};

exports.setPassword = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { password } = req.body;
        if (!password) return res.status(400).json({ success: false, message: "Password is required." });

        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) return res.status(404).json({ success: false, message: "Document not found or unauthorized." });

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await DocumentAccess.findOneAndUpdate({ documentId }, { passwordHash });
        await Document.findByIdAndUpdate(documentId, { isPasswordProtected: true });

        res.status(200).json({ success: true, message: "Password protection enabled." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to set document password." });
    }
};

exports.shareWithUser = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { targetUserId } = req.body;
        if (!targetUserId) return res.status(400).json({ success: false, message: "Target User ID is required." });

        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) return res.status(404).json({ success: false, message: "Document not found or unauthorized." });

        const updatedAccess = await DocumentAccess.findOneAndUpdate(
            { documentId },
            { $addToSet: { sharedWithUsers: targetUserId } },
            { new: true }
        );
        await Document.findByIdAndUpdate(documentId, { sharedCount: updatedAccess.sharedWithUsers.length });

        res.status(200).json({ success: true, message: "Document shared successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to share document." });
    }
};

// === HTML RENDER ENGINE FOR PUBLIC LINKS ===
exports.downloadPublic = async (req, res) => {
    try {
        const { publicKey } = req.params;
        
        const access = await DocumentAccess.findOne({ publicKey, isPublic: true }).populate('documentId');
        if (!access || !access.documentId) {
            return res.status(404).send("<h2>404 - Document not found or link has expired.</h2>");
        }

        // If it requires a password, serve the HTML Template
        if (access.passwordHash) {
            return res.status(401).send(renderPasswordPage(publicKey));
        }

        // If no password is required, render it inline by default in the browser
        const doc = access.documentId;
        safeView(res, doc.serverPath, doc._id);
    } catch (error) {
        res.status(500).send("<h2>500 - Error accessing public document.</h2>");
    }
};

exports.downloadPublicSecure = async (req, res) => {
    try {
        const { publicKey } = req.params;
        const { password, action } = req.body; // Action will be 'view' or 'download' from HTML form
        
        // Did this come from a Browser HTML form, or the Android App?
        const isBrowserForm = req.is('application/x-www-form-urlencoded');

        if (!password) {
            if (isBrowserForm) return res.status(400).send(renderPasswordPage(publicKey, "Password is required."));
            return res.status(400).json({ success: false, message: "Password is required." });
        }

        const access = await DocumentAccess.findOne({ publicKey, isPublic: true }).populate('documentId');
        if (!access || !access.documentId) {
            if (isBrowserForm) return res.status(404).send("<h2>Invalid link.</h2>");
            return res.status(404).json({ success: false, message: "Invalid or inactive public link." });
        }

        const isMatch = await bcrypt.compare(password, access.passwordHash);
        if (!isMatch) {
            if (isBrowserForm) return res.status(401).send(renderPasswordPage(publicKey, "Incorrect password. Please try again."));
            return res.status(401).json({ success: false, message: "Incorrect password." });
        }

        const doc = access.documentId;

        // If the browser clicked "View Inline", use safeView. Otherwise force download.
        if (isBrowserForm && action === 'view') {
            safeView(res, doc.serverPath, doc._id);
        } else {
            safeDownload(res, doc.serverPath, doc.documentName, doc._id);
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Error validating secure access." });
    }
};

exports.downloadSecure = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { password } = req.body;

        if (!password) return res.status(400).json({ success: false, message: "Password is required to access this document." });

        const access = await DocumentAccess.findOne({ documentId }).populate('documentId');
        if (!access || !access.passwordHash) {
            return res.status(400).json({ success: false, message: "This document is not password protected." });
        }

        const isMatch = await bcrypt.compare(password, access.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Incorrect password." });
        }

        const doc = access.documentId;
        safeDownload(res, doc.serverPath, doc.documentName, doc._id);
    } catch (error) {
        res.status(500).json({ success: false, message: "Error validating secure access." });
    }
};

exports.downloadShared = async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.id;

        const access = await DocumentAccess.findOne({ documentId }).populate('documentId');
        if (!access || !access.documentId) return res.status(404).json({ success: false, message: "Document not found." });

        const doc = access.documentId;
        const isOwner = doc.userId.toString() === userId.toString();
        const isSharedUser = access.sharedWithUsers.some(sharedId => sharedId.toString() === userId.toString());

        if (!isOwner && !isSharedUser) {
            return res.status(403).json({ success: false, message: "You do not have permission to view this document." });
        }

        safeDownload(res, doc.serverPath, doc.documentName, doc._id);
    } catch (error) {
        res.status(500).json({ success: false, message: "Error verifying document permissions." });
    }
};

exports.getMyDocuments = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const sortOrder = req.query.sort === 'asc' ? 1 : -1;
        const category = req.query.category;

        const query = { userId: req.user.id };
        if (category) query.documentCategory = category;

        const [docs, total] = await Promise.all([
            Document.find(query).sort({ createdAt: sortOrder }).skip((page - 1) * limit).limit(limit).select('-serverPath').lean(),
            Document.countDocuments(query)
        ]);

        res.status(200).json({ success: true, data: docs, pagination: { totalDocuments: total, currentPage: page, totalPages: Math.ceil(total / limit), hasNextPage: (page * limit) < total } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to retrieve documents." });
    }
};

exports.getSharedWithMe = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const sortOrder = req.query.sort === 'asc' ? 1 : -1;
        const category = req.query.category;

        const accessRecords = await DocumentAccess.find({ sharedWithUsers: req.user.id }).select('documentId').lean();
        const sharedDocIds = accessRecords.map(record => record.documentId);

        if (sharedDocIds.length === 0) {
            return res.status(200).json({ success: true, data: [], pagination: { totalDocuments: 0, currentPage: 1, totalPages: 0, hasNextPage: false } });
        }

        const query = { _id: { $in: sharedDocIds } };
        if (category) query.documentCategory = category;

        const [docs, total] = await Promise.all([
            Document.find(query).sort({ createdAt: sortOrder }).skip((page - 1) * limit).limit(limit).select('-serverPath').lean(),
            Document.countDocuments(query)
        ]);

        res.status(200).json({ success: true, data: docs, pagination: { totalDocuments: total, currentPage: page, totalPages: Math.ceil(total / limit), hasNextPage: (page * limit) < total } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to retrieve shared documents." });
    }
};

exports.getDocumentAccessDetails = async (req, res) => {
    try {
        const { documentId } = req.params;
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) return res.status(404).json({ success: false, message: "Document not found or unauthorized." });

        const access = await DocumentAccess.findOne({ documentId }).populate('sharedWithUsers', 'name email profileImageUri');
        res.status(200).json({ success: true, data: { isPublic: access.isPublic, publicUrl: access.isPublic ? `/api/docs/public/${access.publicKey}` : null, isPasswordProtected: !!access.passwordHash, sharedUsers: access.sharedWithUsers } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch access details." });
    }
};

exports.revokePublic = async (req, res) => {
    try {
        const { documentId } = req.params;
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) return res.status(404).json({ success: false, message: "Document not found or unauthorized." });

        await DocumentAccess.findOneAndUpdate({ documentId }, { isPublic: false, publicKey: null });
        await Document.findByIdAndUpdate(documentId, { isPublic: false });

        res.status(200).json({ success: true, message: "Public access revoked. The link is now dead." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to revoke public access." });
    }
};

exports.removeSharedUser = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { targetUserId } = req.body;
        if (!targetUserId) return res.status(400).json({ success: false, message: "Target User ID is required." });

        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) return res.status(404).json({ success: false, message: "Document not found or unauthorized." });

        const updatedAccess = await DocumentAccess.findOneAndUpdate({ documentId }, { $pull: { sharedWithUsers: targetUserId } }, { new: true });
        await Document.findByIdAndUpdate(documentId, { sharedCount: updatedAccess.sharedWithUsers.length });

        res.status(200).json({ success: true, message: "User access revoked." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to remove user access." });
    }
};

exports.updateDocument = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { documentName, documentCategory } = req.body;

        const updateData = {};
        if (documentName) updateData.documentName = documentName;
        if (documentCategory) updateData.documentCategory = documentCategory;

        const doc = await Document.findOneAndUpdate({ _id: documentId, userId: req.user.id }, { $set: updateData }, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: "Document not found or unauthorized." });

        res.status(200).json({ success: true, message: "Document updated.", document: doc });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update document." });
    }
};

exports.deleteDocument = async (req, res) => {
    try {
        const { documentId } = req.params;
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) return res.status(404).json({ success: false, message: "Document not found or unauthorized." });

        if (doc.serverPath && fs.existsSync(doc.serverPath)) {
            fs.unlinkSync(doc.serverPath);
        }

        await DocumentAccess.findOneAndDelete({ documentId });
        await Document.findOneAndDelete({ _id: documentId });

        res.status(200).json({ success: true, message: "Document permanently deleted." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete document." });
    }
};