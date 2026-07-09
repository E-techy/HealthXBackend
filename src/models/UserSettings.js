const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
    companyName: { type: String, required: true },
    modelName: { type: String, required: true },
    apiKeyValue: { type: String, required: true }
}, { _id: false }); // Disable separate _ids for sub-documents to keep it clean

const userSettingsSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserAuth', 
        required: true, 
        unique: true 
    },
    name: { type: String, default: null },
    weight: { type: String, default: null },
    height: { type: String, default: null },
    allergies: { type: [String], default: [] }, // Array of strings
    apiKeys: { type: [apiKeySchema], default: [] }, // Array of API key objects
    theme: { 
        type: String, 
        enum: ['light', 'dark', 'system'], 
        default: 'system' 
    },
    notificationToneUrl: { type: String, default: null },
    profileIcon: { type: String, default: null },
    ethnicity: { type: String, default: null },
    country: { type: String, default: null },
    state: { type: String, default: null },
    preferredLanguage: { type: String, default: null }
}, {
    timestamps: true 
});

module.exports = mongoose.model('UserSettings', userSettingsSchema);