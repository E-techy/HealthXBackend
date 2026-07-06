const mongoose = require('mongoose');

const mealEntrySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    timestamp: { type: Number, default: () => Date.now() },
    
    entryType: { type: String, enum: ['MANUAL', 'AI_SCAN'], required: true },
    mealCategory: { type: String, enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'HYDRATION'] },
    
    foodName: { type: String, required: true },
    imageUrl: { type: String },
    
    // ===============================
    // Nutrient Maps
    // ===============================
    nutrients: {
        type: Map,
        of: Number,
        default: {}
    },
    otherNutrients: {
        type: Map,
        of: Number,
        default: {}
    },

    // ===============================
    // Food Origin & Brand Info
    // ===============================
    foodSourceCategory: { 
        type: String, 
        enum: ['BRANDED', 'LOCAL', 'TREE_BASED', 'FARM_FRESH', 'RESTAURANT', 'UNKNOWN'],
        default: 'UNKNOWN'
    },
    brandName: { type: String },
    manufactureDate: { type: Date }, // Extracted from label if possible
    expiryDate: { type: Date },      // Extracted from label if possible
    barcode: { type: String },
    countryOfOrigin: { type: String },

    // ===============================
    // Dietary Flags & Composition
    // ===============================
    ingredients: [{ type: String }],
    allergens: [{ type: String }],
    isVegetarian: { type: Boolean },
    isVegan: { type: Boolean },
    isGlutenFree: { type: Boolean },
    isOrganic: { type: Boolean },

    // ===============================
    // AI Metrics
    // ===============================
    detectedCategory: { type: String },
    foodScore: { type: Number },
    aiInsights: { type: String },
    portionEaten: { type: Number, default: 100 },
    servingSize: { type: Number, default: 100 },
    servingUnit: { type: String, default: 'g' }

}, { timestamps: true });

module.exports = mongoose.model('MealEntry', mealEntrySchema);