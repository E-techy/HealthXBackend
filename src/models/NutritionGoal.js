const mongoose = require('mongoose');

const nutritionGoalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    goalType: { type: String, required: true },
    
    targets: [{
        nutrientName: { type: String, required: true }, 
        targetAmount: { type: String, required: true }  // Changed to String
    }],
    
    goalStartDate: { type: Date, required: true },
    goalEndDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    
    progressChart: [{
        date: { type: String, required: true }, 
        nutrientProgress: [{
            nutrientName: { type: String, required: true },
            amountCompleted: { type: String, default: "0" }, // Changed to String
            isCompleted: { type: Boolean, default: false } 
        }]
    }]
}, { timestamps: true });

module.exports = mongoose.model('NutritionGoal', nutritionGoalSchema);