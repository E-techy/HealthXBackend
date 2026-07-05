const MealEntry = require('../models/MealEntry');
const NutritionLog = require('../models/NutritionLog');
const UserSubscription = require('../models/UserSubscription');

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
const getTodayDateString = () => new Date().toISOString().split('T')[0];

const calculateHealthScore = (log) => {
    // Basic logic: Start at 100, deduct points for missing/exceeding targets
    let score = 100;
    
    // Calorie penalty (if they exceed or drop too low)
    const calRatio = log.totalCalories / log.targetCalories;
    if (calRatio > 1.2 || calRatio < 0.5) score -= 20;

    // Protein bonus/penalty
    const proRatio = log.totalProtein / log.targetProtein;
    if (proRatio < 0.5) score -= 15;

    return Math.max(0, Math.min(100, Math.round(score))); // Keep between 0-100
};

const updateDailyLog = async (userId, date) => {
    // 1. Fetch all meals for the day
    const meals = await MealEntry.find({ userId, date });
    
    // 2. Sum everything up
    const totals = meals.reduce((acc, meal) => {
        acc.cals += meal.calories;
        acc.pro += meal.protein;
        acc.carbs += meal.carbs;
        acc.fat += meal.fat;
        acc.water += meal.waterVolume;
        return acc;
    }, { cals: 0, pro: 0, carbs: 0, fat: 0, water: 0 });

    // 3. Upsert the Daily Log
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

    // 4. Calculate and save the health score
    log.dailyHealthScore = calculateHealthScore(log);
    await log.save();

    return log;
};

// ==========================================
// ROUTE HANDLERS
// ==========================================

// 1. Add Manual Entry (e.g., drank 1L water, ate an apple)
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

        // Trigger an update to the daily totals
        const updatedLog = await updateDailyLog(req.user.id, date);

        res.status(201).json({ success: true, entry, dailyLog: updatedLog });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error adding manual entry." });
    }
};

// 2. Analyze Food Image (AI Workflow - PRO ONLY)
exports.analyzeFoodImage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { imageUrl } = req.body;

        // CHECK PRO STATUS
        const sub = await UserSubscription.findOne({ userId });
        if (!sub || sub.status === 'FREE') {
            return res.status(403).json({ 
                success: false, 
                requiresPro: true,
                message: "Subscribe to HealthX PRO to access AI Food Analysis." 
            });
        }

        // FAKE AI FUNCTION (To be replaced with Gemini Vision API later)
        const mockAiAnalysis = {
            foodDetected: "Grilled Chicken Salad with Avocado",
            foodScore: 92, // Highly nutritious
            aiInsights: "Excellent source of lean protein and healthy fats. Low in simple carbs.",
            estimatedMacrosPer100g: {
                calories: 120,
                protein: 15,
                carbs: 4,
                fat: 6
            }
        };

        res.status(200).json({ success: true, data: mockAiAnalysis });
    } catch (error) {
        res.status(500).json({ success: false, message: "AI Analysis failed." });
    }
};

// 3. Save Analyzed Meal (User confirms AI data and portion size)
exports.saveAnalyzedMeal = async (req, res) => {
    try {
        const { mealCategory, foodName, imageUrl, baseMacros, portionPercentage, foodScore, aiInsights } = req.body;
        const date = getTodayDateString();

        // Calculate actual consumed macros based on the percentage they ate
        const multiplier = portionPercentage / 100;

        const entry = await MealEntry.create({
            userId: req.user.id,
            date,
            entryType: 'AI_SCAN',
            mealCategory,
            foodName,
            imageUrl,
            foodScore,
            aiInsights,
            portionEaten: portionPercentage,
            calories: baseMacros.calories * multiplier,
            protein: baseMacros.protein * multiplier,
            carbs: baseMacros.carbs * multiplier,
            fat: baseMacros.fat * multiplier
        });

        // Update the daily aggregate
        const updatedLog = await updateDailyLog(req.user.id, date);

        res.status(201).json({ success: true, entry, dailyLog: updatedLog });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to save AI meal." });
    }
};

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