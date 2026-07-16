const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const nutritionController = require('../controllers/nutritionController');
const logController = require('../controllers/nutritionLogController');
const { requireJWT } = require('../middlewares/authMiddleware');

// 1. IMPORT THE DELEGATED ACCESS MIDDLEWARE
const { requireDelegatedAccess } = require('../middlewares/delegatedAccessMiddleware'); 

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

// ==========================================
// MIDDLEWARE PIPELINE
// ==========================================

// 2. Ensure every request is authenticated first
router.use(requireJWT);

// ==========================================
// SECURE DELEGATED ROUTES
// ==========================================

// Nutrition Analysis (Requires Write/Edit access)
router.post(
    '/ai/analyze', 
    safeUploadArray, 
    requireDelegatedAccess('EDIT_NUTRITION'), 
    nutritionController.analyzeFoodImages
);

// Log and Meal Routes (Split between Read and Write)
router.post(
    '/log/save', 
    requireDelegatedAccess('EDIT_NUTRITION'), 
    logController.saveMealToLog
);

router.get(
    '/meals', 
    requireDelegatedAccess('SEE_NUTRITION'), 
    logController.getMeals
);

// Goals Routes (Split between Read and Write)
router.post(
    '/goals', 
    requireDelegatedAccess('EDIT_GOALS'), 
    logController.createGoal
);

router.get(
    '/goals', 
    requireDelegatedAccess('SEE_GOALS'), 
    logController.getGoals
);

module.exports = router;