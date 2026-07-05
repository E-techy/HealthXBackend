// tests/test-ai-service.js
require('dotenv').config(); // Ensure your .env with GEMINI_API_KEY is loaded
const fs = require('fs');
const path = require('path');
const https = require('https');
const aiService = require('../src/services/aiService'); // Adjust path if needed

// ==========================================
// 1. MOCK DATA SETUP
// ==========================================
const MOCK_USER_PROFILE = {
    age: 28,
    weight: 75, // kg
    bloodPressure: '120/80'
};

const MOCK_TODAY_LOG = {
    totalCalories: 1800,
    targetCalories: 2500,
    totalProtein: 90,
    targetProtein: 140,
    totalCarbs: 180,
    totalFat: 60
};

// Standard Coca-Cola can is 330ml
const PORTION_SIZE = 330; 

// A reliable public URL for a Coca-Cola can image
const TEST_IMAGE_URL = "https://m.media-amazon.com/images/I/81b+oqymgRL._AC_UF894,1000_QL80_.jpg";
const TEMP_IMAGE_PATH = path.join(__dirname, 'temp_coke_test.jpg');
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
// 3. THE TEST RUNNER
// ==========================================
const runAiTest = async () => {
    console.log("🚀 Starting AI Nutrition Flow Test...\n");

    try {
        // Step 0: Prep the image
        console.log(`⏳ Downloading test image from URL...`);
        await downloadImage(TEST_IMAGE_URL, TEMP_IMAGE_PATH);
        console.log(`✅ Image saved temporarily to ${TEMP_IMAGE_PATH}\n`);

        // Step 1: Vision Extraction
        console.log("👁️  Executing STEP 1: Vision Extraction (Looking at image)...");
        console.time("Step 1 Duration");
        const extractedData = await aiService.extractFoodDataFromImage(TEMP_IMAGE_PATH, MIME_TYPE);
        console.timeEnd("Step 1 Duration");
        
        console.log("\n📦 RAW EXTRACTED DATA (Per 100g/ml):");
        console.log(JSON.stringify(extractedData, null, 2));
        console.log("--------------------------------------------------\n");

        // Step 2: Contextual Analysis
        console.log("🧠 Executing STEP 2: Contextual Analysis...");
        console.log(`   Feeding AI: User Weight (${MOCK_USER_PROFILE.weight}kg), Calories Consumed (${MOCK_TODAY_LOG.totalCalories}/${MOCK_TODAY_LOG.targetCalories}), Portion (${PORTION_SIZE}ml)...`);
        console.time("Step 2 Duration");
        const contextualData = await aiService.analyzeFoodContext(
            MOCK_USER_PROFILE, 
            MOCK_TODAY_LOG, 
            extractedData, 
            PORTION_SIZE
        );
        console.timeEnd("Step 2 Duration");

        console.log("\n🎯 FINAL PERSONALIZED OUTPUT:");
        console.log(JSON.stringify(contextualData, null, 2));
        console.log("--------------------------------------------------\n");

        console.log("✅ AI Flow Test Completed Successfully.");

    } catch (error) {
        console.error("❌ Test Failed:", error);
    } finally {
        // Step 4: Cleanup
        if (fs.existsSync(TEMP_IMAGE_PATH)) {
            fs.unlinkSync(TEMP_IMAGE_PATH);
            console.log("🧹 Cleaned up temporary test image.");
        }
    }
};

// Execute the test
runAiTest();