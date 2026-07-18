const Document = require('../models/Document');
const DocumentAccess = require('../models/DocumentAccess');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// 1. Upload a Document
exports.uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded." });
        }

        const { documentName, documentCategory } = req.body;
        
        // Save Core Document
        const newDoc = new Document({
            userId: req.user.id,
            documentName: documentName || req.file.originalname,
            documentType: req.file.mimetype,
            documentCategory: documentCategory || 'OTHER',
            serverPath: req.file.path // The secure path assigned by Multer
        });
        await newDoc.save();

        // Initialize Access settings (Private by default)
        const access = new DocumentAccess({
            documentId: newDoc._id
        });
        await access.save();

        res.status(201).json({
            success: true,
            message: "Document uploaded successfully.",
            document: newDoc
        });
    } catch (error) {
        console.error("🔥 DOC UPLOAD ERROR:", error);
        res.status(500).json({ success: false, message: "Error uploading document." });
    }
};

// 2. Make Document Public (Generate Link)
exports.makePublic = async (req, res) => {
    try {
        const { documentId } = req.params;
        
        // Verify ownership
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) return res.status(404).json({ success: false, message: "Document not found or unauthorized." });

        // Generate a random URL-safe key
        const publicKey = crypto.randomBytes(16).toString('hex');

        await DocumentAccess.findOneAndUpdate(
            { documentId },
            { isPublic: true, publicKey: publicKey },
            { new: true }
        );

        // This URL is what the Android app will share
        const publicUrl = `/api/docs/public/${publicKey}`;

        res.status(200).json({ success: true, message: "Document is now public.", publicUrl, publicKey });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error making document public." });
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

        res.status(200).json({ success: true, message: "Password protection enabled." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error setting password." });
    }
};

// 4. Share with Specific User
exports.shareWithUser = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { targetUserId } = req.body;

        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) return res.status(404).json({ success: false, message: "Document not found or unauthorized." });

        await DocumentAccess.findOneAndUpdate(
            { documentId },
            { $addToSet: { sharedWithUsers: targetUserId } } // $addToSet prevents duplicates
        );

        res.status(200).json({ success: true, message: "Document shared successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error sharing document." });
    }
};

// 5. Download Public Document
exports.downloadPublic = async (req, res) => {
    try {
        const { publicKey } = req.params;
        
        const access = await DocumentAccess.findOne({ publicKey, isPublic: true }).populate('documentId');
        if (!access || !access.documentId) {
            return res.status(404).json({ success: false, message: "Invalid or inactive public link." });
        }

        const doc = access.documentId;
        
        // Serve the physical file to the Android App to download
        res.download(doc.serverPath, doc.documentName);
    } catch (error) {
        res.status(500).json({ success: false, message: "Error downloading file." });
    }
};

// 6. Download Password Protected Document
exports.downloadSecure = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { password } = req.body; // Password sent in body from App

        const access = await DocumentAccess.findOne({ documentId }).populate('documentId');
        if (!access || !access.passwordHash) {
            return res.status(400).json({ success: false, message: "This document is not password protected." });
        }

        const isMatch = await bcrypt.compare(password, access.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Incorrect password." });
        }

        const doc = access.documentId;
        res.download(doc.serverPath, doc.documentName);
    } catch (error) {
        res.status(500).json({ success: false, message: "Error securely downloading file." });
    }
};

// 7. Download Owned or Shared Document (Standard Auth)
exports.downloadShared = async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.id; // From requireJWT

        const access = await DocumentAccess.findOne({ documentId }).populate('documentId');
        if (!access || !access.documentId) {
            return res.status(404).json({ success: false, message: "Document not found." });
        }

        const doc = access.documentId;
        const isOwner = doc.userId.toString() === userId;
        const isSharedUser = access.sharedWithUsers.includes(userId);

        if (!isOwner && !isSharedUser) {
            return res.status(403).json({ success: false, message: "You do not have permission to view this document." });
        }

        res.download(doc.serverPath, doc.documentName);
    } catch (error) {
        res.status(500).json({ success: false, message: "Error downloading shared file." });
    }
};