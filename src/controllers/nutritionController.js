const MealEntry = require('../models/MealEntry');
const NutritionLog = require('../models/NutritionLog');
const UserSubscription = require('../models/UserSubscription');
const UserProfile = require('../models/UserProfile');
const aiService = require('../services/aiService');
const fs = require('fs');
const { categorizeNutrients } = require('../utils/nutrientMapper');
// ==========================================
// UTILITY FUNCTIONS
// ==========================================
const getTodayDateString = () => new Date().toISOString().split('T')[0];

const calculateHealthScore = (log) => {
    let score = 100;
    const calRatio = log.totalCalories / log.targetCalories;
    if (calRatio > 1.2 || calRatio < 0.5) score -= 20;

    const proRatio = log.totalProtein / log.targetProtein;
    if (proRatio < 0.5) score -= 15;

    return Math.max(0, Math.min(100, Math.round(score)));
};

const updateDailyLog = async (userId, date) => {
    const meals = await MealEntry.find({ userId, date });
    
    const totals = meals.reduce((acc, meal) => {
        acc.cals += meal.calories;
        acc.pro += meal.protein;
        acc.carbs += meal.carbs;
        acc.fat += meal.fat;
        acc.water += meal.waterVolume;
        return acc;
    }, { cals: 0, pro: 0, carbs: 0, fat: 0, water: 0 });

    const log = await NutritionLog.findOneAndUpdate(
        { userId, date },
        {
            totalCalories: totals.cals,
            totalProtein: totals.pro,
            totalCarbs: totals.carbs,
            totalFat: totals.fat,
            totalWater: totals.water
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    log.dailyHealthScore = calculateHealthScore(log);
    await log.save();

    return log;
};

// ==========================================
// ROUTE HANDLERS
// ==========================================

exports.addManualEntry = async (req, res) => {
    try {
        const { mealCategory, foodName, calories, protein, carbs, fat, waterVolume } = req.body;
        const date = getTodayDateString();

        const entry = await MealEntry.create({
            userId: req.user.id,
            date,
            entryType: 'MANUAL',
            mealCategory,
            foodName,
            calories: calories || 0,
            protein: protein || 0,
            carbs: carbs || 0,
            fat: fat || 0,
            waterVolume: waterVolume || 0
        });

        const updatedLog = await updateDailyLog(req.user.id, date);
        res.status(201).json({ success: true, entry, dailyLog: updatedLog });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error adding manual entry." });
    }
};

exports.analyzeFoodImage = async (req, res) => {
    const logPrefix = `[AnalyzeFoodImage | User: ${req.user.id}]`;
    console.log(`${logPrefix} Request received.`);

    try {
        if (!req.file) {
            console.error(`${logPrefix} Failure: No image provided.`);
            return res.status(400).json({ success: false, message: "No image provided." });
        }
        
        const imagePath = req.file.path;
        const mimeType = req.file.mimetype;
        const portionSize = req.body.portionSize || 100; 
        const userProvidedApiKey = req.headers['x-gemini-api-key'];

        console.log(`${logPrefix} Image uploaded: ${imagePath}, Portion: ${portionSize}g`);

        // 1. Subscription Check
        if (!userProvidedApiKey) {
            const sub = await UserSubscription.findOne({ userId: req.user.id });
            if (!sub || sub.status === 'FREE') {
                console.warn(`${logPrefix} Failure: User requires PRO subscription.`);
                fs.unlinkSync(imagePath); 
                return res.status(403).json({ 
                    success: false, 
                    requiresPro: true,
                    message: "Subscribe to HealthX PRO or provide your API key to access AI Food Analysis." 
                });
            }
        }

        // 2. Gather Context
        console.log(`${logPrefix} Gathering user context...`);
        const profile = await UserProfile.findOne({ userId: req.user.id }) || {};
        const userData = {
            age: profile.vitalStats?.age,
            weight: profile.vitalStats?.weight,
            bloodPressure: profile.vitalStats?.bloodPressure
        };

        const date = getTodayDateString();
        let todayLog = await NutritionLog.findOne({ userId: req.user.id, date });
        if (!todayLog) {
            todayLog = { 
                totalCalories: 0, targetCalories: 2400,
                totalProtein: 0, targetProtein: 140,
                totalCarbs: 0, totalFat: 0 
            };
        }

        // 3. AI Step 1: Vision Extraction
        console.log(`${logPrefix} Executing AI Step 1 (Vision Extraction)...`);
        const baseFoodData = await aiService.extractFoodDataFromImage(imagePath, mimeType, userProvidedApiKey);

        // 4. AI Step 2: Contextual Analysis
        console.log(`${logPrefix} Executing AI Step 2 (Contextual Analysis)...`);
        const contextualData = await aiService.analyzeFoodContext(userData, todayLog, baseFoodData, portionSize, userProvidedApiKey);

        // 5. Construct Final Payload (FIXED TO MATCH ANDROID CLASS)
        const finalResponse = {
            foodDetected: baseFoodData.foodName || "Unknown Food",
            foodCategory: baseFoodData.foodCategory || "UNKNOWN",
            portionAnalyzed: portionSize,
            
            // FIX: Map the backend rawNutrients to what Android expects (rawNutrientsExtracted)
            rawNutrientsExtracted: contextualData.rawNutrients, 
            
            scores: {
                foodQualityScore: contextualData.foodQualityScore || 0,
                eatRecommendationScore: contextualData.eatRecommendationScore || 0
            },
            aiInsights: contextualData.aiInsights || "No insights available.",
            
            // FIX: Pass allergens from base extraction down to Android
            allergens: baseFoodData.allergens || [],
            
            imageUrl: `/public/uploads/nutrition/${req.file.filename}` 
        };

        console.log(`${logPrefix} Success: AI Analysis complete. Sending payload.`);
        console.log(`\n==================================================`);
        console.log(`${logPrefix} FINAL PAYLOAD SENDING TO ANDROID:`);
        console.log(JSON.stringify(finalResponse, null, 2));
        console.log(`==================================================\n`);
        res.status(200).json({ success: true, data: finalResponse });

    } catch (error) {
        console.error(`${logPrefix} Fatal Error:`, error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: "AI Analysis failed.", error: error.message });
    }
};

exports.saveAnalyzedMeal = async (req, res) => {
    const logPrefix = `[SaveAnalyzedMeal | User: ${req.user.id}]`;
    console.log(`${logPrefix} Request received for food: ${req.body.foodName}`);

    try {
        const { 
            mealCategory, 
            foodName, 
            imageUrl, 
            rawNutrients, 
            foodQualityScore, 
            aiInsights,
            portionAnalyzed,
            brandName,
            foodSourceCategory,
            manufactureDate,
            expiryDate,
            ingredients,
            allergens,
            isVegetarian,
            isVegan,
            isGlutenFree
        } = req.body;
        
        const date = getTodayDateString();

        console.log(`${logPrefix} Categorizing nutrients...`);
        const { mainNutrients, otherNutrients } = categorizeNutrients(rawNutrients);

        console.log(`${logPrefix} Creating MealEntry document...`);
        const entry = await MealEntry.create({
            userId: req.user.id,
            date,
            entryType: 'AI_SCAN',
            mealCategory,
            foodName,
            imageUrl,
            foodScore: foodQualityScore,
            aiInsights,
            portionEaten: portionAnalyzed,
            nutrients: mainNutrients,
            otherNutrients: otherNutrients,
            brandName,
            foodSourceCategory: foodSourceCategory || 'UNKNOWN',
            manufactureDate: manufactureDate ? new Date(manufactureDate) : null,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            ingredients: ingredients || [],
            allergens: allergens || [],
            isVegetarian,
            isVegan,
            isGlutenFree
        });

        console.log(`${logPrefix} Updating daily log totals...`);
        const updatedLog = await updateDailyLog(req.user.id, date);

        console.log(`${logPrefix} Success: Meal saved and log updated.`);
        res.status(201).json({ success: true, entry, dailyLog: updatedLog });
    } catch (error) {
        console.error(`${logPrefix} Fatal Error:`, error);
        res.status(500).json({ success: false, message: "Failed to save AI meal." });
    }
};

// ... keep getTodaysDashboard, getNutritionGraph, and syncNutritionData exactly as they were ...
// 4. Get Today's Dynamic Dashboard
exports.getTodaysDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const date = getTodayDateString();

        // Get the high-level summary
        let dailySummary = await NutritionLog.findOne({ userId, date });
        if (!dailySummary) {
            // Return empty layout if nothing logged yet
            dailySummary = { totalCalories: 0, dailyHealthScore: 0 }; 
        }

        // Get the chronological timeline of meals
        const timeline = await MealEntry.find({ userId, date }).sort({ timestamp: -1 });

        res.status(200).json({ 
            success: true, 
            summary: dailySummary,
            meals: timeline 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch dashboard." });
    }
};

// 5. Get Nutrition Graph Data (Time-series)
exports.getNutritionGraph = async (req, res) => {
    try {
        const userId = req.user.id;
        const { range } = req.query; // e.g., ?range=week, ?range=month
        
        let limit = 7;
        if (range === 'month') limit = 30;
        if (range === 'year') limit = 365;

        // Fetch logs sorted by date descending, then limit to the requested range
        const logs = await NutritionLog.find({ userId })
            .sort({ date: -1 })
            .limit(limit)
            .select('date dailyHealthScore totalCalories totalProtein totalWater');

        // Reverse to chronological order for graphing
        res.status(200).json({ success: true, data: logs.reverse() });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch graph data." });
    }
};

// 6. Sync Data (Bi-directional)
exports.syncNutritionData = async (req, res) => {
    try {
        const { localEntries } = req.body; 
        const userId = req.user.id;

        // If the Android app has offline entries, insert them first
        if (localEntries && localEntries.length > 0) {
            // Note: In production, handle deduplication here
            await MealEntry.insertMany(localEntries.map(e => ({ ...e, userId })));
            
            // Re-calculate the daily logs for any affected dates
            const uniqueDates = [...new Set(localEntries.map(e => e.date))];
            for (const date of uniqueDates) {
                await updateDailyLog(userId, date);
            }
        }

        // Send back the absolute source of truth from the server for today
        const date = getTodayDateString();
        const serverSummary = await NutritionLog.findOne({ userId, date });
        
        res.status(200).json({ success: true, message: "Sync complete.", serverSummary });
    } catch (error) {
        res.status(500).json({ success: false, message: "Sync failed." });
    }
};