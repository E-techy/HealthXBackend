const Document = require('../models/Document');
const DocumentAccess = require('../models/DocumentAccess');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// Helper to safely send files and prevent crashes if the file is missing
const safeDownload = (res, filePath, fileName, docId) => {
    res.download(filePath, fileName, (err) => {
        if (err) {
            console.error(`[DocsManager] ❌ Stream Error for DocID ${docId}:`, err.message);
            // If headers are already sent, we can't send a JSON response
            if (!res.headersSent) {
                res.status(404).json({ success: false, message: "File could not be found on the server or transfer failed." });
            }
        } else {
            console.log(`[DocsManager] ✅ Successfully served DocID ${docId}`);
        }
    });
};

// 1. Upload a Document
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
        console.error(error.stack); // Log full stack to server console only
        
        // CRUCIAL: Cleanup orphaned file if DB save fails
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) {
                    console.error(`[DocsManager] ⚠️ Failed to delete orphaned file at ${req.file.path}:`, unlinkErr.message);
                } else {
                    console.log(`[DocsManager] 🧹 Cleaned up orphaned file at ${req.file.path}`);
                }
            });
        }

        res.status(500).json({ success: false, message: "An unexpected error occurred while saving the document." });
    }
};

// 2. Make Document Public
exports.makePublic = async (req, res) => {
    try {
        const { documentId } = req.params;
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        
        if (!doc) {
            console.warn(`[DocsManager] ⚠️ Unauthorized public link attempt for DocID: ${documentId} by UserID: ${req.user.id}`);
            return res.status(404).json({ success: false, message: "Document not found or unauthorized." });
        }

        const publicKey = crypto.randomBytes(16).toString('hex');
        await DocumentAccess.findOneAndUpdate(
            { documentId },
            { isPublic: true, publicKey: publicKey },
            { new: true }
        );

        const publicUrl = `/api/docs/public/${publicKey}`;
        console.log(`[DocsManager] 🔗 Public link generated for DocID: ${documentId}`);
        
        res.status(200).json({ success: true, message: "Document is now public.", publicUrl, publicKey });
    } catch (error) {
        console.error(`[DocsManager] ❌ MAKE PUBLIC ERROR:`, error.message, error.stack);
        res.status(500).json({ success: false, message: "Failed to generate public link." });
    }
};

// 3. Password Protect Document
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
        console.log(`[DocsManager] 🔒 Password set for DocID: ${documentId}`);

        res.status(200).json({ success: true, message: "Password protection enabled." });
    } catch (error) {
        console.error(`[DocsManager] ❌ SET PASSWORD ERROR:`, error.message, error.stack);
        res.status(500).json({ success: false, message: "Failed to set document password." });
    }
};

// 4. Share with Specific User
exports.shareWithUser = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { targetUserId } = req.body;

        if (!targetUserId) return res.status(400).json({ success: false, message: "Target User ID is required." });

        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) return res.status(404).json({ success: false, message: "Document not found or unauthorized." });

        await DocumentAccess.findOneAndUpdate(
            { documentId },
            { $addToSet: { sharedWithUsers: targetUserId } }
        );
        console.log(`[DocsManager] 🤝 DocID: ${documentId} shared with UserID: ${targetUserId}`);

        res.status(200).json({ success: true, message: "Document shared successfully." });
    } catch (error) {
        console.error(`[DocsManager] ❌ SHARE USER ERROR:`, error.message, error.stack);
        res.status(500).json({ success: false, message: "Failed to share document." });
    }
};

// 5. Download Public Document
exports.downloadPublic = async (req, res) => {
    try {
        const { publicKey } = req.params;
        
        const access = await DocumentAccess.findOne({ publicKey, isPublic: true }).populate('documentId');
        if (!access || !access.documentId) {
            console.warn(`[DocsManager] ⚠️ Failed public access attempt with key: ${publicKey}`);
            return res.status(404).json({ success: false, message: "Invalid or inactive public link." });
        }

        const doc = access.documentId;
        safeDownload(res, doc.serverPath, doc.documentName, doc._id);
    } catch (error) {
        console.error(`[DocsManager] ❌ DOWNLOAD PUBLIC ERROR:`, error.message, error.stack);
        res.status(500).json({ success: false, message: "Error accessing public document." });
    }
};

