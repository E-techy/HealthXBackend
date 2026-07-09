const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    date: { type: Date, default: Date.now, required: true },
    
    // Quantity tracking
    amountTaken: { type: String, required: true }, // e.g., "400grams", "1 litres"
    totalQuantity: { type: String }, // e.g., "100 grams"
    aiRecommendedQuantity: { type: String }, // e.g., "50 grams"
    isFullyEaten: { type: Boolean, default: true }, // To track leftovers
    
    // Meal Categorization
    mealType: { type: String }, // e.g., "SNACK", "BREAKFAST"
    mealCategory: { type: String, enum: ['VEG', 'NON_VEG', 'VEGAN', 'UNKNOWN'], default: 'UNKNOWN' },
    physicalState: { type: String, enum: ['SOLID', 'LIQUID', 'MIX'] },
    isOrganic: { type: Boolean, default: false },
    
    // Ingredients & Composition
    ingredients: [{ type: String }],
    allergens: [{ type: String }],
    chemicalsOrPreservatives: [{ type: String }],
    
    // Nutrition mapping (String format as requested)
    nutritionValuePerUnit: { type: String }, // e.g., "per 100 grams" or "per 100 ml"
    
    // Packaged / Commercial Food Data
    brandName: { type: String },
    manufacturerInfo: { type: String },
    manufactureDate: { type: Date },
    expiryDate: { type: Date },
    countryOfOrigin: { type: String },
    
    // Location Data
    location: {
        name: { type: String },
        coordinates: {
            lat: { type: Number },
            lng: { type: Number }
        }
    },

    // AI Insights (JSON format with good/bad split)
    aiInsights: {
        whyGood: [{ type: String }],
        whyNot: [{ type: String }]
    },
    
    // Media
    imageUrls: [{ type: String }] // Supports single or multiple photos

}, { timestamps: true });

module.exports = mongoose.model('Meal', mealSchema);