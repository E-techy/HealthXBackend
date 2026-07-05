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
        // Ensure this directory exists in your project root, 
        // or configure it to point to a cloud bucket buffer.
        cb(null, 'public/uploads/nutrition/'); 
    },
    filename: (req, file, cb) => {
        // Create a unique filename to prevent collisions
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// We expect the client to send the file in a field named 'image'
const upload = multer({ storage });

// ==========================================
// ROUTES
// ==========================================

// All nutrition routes require a valid user token
router.use(requireJWT);

// Dashboard & Timelines
router.get('/today', nutritionController.getTodaysDashboard);
router.get('/graph', nutritionController.getNutritionGraph); // Use query params ?range=week

// Manual Data Entry
router.post('/manual', nutritionController.addManualEntry);

// AI Vision Features
// --> ADDED: upload.single('image') middleware intercepts the file before it hits the controller
router.post('/ai/analyze', upload.single('image'), nutritionController.analyzeFoodImage); 
router.post('/ai/save', nutritionController.saveAnalyzedMeal); 

// Sync
router.post('/sync', nutritionController.syncNutritionData);

module.exports = router;