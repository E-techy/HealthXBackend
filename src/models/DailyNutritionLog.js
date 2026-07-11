const mongoose = require('mongoose');

const dailyNutritionLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    date: { type: String, required: true, index: true }, 
    
    basicNutrients: [{
        name: { type: String, required: true },
        amount: { type: String, required: true }
    }],
    
    // Core macros converted to String to prevent CastErrors from AI outputs
    totalCalories: { type: String, default: "0" },
    totalProtein: { type: String, default: "0" },
    totalCarbs: { type: String, default: "0" },
    totalFat: { type: String, default: "0" },
    saturatedFat: { type: String, default: "0" },
    unsaturatedFat: { type: String, default: "0" },
    totalWater: { type: String, default: "0" },
    
    healthScore: { type: Number, default: 0, min: 0, max: 100 }, // Tracked 0-100
    
    // Updated to include amountEaten and time
    mealsAttached: [{ 
        mealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meal' },
        amountEaten: { type: String, required: true },
        timeTaken: { type: Date, default: Date.now }
    }],
    
    lastUpdatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

dailyNutritionLogSchema.index({ userId: 1, date: 1 }, { unique: true });

dailyNutritionLogSchema.pre('save', function(next) {
    this.lastUpdatedAt = Date.now();
    next();
});

module.exports = mongoose.model('DailyNutritionLog', dailyNutritionLogSchema);