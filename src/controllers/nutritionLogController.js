const DailyNutritionLog = require('../models/DailyNutritionLog');
const Meal = require('../models/Meal');
const NutritionGoal = require('../models/NutritionGoal');
const { calculateUpdatedLog } = require('../services/nutritionUpdater');

const getTodayDateString = () => new Date().toISOString().split('T')[0];

exports.saveMealToLog = async (req, res) => {
    const userId = req.user.id;
    const { mealId, amountEaten, discard } = req.body;
    const todayString = getTodayDateString();

    try {
        // 1. Handle Discard Logic
        if (discard) {
            await Meal.findByIdAndUpdate(mealId, { discarded: true });
            return res.status(200).json({ success: true, message: "Meal discarded successfully." });
        }

        const meal = await Meal.findOne({ _id: mealId, userId });
        if (!meal) return res.status(404).json({ success: false, message: "Meal not found." });

        // 2. Fetch Current Log & Goals
        let dailyLog = await DailyNutritionLog.findOne({ userId, date: todayString });
        if (!dailyLog) {
            dailyLog = new DailyNutritionLog({ userId, date: todayString });
        }
        
        const activeGoals = await NutritionGoal.find({ userId, isActive: true });

        // 3. Let AI Calculate new totals
        const aiResult = await calculateUpdatedLog(dailyLog, { mealItems: meal.foodItems, amountEaten }, activeGoals);
        if (!aiResult.success) {
            return res.status(500).json({ success: false, message: "Failed to calculate nutrition updates." });
        }

        const updatedData = aiResult.data;

        // 4. Update the Daily Log in DB
        dailyLog.totalCalories = updatedData.totalCalories;
        dailyLog.totalProtein = updatedData.totalProtein;
        dailyLog.totalCarbs = updatedData.totalCarbs;
        dailyLog.totalFat = updatedData.totalFat;
        dailyLog.saturatedFat = updatedData.saturatedFat;
        dailyLog.unsaturatedFat = updatedData.unsaturatedFat;
        dailyLog.totalWater = updatedData.totalWater;
        dailyLog.basicNutrients = updatedData.basicNutrients;
        dailyLog.healthScore = updatedData.healthScore;
        
        dailyLog.mealsAttached.push({
            mealId: meal._id,
            amountEaten: amountEaten,
            timeTaken: new Date()
        });

        await dailyLog.save();

        // 5. Update Goal Progress Chart
        for (const goal of activeGoals) {
            let todayProgress = goal.progressChart.find(p => p.date === todayString);
            if (!todayProgress) {
                todayProgress = { date: todayString, nutrientProgress: [] };
                goal.progressChart.push(todayProgress);
            }

            updatedData.goalProgressUpdates.forEach(update => {
                const existingNutrient = todayProgress.nutrientProgress.find(n => n.nutrientName === update.nutrientName);
                if (existingNutrient) {
                    existingNutrient.amountCompleted = update.newAmountCompleted;
                    existingNutrient.isCompleted = update.isCompleted;
                } else {
                    todayProgress.nutrientProgress.push(update);
                }
            });
            await goal.save();
        }

        return res.status(200).json({ success: true, dailyLog, healthScore: dailyLog.healthScore });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

exports.getMeals = async (req, res) => {
    const userId = req.user.id;
    const { mealId, date, show, skip = 0, limit = 5 } = req.query;

    let query = { userId };

    if (mealId) query._id = mealId;
    if (date) {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        query.date = { $gte: startDate, $lte: endDate };
    }

    // Filter handling for discarded items
    if (show === 'all') {
        // Do nothing, fetch both discarded true/false
    } else if (show === 'discarded') {
        query.discarded = true;
    } else {
        query.discarded = false; // Default behavior
    }

    try {
        const meals = await Meal.find(query)
            .sort({ date: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));
            
        return res.status(200).json({ success: true, data: meals });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

exports.createGoal = async (req, res) => {
    try {
        const goal = await NutritionGoal.create({ ...req.body, userId: req.user.id });
        return res.status(201).json({ success: true, data: goal });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

exports.getGoals = async (req, res) => {
    const userId = req.user.id;
    const { show } = req.query; // 'all', 'expired', or default active

    let query = { userId };
    const now = new Date();

    if (show === 'all') {
        // no extra filters
    } else if (show === 'expired') {
        query.goalEndDate = { $lt: now };
    } else {
        query.isActive = true;
        query.goalEndDate = { $gte: now }; // Default to currently running goals
    }

    try {
        const goals = await NutritionGoal.find(query).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: goals });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};