// 6. Download Password Protected Document
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
            console.warn(`[DocsManager] ⚠️ Invalid password attempt for DocID: ${documentId}`);
            return res.status(401).json({ success: false, message: "Incorrect password." });
        }

        const doc = access.documentId;
        safeDownload(res, doc.serverPath, doc.documentName, doc._id);
    } catch (error) {
        console.error(`[DocsManager] ❌ DOWNLOAD SECURE ERROR:`, error.message, error.stack);
        res.status(500).json({ success: false, message: "Error validating secure access." });
    }
};

// 7. Download Shared or Owned Document
exports.downloadShared = async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.id;

        const access = await DocumentAccess.findOne({ documentId }).populate('documentId');
        if (!access || !access.documentId) {
            return res.status(404).json({ success: false, message: "Document not found." });
        }

        const doc = access.documentId;
        const isOwner = doc.userId.toString() === userId;
        const isSharedUser = access.sharedWithUsers.includes(userId);

        if (!isOwner && !isSharedUser) {
            console.warn(`[DocsManager] ⚠️ Unauthorized access attempt by UserID: ${userId} for DocID: ${documentId}`);
            return res.status(403).json({ success: false, message: "You do not have permission to view this document." });
        }

        safeDownload(res, doc.serverPath, doc.documentName, doc._id);
    } catch (error) {
        console.error(`[DocsManager] ❌ DOWNLOAD SHARED ERROR:`, error.message, error.stack);
        res.status(500).json({ success: false, message: "Error verifying document permissions." });
    }
};

// === ADD THESE TO src/controllers/docsController.js ===

// 8. Get Owned Documents (With Pagination & Filters)
exports.getMyDocuments = async (req, res) => {
    try {
        // 1. Extract query parameters with defaults
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10)); // Max 50 per request
        const sortOrder = req.query.sort === 'asc' ? 1 : -1; // Default to -1 (newest first)
        const category = req.query.category;

        // 2. Build the query
        const query = { userId: req.user.id };
        if (category) {
            query.documentCategory = category;
        }

        // 3. Execute query in parallel with count to minimize wait time
        const [docs, total] = await Promise.all([
            Document.find(query)
                .sort({ createdAt: sortOrder })
                .skip((page - 1) * limit)
                .limit(limit)
                .select('-serverPath') // Hide the physical path from the client
                .lean(), // .lean() drastically reduces memory usage for read-only ops
            
            Document.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: docs,
            pagination: {
                totalDocuments: total,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                hasNextPage: (page * limit) < total
            }
        });
    } catch (error) {
        console.error(`[DocsManager] ❌ GET MY DOCS ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Failed to retrieve documents." });
    }
};

// 9. Get Documents Shared With Me
exports.getSharedWithMe = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const sortOrder = req.query.sort === 'asc' ? 1 : -1;
        const category = req.query.category;

        // Step 1: Find all access records where user is in sharedWithUsers array
        const accessRecords = await DocumentAccess.find({ sharedWithUsers: req.user.id })
            .select('documentId')
            .lean();

        // Extract just the IDs
        const sharedDocIds = accessRecords.map(record => record.documentId);

        if (sharedDocIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                pagination: { totalDocuments: 0, currentPage: 1, totalPages: 0, hasNextPage: false }
            });
        }

        // Step 2: Build the query for the Document collection
        const query = { _id: { $in: sharedDocIds } };
        if (category) {
            query.documentCategory = category;
        }

        const [docs, total] = await Promise.all([
            Document.find(query)
                .sort({ createdAt: sortOrder })
                .skip((page - 1) * limit)
                .limit(limit)
                .select('-serverPath') 
                .lean(),
            
            Document.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: docs,
            pagination: {
                totalDocuments: total,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                hasNextPage: (page * limit) < total
            }
        });
    } catch (error) {
        console.error(`[DocsManager] ❌ GET SHARED DOCS ERROR:`, error.message);
        res.status(500).json({ success: false, message: "Failed to retrieve shared documents." });
    }
};