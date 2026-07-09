const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    date: { type: Date, default: Date.now, required: true },
    
    // Quantity tracking
    amountTaken: { type: String, required: true }, // e.g., "400grams", "1 litres"
    totalQuantity: { type: String }, // e.g., "100 grams"
    aiRecommendedQuantity: { type: String }, // e.g., "50 grams"
    isFullyEaten: { type: Boolean, default: true }, 
    
    // Meal Categorization
    mealType: { type: String }, 
    mealCategory: { type: String, enum: ['VEG', 'NON_VEG', 'VEGAN', 'UNKNOWN'], default: 'UNKNOWN' },
    physicalState: { type: String, enum: ['SOLID', 'LIQUID', 'MIX'] },
    isOrganic: { type: Boolean, default: false },
    
    // Ingredients & Composition
    ingredients: [{ type: String }],
    allergens: [{ type: String }],
    chemicalsOrPreservatives: [{ type: String }],
    
    // ==========================================
    // MULTIPLE NUTRIENTS ADDED HERE
    // ==========================================
    nutrients: [{
        name: { type: String, required: true }, // e.g., "Protein", "Carbs", "Sodium"
        amount: { type: String, required: true } // e.g., "50grams", "120mg"
    }],
    nutritionValuePerUnit: { type: String }, // e.g., "per 100 grams"
    
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

    // AI Insights 
    aiInsights: {
        whyGood: [{ type: String }],
        whyNot: [{ type: String }]
    },
    
    // Media
    imageUrls: [{ type: String }] 

}, { timestamps: true });

module.exports = mongoose.model('Meal', mealSchema);