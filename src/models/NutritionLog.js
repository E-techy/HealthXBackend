const mongoose = require('mongoose');

const nutritionLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    
    totalCalories: { type: Number, default: 0 },
    totalProtein: { type: Number, default: 0 },
    totalCarbs: { type: Number, default: 0 },
    totalFat: { type: Number, default: 0 },
    totalWater: { type: Number, default: 0 },
    
    // Targets (Can be updated if user changes goals)
    targetCalories: { type: Number, default: 2400 },
    targetProtein: { type: Number, default: 140 },
    
    // Calculated Daily Health Score based on macros and food quality
    dailyHealthScore: { type: Number, default: 0 } 
}, { timestamps: true });

// Ensure one log per user per day
nutritionLogSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('NutritionLog', nutritionLogSchema);