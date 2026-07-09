const mongoose = require('mongoose');

const nutritionGoalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    
    goalType: { type: String, required: true }, // e.g., "WEIGHT_LOSS", "MUSCLE_GAIN"
    
    // ==========================================
    // MULTIPLE TARGETS ADDED HERE
    // ==========================================
    targets: [{
        nutrientName: { type: String, required: true }, // e.g., "Protein", "Calories"
        targetAmount: { type: Number, required: true }  // e.g., 140, 2400
    }],
    
    // Timeframe
    goalStartDate: { type: Date, required: true },
    goalEndDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    
    // Chart tracking for daily completion
    progressChart: [{
        date: { type: String, required: true }, // e.g., "YYYY-MM-DD"
        
        // Tracks progress for EACH nutrient in this specific goal
        nutrientProgress: [{
            nutrientName: { type: String, required: true },
            amountCompleted: { type: Number, default: 0 }, 
            isCompleted: { type: Boolean, default: false } 
        }]
    }]

}, { timestamps: true });

module.exports = mongoose.model('NutritionGoal', nutritionGoalSchema);