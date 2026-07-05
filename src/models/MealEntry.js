const mongoose = require('mongoose');

const mealEntrySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    date: { type: String, required: true, index: true }, // Format: YYYY-MM-DD for easy querying
    timestamp: { type: Number, default: () => Date.now() },
    
    entryType: { type: String, enum: ['MANUAL', 'AI_SCAN'], required: true },
    mealCategory: { type: String, enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'HYDRATION'] },
    
    foodName: { type: String, required: true },
    imageUrl: { type: String }, // Populated if AI_SCAN
    
    // Core Macros consumed in this specific meal
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 }, // in grams
    carbs: { type: Number, default: 0 },   // in grams
    fat: { type: Number, default: 0 },     // in grams
    waterVolume: { type: Number, default: 0 }, // in liters/ml

    sugar: { type: Number, default: 0 },
    sodium: { type: Number, default: 0 },
    detectedCategory: { type: String },
    
    // AI Specific Data
    foodScore: { type: Number }, // 1-100 score of how healthy this item is
    aiInsights: { type: String }, // e.g., "High in sodium, good source of fiber"
    portionEaten: { type: Number, default: 100 } // Percentage (0-100) or grams
}, { timestamps: true });

module.exports = mongoose.model('MealEntry', mealEntrySchema);