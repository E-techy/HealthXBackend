const emergencyService = require('../services/emergencyService');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// Helper to extract JWT ID if present (used for joining routes and secure downloads)
const getOptionalUserId = (req) => {
    // Check Auth Header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            return decoded.id;
        } catch (e) { return null; }
    }
    // Check Query Param (useful for downloading files via direct URL)
    if (req.query.token) {
        try {
            const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET);
            return decoded.id;
        } catch (e) { return null; }
    }
    return null;
};

// ==============================================================
// OWNER ACTIONS
// ==============================================================

exports.create = async (req, res) => {
    try {
        console.log(`\n📥 [Controller: Create Emergency] Payload received from User ${req.user.id}`);
        // Extract all standard, spatial, and the new array fields
        const { title, description, password, isPublicVisibility, location, address, victims, culprits, detailedDocUri } = req.body;
        
        if (!title) return res.status(400).json({ success: false, message: 'Title is required.' });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
        const result = await emergencyService.createEmergency({ 
            title, description, password, isPublicVisibility, location, address, victims, culprits, detailedDocUri,
            userId: req.user.id, baseUrl 
        });

        console.log(`✅ [Controller: Create Emergency] Success: ${result.emergencyTrackingId}`);
        return res.status(201).json({ success: true, message: 'Emergency session created.', data: result });
    } catch (error) {
        console.error(`❌ [Controller: Create Emergency] Error:`, error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateDetails = async (req, res) => {
    try {
        console.log(`\n📥 [Controller: Update Details] ID: ${req.params.id}`);
        const updated = await emergencyService.updateEmergencyDetails(req.params.id, req.user.id, req.body);
        console.log(`✅ [Controller: Update Details] Success`);
        return res.status(200).json({ success: true, message: 'Emergency details updated.', data: updated });
    } catch (error) {
        console.error(`❌ [Controller: Update Details] Error:`, error.message);
        return res.status(403).json({ success: false, message: error.message });
    }
};

exports.getUserEmergencies = async (req, res) => {
    try {
        console.log(`\n📥 [Controller: Get My List] User: ${req.user.id}`);
        const filters = {
            status: req.query.status,
            startDate: req.query.startDate
        };
        const emergencies = await emergencyService.getUserEmergencies(req.user.id, filters);
        console.log(`✅ [Controller: Get My List] Found ${emergencies.length} records.`);
        return res.status(200).json({ success: true, count: emergencies.length, data: emergencies });
    } catch (error) {
        console.error(`❌ [Controller: Get My List] Error:`, error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ==============================================================
// PUBLIC DISCOVERY
// ==============================================================

exports.searchPublic = async (req, res) => {
    try {
        console.log(`\n🔍 [Controller: Search Public] Filters:`, req.query);
        const filters = {
            lng: req.query.lng,
            lat: req.query.lat,
            radiusKm: req.query.radius,
            state: req.query.state,
            city: req.query.city,
            country: req.query.country,
            startDate: req.query.startDate,
            limit: req.query.limit || 50
        };

        const emergencies = await emergencyService.searchPublicEmergencies(filters);
        console.log(`✅ [Controller: Search Public] Found ${emergencies.length} public records.`);
        
        return res.status(200).json({ success: true, count: emergencies.length, data: emergencies });
    } catch (error) {
        console.error(`❌ [Controller: Search Public] Error:`, error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ==============================================================
// FILE UPLOADS & SECURE DOWNLOADS
// ==============================================================

exports.uploadFiles = async (req, res) => {
    try {
        console.log(`\n📁 [Controller: Upload Files] Processing uploads...`);
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded.' });
        }

        const uploadedFiles = req.files.map(file => {
            // Extract the target folder (e.g. 'emergency_victim') from the absolute path
            const folderName = file.destination.split(/public[\\/]/)[1] || 'uploads';
            return {
                fieldname: file.fieldname,
                originalname: file.originalname,
                url: `/${folderName}/${file.filename}` // Relative URL to be saved in DB
            };
        });

        console.log(`✅ [Controller: Upload Files] Saved ${uploadedFiles.length} files. URLs generated.`);
        return res.status(200).json({ success: true, message: 'Files uploaded successfully.', data: uploadedFiles });
    } catch (error) {
        console.error(`❌ [Controller: Upload Files] Error:`, error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.downloadSecureDocument = async (req, res) => {
    try {
        const emergencyId = req.params.id;
        const requestingUserId = getOptionalUserId(req);
        
        console.log(`\n📄 [Controller: Download Doc] Request for Emergency: ${emergencyId}`);

        // The service checks if the doc is public, OR if the user is authorized via ACL
        const docUri = await emergencyService.validateDocumentAccess(emergencyId, requestingUserId);
        
        // Resolve absolute path from the relative DB URI (e.g. '/emergency_detailed_docs/file.pdf')
        const absolutePath = path.join(__dirname, '../../public', docUri);
        
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ success: false, message: 'File not found on server.' });
        }

        console.log(`✅ [Controller: Download Doc] Access Granted. Streaming file.`);
        res.download(absolutePath); // This streams the file and prompts a download in the browser
    } catch (error) {
        console.error(`❌ [Controller: Download Doc] Error:`, error.message);
        return res.status(403).json({ success: false, message: error.message });
    }
};

// ... [The rest of the exports (updateStatus, deleteSession, invite, joinViaMagicKey, joinViaCredentials, getInfo) remain exactly the same. Keep them here!] ...

exports.updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const updated = await emergencyService.updateEmergencyStatus(req.params.id, req.user.id, status);
        return res.status(200).json({ success: true, message: `Emergency status updated to ${status}.`, data: updated });
    } catch (error) {
        return res.status(403).json({ success: false, message: error.message });
    }
};

exports.deleteSession = async (req, res) => {
    try {
        await emergencyService.deleteEmergency(req.params.id, req.user.id);
        return res.status(200).json({ success: true, message: 'Emergency session permanently deleted.' });
    } catch (error) {
        return res.status(403).json({ success: false, message: error.message });
    }
};

exports.invite = async (req, res) => {
    try {
        const { userIds } = req.body; 
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Provide an array of userIds to invite.' });
        }
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const result = await emergencyService.inviteUsers(req.params.id, req.user.id, userIds, baseUrl);
        return res.status(200).json({ success: true, message: `Successfully invited and emailed ${result.invitedCount} responders.`, data: result });
    } catch (error) {
        return res.status(403).json({ success: false, message: error.message });
    }
};

exports.joinViaMagicKey = async (req, res) => {
    try {
        const { emergencyTrackingId, authKey } = req.body;
        const requestingUserId = getOptionalUserId(req); 
        const result = await emergencyService.authenticateViaAuthKey(emergencyTrackingId, authKey, requestingUserId);
        return res.status(200).json({ success: true, message: 'Authenticated via link successfully.', data: result });
    } catch (error) {
        return res.status(401).json({ success: false, message: error.message });
    }
};

exports.joinViaCredentials = async (req, res) => {
    try {
        const { emergencyTrackingId, password } = req.body;
        const requestingUserId = getOptionalUserId(req); 
        const result = await emergencyService.authenticateViaCredentials(emergencyTrackingId, password, requestingUserId);
        return res.status(200).json({ success: true, message: 'Authenticated successfully.', data: result });
    } catch (error) {
        return res.status(401).json({ success: false, message: error.message });
    }
};

exports.getInfo = async (req, res) => {
    try {
        const requestingUserId = getOptionalUserId(req); 
        const info = await emergencyService.getEmergencyPublicInfo(req.params.id, requestingUserId);
        return res.status(200).json({ success: true, data: info });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};
