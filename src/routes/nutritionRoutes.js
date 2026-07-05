const express = require('express');
const router = express.Router();
const nutritionController = require('../controllers/nutritionController');
const { requireJWT } = require('../middlewares/authMiddleware');

// All nutrition routes require a valid user token
router.use(requireJWT);

// Dashboard & Timelines
router.get('/today', nutritionController.getTodaysDashboard);
router.get('/graph', nutritionController.getNutritionGraph); // Use query params ?range=week

// Manual Data Entry
router.post('/manual', nutritionController.addManualEntry);

// AI Vision Features
router.post('/ai/analyze', nutritionController.analyzeFoodImage); // Checks Pro Status
router.post('/ai/save', nutritionController.saveAnalyzedMeal); // Confirms and logs the meal

// Sync
router.post('/sync', nutritionController.syncNutritionData);

module.exports = router;