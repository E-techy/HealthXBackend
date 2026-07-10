const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const nutritionController = require('../controllers/nutritionController');
const { requireJWT } = require('../middlewares/authMiddleware');

// ==========================================
// MULTER CONFIGURATION
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/nutrition/'); 
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Create a wrapper for Multer to catch file upload errors safely (supporting multiple files)
const safeUploadArray = (req, res, next) => {
    // Allows up to 10 images per request under the field name 'images'
    const uploadArray = upload.array('images', 10); 
    
    uploadArray(req, res, (err) => {
        if (err) {
            console.error(`[Upload Error] Multer failed: ${err.message}`);
            return res.status(400).json({ 
                success: false, 
                message: "Image upload failed, interrupted, or exceeded limits." 
            });
        }
        next();
    });
};

// Apply JWT middleware to all routes in this file
router.use(requireJWT);

// ==========================================
// ROUTES
// ==========================================

// ONLY active route for now as requested
router.post('/ai/analyze', safeUploadArray, nutritionController.analyzeFoodImages);

module.exports = router;