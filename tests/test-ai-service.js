// tests/test-ai-service.js
require('dotenv').config(); 
const fs = require('fs');
const path = require('path');
const https = require('https');
const aiService = require('../src/services/aiService'); 
const { categorizeNutrients } = require('../src/utils/nutrientMapper'); 

// ==========================================
// 1. HIGH-FIDELITY MOCK DATA
// ==========================================
// A realistic user who has a moderate caloric target
const MOCK_USER_PROFILE = {
    age: 34,
    weight: 82, // kg
    bloodPressure: '128/82' // Slightly elevated, should make the AI cautious of Sodium
};

// They have already eaten lunch, leaving them with ~1400 calories for dinner
const MOCK_TODAY_LOG = {
    totalCalories: 1250,
    targetCalories: 2600,
    totalProtein: 65,
    targetProtein: 160,
    totalCarbs: 140,
    totalFat: 45
};

// 1 KG of food! (1000 grams)
const PORTION_SIZE = 1000; 

// A high-quality image of a massive Biryani/Mixed Meat platter
const TEST_IMAGE_URL = "https://img.magnific.com/free-psd/roasted-chicken-dinner-platter-delicious-feast_632498-25445.jpg?semt=ais_hybrid&w=740&q=80";
const TEMP_IMAGE_PATH = path.join(__dirname, 'temp_feast_test.jpg');
const MIME_TYPE = 'image/jpeg';

// ==========================================
// 2. HELPER: DOWNLOAD IMAGE
// ==========================================
const downloadImage = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
};

// ==========================================
// 3. THE HEAVY-DUTY TEST RUNNER
// ==========================================
const runAiTest = async () => {
    console.log("🚀 Starting Heavy-Duty AI Nutrition Flow Test...\n");

    try {
        // Step 0: Prep the image
        console.log(`⏳ Downloading 1KG test image from URL...`);
        await downloadImage(TEST_IMAGE_URL, TEMP_IMAGE_PATH);
        console.log(`✅ Image saved temporarily to ${TEMP_IMAGE_PATH}\n`);

        // Step 1: Vision Extraction
        console.log("👁️  Executing STEP 1: Vision Extraction (Looking for metadata & base nutrients)...");
        console.time("Step 1 Duration");
        const extractedData = await aiService.extractFoodDataFromImage(TEMP_IMAGE_PATH, MIME_TYPE);
        console.timeEnd("Step 1 Duration");
        
        console.log("\n📦 STEP 1: RAW EXTRACTED DATA (Per 100g/ml):");
        console.log(JSON.stringify(extractedData, null, 2));
        console.log("--------------------------------------------------\n");

        // Step 2: Contextual Analysis
        console.log("🧠 Executing STEP 2: Contextual Analysis & Scaling...");
        console.log(`   Feeding AI: User Weight (${MOCK_USER_PROFILE.weight}kg), Remaining Cals (${MOCK_TODAY_LOG.targetCalories - MOCK_TODAY_LOG.totalCalories}), Portion (${PORTION_SIZE}g)...`);
        console.time("Step 2 Duration");
        const contextualData = await aiService.analyzeFoodContext(
            MOCK_USER_PROFILE, 
            MOCK_TODAY_LOG, 
            extractedData, 
            PORTION_SIZE
        );
        console.timeEnd("Step 2 Duration");

        console.log("\n🎯 STEP 2: PERSONALIZED AI OUTPUT (Scaled to 1KG):");
        console.log(JSON.stringify(contextualData, null, 2));
        console.log("--------------------------------------------------\n");

        // Step 3: Database Mapping Simulation
        console.log("🗄️ Executing STEP 3: Simulating MongoDB Schema Mapping...");
        if (!contextualData.rawNutrients) {
            console.error("⚠️ WARNING: AI did not return 'rawNutrients'. Check your Step 2 prompt keys!");
        } else {
            const mappedBuckets = categorizeNutrients(contextualData.rawNutrients);
            
            console.log("\n✅ FINAL MONGODB PAYLOAD (Ready to save to MealEntry):");
            console.log(JSON.stringify({
                foodName: extractedData.foodName,
                foodSourceCategory: extractedData.foodSourceCategory,
                dietaryFlags: {
                    isVegetarian: extractedData.isVegetarian,
                    isVegan: extractedData.isVegan,
                    isGlutenFree: extractedData.isGlutenFree
                },
                portionEaten: PORTION_SIZE,
                foodScore: contextualData.foodQualityScore,
                eatRecommendationScore: contextualData.eatRecommendationScore,
                aiInsights: contextualData.aiInsights,
                
                // The newly split dynamic buckets!
                nutrients: mappedBuckets.mainNutrients,
                otherNutrients: mappedBuckets.otherNutrients
            }, null, 2));
        }
        
        console.log("\n✅ AI Flow Test Completed Successfully.");

    } catch (error) {
        console.error("\n❌ Test Failed:", error);
    } finally {
        // Step 4: Cleanup
        if (fs.existsSync(TEMP_IMAGE_PATH)) {
            fs.unlinkSync(TEMP_IMAGE_PATH);
            console.log("\n🧹 Cleaned up temporary test image.");
        }
    }
};

// Execute the test
runAiTest();