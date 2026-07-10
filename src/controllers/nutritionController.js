const UserSubscription = require('../models/UserSubscription');
const DailyNutritionLog = require('../models/DailyNutritionLog');
const Meal = require('../models/Meal');
const { analyzeMealImages } = require('../services/mealAnalyzer');
const fs = require('fs');

// Utility to get today's date in YYYY-MM-DD format to match DailyNutritionLog schema
const getTodayDateString = () => new Date().toISOString().split('T')[0];

exports.analyzeFoodImages = async (req, res) => {
    const userId = req.user.id;
    const logPrefix = `[NutritionController - AI Analyze | User: ${userId}]`;
    
    console.log(`\n${logPrefix} ================= NEW REQUEST =================`);
    console.log(`${logPrefix} Request received at ${new Date().toISOString()}`);

    try {
        // 1. Extract body parameters (including userProfile sent from the client)
        const { apiKey, modelName, userInputAmount, userProfile } = req.body;
        
        console.log(`${logPrefix} Extracted Body Params:`, {
            hasApiKey: !!apiKey,
            modelName: modelName || 'NOT_PROVIDED',
            userInputAmount: userInputAmount || 'NOT_PROVIDED',
            hasUserProfile: !!userProfile
        });

        // Parse userProfile since multipart/form-data sends objects as stringified JSON
        let parsedUserProfile = {};
        if (userProfile) {
            try {
                parsedUserProfile = typeof userProfile === 'string' ? JSON.parse(userProfile) : userProfile;
                console.log(`${logPrefix} Successfully parsed userProfile from request body.`);
            } catch (err) {
                console.warn(`${logPrefix} Warning: Failed to parse userProfile JSON. Defaulting to empty object.`);
            }
        }

        // 2. Validate Images
        if (!req.files || req.files.length === 0) {
            console.warn(`${logPrefix} Failure: No images provided in request.`);
            return res.status(400).json({ success: false, message: "At least one image is required." });
        }
        console.log(`${logPrefix} Received ${req.files.length} image(s).`);

        // 3. Subscription & API Key Logic
        let finalApiKey = apiKey;
        let finalModelName = modelName;

        if (!finalApiKey || !finalModelName) {
            console.log(`${logPrefix} Missing client API Key or Model. Checking PRO subscription...`);
            const sub = await UserSubscription.findOne({ userId });
            
            if (!sub || sub.status !== 'PRO') {
                console.warn(`${logPrefix} Access Denied: User is not PRO and did not provide custom API keys.`);
                // Clean up uploaded files before aborting
                req.files.forEach(file => fs.unlinkSync(file.path));
                return res.status(403).json({ 
                    success: false, 
                    requiresPro: true,
                    message: "Subscribe to PRO or provide your own Gemini API key and model name to use this feature." 
                });
            }
            
            console.log(`${logPrefix} User is PRO. Using internal environment keys.`);
            finalApiKey = process.env.GEMINI_API_KEY;
            finalModelName = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
        } else {
            console.log(`${logPrefix} Client provided custom API Key and Model. Bypassing PRO check.`);
        }

        // 4. Fetch Today's Nutrition Log (From DB as requested)
        console.log(`${logPrefix} Fetching Today's Nutrition Log...`);
        const todayString = getTodayDateString();
        let dailyNutrition = await DailyNutritionLog.findOne({ userId, date: todayString });
        
        if (!dailyNutrition) {
            console.log(`${logPrefix} No daily log found for today. Supplying empty template.`);
            dailyNutrition = {
                totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0
            };
        }

        // 5. Process Images for AI (Convert to Base64)
        console.log(`${logPrefix} Converting ${req.files.length} image(s) to Base64 buffers...`);
        const imagesPayload = req.files.map(file => {
            const fileBuffer = fs.readFileSync(file.path);
            return {
                mimeType: file.mimetype,
                data: fileBuffer.toString('base64')
            };
        });

        // 6. Execute AI Analysis
        console.log(`${logPrefix} Triggering AI Service...`);
        const aiResult = await analyzeMealImages(
            imagesPayload, 
            userInputAmount, 
            dailyNutrition, 
            parsedUserProfile, // Passed directly from the parsed request body
            finalApiKey, 
            finalModelName
        );

        if (!aiResult.success) {
            console.error(`${logPrefix} AI Analysis Failed:`, aiResult.message);
            req.files.forEach(file => fs.unlinkSync(file.path)); // Cleanup
            return res.status(500).json({ success: false, message: aiResult.message });
        }

        console.log(`${logPrefix} AI Analysis Successful. Preparing to save to database...`);

        // 7. Save to Database (Only after AI Success)
        const imageUrls = req.files.map(file => `/public/uploads/nutrition/${file.filename}`);
        const extractedFoodItems = aiResult.data.foodItems || []; 

        const newMeal = await Meal.create({
            userId,
            date: new Date(),
            mealType: 'UNKNOWN',
            isFullyEaten: true,
            foodItems: extractedFoodItems,
            imageUrls: imageUrls
        });

        console.log(`${logPrefix} Meal successfully saved to DB. Meal ID: ${newMeal._id}`);
        console.log(`${logPrefix} ================= REQUEST COMPLETE =================\n`);

        // 8. Return response
        return res.status(200).json({
            success: true,
            mealId: newMeal._id,
            imageUrls: imageUrls,
            data: aiResult.data
        });

    } catch (error) {
        console.error(`${logPrefix} Fatal Server Error:`, error);
        
        // Attempt cleanup if files exist
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });
        }

        return res.status(500).json({ 
            success: false, 
            message: "An unexpected error occurred during meal analysis.",
            error: error.message 
        });
    }
};