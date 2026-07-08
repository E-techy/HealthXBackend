const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const nutritionController = require('../controllers/nutritionController');
const { requireJWT } = require('../middlewares/authMiddleware');

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
router.use(requireJWT);

// Create a wrapper for Multer to catch "Request aborted" errors safely
const safeUpload = (req, res, next) => {
    const uploadSingle = upload.single('image');
    
    uploadSingle(req, res, (err) => {
        if (err) {
            console.error(`[Upload Error] Multer failed: ${err.message}`);
            // If the client drops connection, just return a 400 instead of crashing Node
            return res.status(400).json({ 
                success: false, 
                message: "Image upload was interrupted or aborted by the client." 
            });
        }
        next();
    });
};

// Dashboard & Timelines
router.get('/today', nutritionController.getTodaysDashboard);
router.get('/graph', nutritionController.getNutritionGraph); // Use query params ?range=week

// Manual Data Entry
router.post('/manual', nutritionController.addManualEntry);

// AI Vision Features
// --> ADDED: upload.single('image') middleware intercepts the file before it hits the controller
router.post('/ai/analyze', safeUpload, nutritionController.analyzeFoodImage);
router.post('/ai/save', nutritionController.saveAnalyzedMeal); 

// Sync
router.post('/sync', nutritionController.syncNutritionData);

module.exports = router;