const Document = require('../models/Document');
const DocumentAccess = require('../models/DocumentAccess');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const safeDownload = (res, filePath, fileName, docId) => {
    res.download(filePath, fileName, (err) => {
        if (err) {
            console.error(`[DocsManager] ❌ Stream Error for DocID ${docId}:`, err.message);
            if (!res.headersSent) {
                res.status(404).json({ success: false, message: "File could not be found on the server or transfer failed." });
            }
        } else {
            console.log(`[DocsManager] ✅ Successfully served DocID ${docId}`);
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

        res.status(201).json({ success: true, message: "Document uploaded successfully.", document: newDoc });
    } catch (error) {
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

        // If it requires a password, serve the HTML Form!
        // Note: Returning a 401 ensures the Android App knows it needs a password without crashing.
        if (access.passwordHash) {
            const htmlForm = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>HealthX - Secure Document</title>
                <style>
                    body { font-family: system-ui, -apple-system, sans-serif; background-color: #000; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .card { background-color: #1E1E1E; padding: 2.5rem; border-radius: 16px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 90%; max-width: 350px; }
                    h2 { margin-top: 0; color: #64B5F6; }
                    p { color: #aaa; font-size: 14px; margin-bottom: 1.5rem; }
                    input { width: 100%; padding: 12px; margin-bottom: 1rem; box-sizing: border-box; border-radius: 8px; border: 1px solid #333; background-color: #121212; color: #fff; font-size: 16px; }
                    input:focus { outline: none; border-color: #1E88E5; }
                    button { width: 100%; padding: 14px; border: none; border-radius: 8px; background-color: #1E88E5; color: #fff; font-weight: bold; font-size: 16px; cursor: pointer; transition: 0.2s; }
                    button:hover { background-color: #1565C0; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>🔒 Secure Document</h2>
                    <p>This document is password protected. Enter the password below to access it.</p>
                    <form action="/api/docs/public/${publicKey}/secure" method="POST">
                        <input type="password" name="password" placeholder="Enter Password" required autofocus />
                        <button type="submit">Unlock Document</button>
                    </form>
                </div>
            </body>
            </html>
            `;
            return res.status(401).send(htmlForm);
        }

        const doc = access.documentId;
        safeDownload(res, doc.serverPath, doc.documentName, doc._id);
    } catch (error) {
        res.status(500).send("<h2>500 - Error accessing public document.</h2>");
    }
};

exports.downloadPublicSecure = async (req, res) => {
    try {
        const { publicKey } = req.params;
        const { password } = req.body;
        
        // Did this come from a Browser HTML form, or the Android App?
        const isBrowserForm = req.is('application/x-www-form-urlencoded');

        if (!password) {
            if (isBrowserForm) return res.status(400).send("<h2>Password is required. Go back and try again.</h2>");
            return res.status(400).json({ success: false, message: "Password is required." });
        }

        const access = await DocumentAccess.findOne({ publicKey, isPublic: true }).populate('documentId');
        if (!access || !access.documentId) {
            if (isBrowserForm) return res.status(404).send("<h2>Invalid link.</h2>");
            return res.status(404).json({ success: false, message: "Invalid or inactive public link." });
        }

        const isMatch = await bcrypt.compare(password, access.passwordHash);
        if (!isMatch) {
            // If browser: pop up a javascript alert and redirect them back to the form!
            if (isBrowserForm) {
                return res.status(401).send(`
                    <script>
                        alert("Incorrect password!");
                        window.history.back();
                    </script>
                `);
            }
            return res.status(401).json({ success: false, message: "Incorrect password." });
        }

        const doc = access.documentId;
        safeDownload(res, doc.serverPath, doc.documentName, doc._id);
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