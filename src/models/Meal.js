const mongoose = require('mongoose');

// ==========================================
// 1. Child Schema (Individual Food Items)
// ==========================================
const foodItemSchema = new mongoose.Schema({
    foodName: { type: String, required: true }, // e.g., "Grilled Salmon", "Coca Cola"
    
    // Quantity tracking
    amountTaken: { type: String, required: true }, 
    totalQuantity: { type: String }, 
    aiRecommendedQuantity: { type: String }, 
    
    // Item Categorization
    mealCategory: { type: String, enum: ['VEG', 'NON_VEG', 'VEGAN', 'UNKNOWN'], default: 'UNKNOWN' },
    physicalState: { type: String, enum: ['SOLID', 'LIQUID', 'MIX'] },
    isOrganic: { type: Boolean, default: false },
    
    // Ingredients & Composition
    ingredients: [{ type: String }],
    allergens: [{ type: String }],
    chemicalsOrPreservatives: [{ type: String }],
    
    // ==========================================
    // Core Nutrients (Explicitly String Type)
    // ==========================================
    totalCalories: { type: String, default: "0" },
    totalProtein: { type: String, default: "0" },
    totalCarbs: { type: String, default: "0" },
    totalFat: { type: String, default: "0" },
    saturatedFat: { type: String, default: "0" },
    unsaturatedFat: { type: String, default: "0" },
    totalWater: { type: String, default: "0" },
    
    // ==========================================
    // Other Nutrients (Vitamins, Minerals, etc.)
    // ==========================================
    otherNutrients: [{
        name: { type: String, required: true }, // e.g., "Sodium", "Vitamin C"
        amount: { type: String, required: true } // e.g., "320mg", "15mg"
    }],
    
    nutritionValuePerUnit: { type: String }, 
    
    // Packaged / Commercial Food Data (e.g., the Coke bottle)
    brandName: { type: String },
    manufacturerInfo: { type: String },
    manufactureDate: { type: Date },
    expiryDate: { type: Date },
    countryOfOrigin: { type: String },
    
    // Personalized AI Scoring per item
    foodScore: { type: Number, min: 0, max: 5 }, 
    foodScoreReason: { type: String }, 
    aiInsights: {
        whyGood: [{ type: String }],
        whyNot: [{ type: String }]
    }
});

// ==========================================
// 2. Parent Schema (The Meal Event)
// ==========================================
const mealSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    date: { type: Date, default: Date.now, required: true },
    
    mealType: { type: String }, // e.g., "LUNCH", "DINNER", "SNACK"
    isFullyEaten: { type: Boolean, default: true }, 
    
    // The list of distinct items detected in the images
    foodItems: [foodItemSchema],
    
    // Location Data for where the meal occurred
    location: {
        name: { type: String },
        coordinates: {
            lat: { type: Number },
            lng: { type: Number }
        }
    },
    
    // Media (All images uploaded for this specific eating event)
    imageUrls: [{ type: String }] 

}, { timestamps: true });

module.exports = mongoose.model('Meal', mealSchema);