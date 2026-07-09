const mongoose = require('mongoose');

const dailyNutritionLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    date: { type: String, required: true, index: true }, // e.g., "YYYY-MM-DD"
    
    // Array of string-based nutrients handled by AI
    // e.g., [{ name: "Protein", amount: "50grams" }]
    basicNutrients: [{
        name: { type: String, required: true },
        amount: { type: String, required: true }
    }],
    
    // Core macros (Explicitly Number types)
    // Note: Ensure your AI responses are parsed to valid Numbers before saving here to prevent CastErrors
    totalCalories: { type: Number, default: 0 },
    totalProtein: { type: Number, default: 0 },
    totalCarbs: { type: Number, default: 0 },
    totalFat: { type: Number, default: 0 },
    saturatedFat: { type: Number, default: 0 },
    unsaturatedFat: { type: Number, default: 0 },
    totalWater: { type: Number, default: 0 },
    
    // Relational tracking
    mealsAttached: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Meal' }],
    
    lastUpdatedAt: { type: Date, default: Date.now }
    
}, { timestamps: true });

// Ensure one log per user per day
dailyNutritionLogSchema.index({ userId: 1, date: 1 }, { unique: true });

// Auto-update lastUpdatedAt on save
dailyNutritionLogSchema.pre('save', function(next) {
    this.lastUpdatedAt = Date.now();
    next();
});

module.exports = mongoose.model('DailyNutritionLog', dailyNutritionLogSchema);