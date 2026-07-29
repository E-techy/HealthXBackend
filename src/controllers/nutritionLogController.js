const DailyNutritionLog = require('../models/DailyNutritionLog');
const Meal = require('../models/Meal');
const NutritionGoal = require('../models/NutritionGoal');
const { calculateUpdatedLog } = require('../services/nutritionUpdater');

const getTodayDateString = () => new Date().toISOString().split('T')[0];

// ==========================================
// SAVE MEAL TO NUTRITION LOG
// ==========================================
exports.saveMealToLog = async (req, res) => {
    const userId = req.user.id;
    const logPrefix = `[NutritionLogController - Save Meal | User: ${userId}]`;
    console.log(`\n${logPrefix} ================= NEW REQUEST =================`);

    try {
        const { mealId, amountEaten, discard } = req.body;
        const todayString = getTodayDateString();

        console.log(`${logPrefix} Payload -> MealId: ${mealId}, AmountEaten: ${amountEaten}%, Discard: ${!!discard}`);

        // 1. Handle Discard Logic
        if (discard) {
            console.log(`${logPrefix} Action: Discarding meal...`);
            await Meal.findByIdAndUpdate(mealId, { discarded: true });
            console.log(`${logPrefix} Success: Meal marked as discarded.`);
            console.log(`${logPrefix} ================= REQUEST COMPLETE =================\n`);
            return res.status(200).json({ success: true, message: "Meal discarded successfully." });
        }

        console.log(`${logPrefix} Fetching Meal from DB...`);
        const meal = await Meal.findOne({ _id: mealId, userId });
        if (!meal) {
            console.warn(`${logPrefix} Warning: Meal not found or unauthorized.`);
            return res.status(404).json({ success: false, message: "Meal not found." });
        }

        // 2. Fetch Current Log & Goals
        console.log(`${logPrefix} Fetching Daily Log for ${todayString}...`);
        let dailyLog = await DailyNutritionLog.findOne({ userId, date: todayString });
        if (!dailyLog) {
            console.log(`${logPrefix} No existing log found for today. Initializing new log.`);
            dailyLog = new DailyNutritionLog({ userId, date: todayString });
        }
        
        console.log(`${logPrefix} Fetching active nutrition goals...`);
        const activeGoals = await NutritionGoal.find({ userId, isActive: true });
        console.log(`${logPrefix} Found ${activeGoals.length} active goal(s).`);

        // 3. Let AI Calculate new totals
        console.log(`${logPrefix} Sending data to AI Nutrition Updater...`);
        const aiResult = await calculateUpdatedLog(dailyLog, { mealItems: meal.foodItems, amountEaten }, activeGoals);
        
        if (!aiResult.success) {
            console.error(`${logPrefix} AI Calculation Failed:`, aiResult.message);
            return res.status(500).json({ success: false, message: "Failed to calculate nutrition updates." });
        }
        console.log(`${logPrefix} AI Calculation Successful.`);

        const updatedData = aiResult.data;

        // 4. Update the Daily Log in DB
        console.log(`${logPrefix} Updating Daily Log document...`);
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
        console.log(`${logPrefix} Success: Daily Log saved.`);

        // 5. Update Goal Progress Chart
        if (activeGoals.length > 0) {
            console.log(`${logPrefix} Updating progress charts for ${activeGoals.length} goal(s)...`);
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
            console.log(`${logPrefix} Success: Goal progress charts updated.`);
        }

        console.log(`${logPrefix} ================= REQUEST COMPLETE =================\n`);
        return res.status(200).json({ success: true, dailyLog, healthScore: dailyLog.healthScore });

    } catch (error) {
        console.error(`${logPrefix} 🔥 CRASH in saveMealToLog:`, error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// GET MEALS (WITH FILTERS)
// ==========================================
exports.getMeals = async (req, res) => {
    const userId = req.user.id;
    const logPrefix = `[NutritionLogController - Get Meals | User: ${userId}]`;
    console.log(`\n${logPrefix} ================= NEW REQUEST =================`);

    try {
        const { mealId, date, show, skip = 0, limit = 5 } = req.query;
        let query = { userId };

        console.log(`${logPrefix} Filters -> Date: ${date || 'All'}, Show: ${show || 'default'}, Skip: ${skip}, Limit: ${limit}`);

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

        console.log(`${logPrefix} Executing DB Query...`);
        const meals = await Meal.find(query)
            .sort({ date: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));
            
        console.log(`${logPrefix} Success: Fetched ${meals.length} meal(s).`);
        console.log(`${logPrefix} ================= REQUEST COMPLETE =================\n`);

        return res.status(200).json({ success: true, data: meals });
    } catch (error) {
        console.error(`${logPrefix} 🔥 CRASH in getMeals:`, error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// CREATE NUTRITION GOAL
// ==========================================
exports.createGoal = async (req, res) => {
    const userId = req.user.id;
    const logPrefix = `[NutritionLogController - Create Goal | User: ${userId}]`;
    console.log(`\n${logPrefix} ================= NEW REQUEST =================`);

    try {
        console.log(`${logPrefix} Validating goal payload...`);
        const goalData = { ...req.body, userId };

        const goal = await NutritionGoal.create(goalData);
        
        console.log(`${logPrefix} Success: Goal created with ID ${goal._id}.`);
        console.log(`${logPrefix} ================= REQUEST COMPLETE =================\n`);

        return res.status(201).json({ success: true, data: goal });
    } catch (error) {
        console.error(`${logPrefix} 🔥 CRASH in createGoal:`, error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// GET NUTRITION GOALS
// ==========================================
exports.getGoals = async (req, res) => {
    const userId = req.user.id;
    const logPrefix = `[NutritionLogController - Get Goals | User: ${userId}]`;
    console.log(`\n${logPrefix} ================= NEW REQUEST =================`);

    try {
        const { show } = req.query; // 'all', 'expired', or default active
        let query = { userId };
        const now = new Date();

        console.log(`${logPrefix} Filter -> Show: ${show || 'active (default)'}`);

        if (show === 'all') {
            // no extra filters
        } else if (show === 'expired') {
            query.goalEndDate = { $lt: now };
        } else {
            query.isActive = true;
            query.goalEndDate = { $gte: now }; // Default to currently running goals
        }

        console.log(`${logPrefix} Executing DB Query...`);
        const goals = await NutritionGoal.find(query).sort({ createdAt: -1 });
        
        console.log(`${logPrefix} Success: Fetched ${goals.length} goal(s).`);
        console.log(`${logPrefix} ================= REQUEST COMPLETE =================\n`);

        return res.status(200).json({ success: true, data: goals });
    } catch (error) {
        console.error(`${logPrefix} 🔥 CRASH in getGoals:`, error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};