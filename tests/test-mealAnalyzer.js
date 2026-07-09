require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { analyzeMealImages } = require('../src/services/mealAnalyzer');

// Mock Data Setup
const mockUserProfile = {
    age: 21,
    weight: 75,
    height: 178,
    allergies: ["Peanuts", "Shellfish"],
    illnesses: ["Mild lactose intolerance"],
    nutritionGoals: [
        { goalType: "MUSCLE_GAIN", targets: [{ nutrientName: "Protein", targetAmount: 160 }] }
    ]
};

const mockDailyNutrition = {
    totalCalories: 1200,
    totalProtein: 60,
    totalCarbs: 150,
    totalFat: 40,
    targetCalories: 2600,
    targetProtein: 160
};

// Updated to reflect a potential multi-item test
const mockUserInputAmount = "I had the whole plate and one can of soda.";

/**
 * Helper to determine mimeType based on file extension
 */
const getMimeType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    return 'image/jpeg'; // fallback for .jpg, .jpeg
};

/**
 * Main Test Execution Function
 */
const runTest = async () => {
    console.log('==============================================');
    console.log('[Test Script] Starting Meal Analyzer Integration Test');
    console.log('==============================================\n');

    try {
        console.log('[Test Script - Step 1] Checking API Key...');
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not defined in the environment variables!');
        }
        console.log('  -> API Key found.');

        console.log('\n[Test Script - Step 2] Loading images from public/tests directory...');
        const testDir = path.join(__dirname, '../public/tests');
        
        if (!fs.existsSync(testDir)) {
            throw new Error(`Test directory not found at path: ${testDir}. Please create it and add test images.`);
        }

        const files = fs.readdirSync(testDir);
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file));

        if (imageFiles.length === 0) {
            throw new Error(`No image files found in ${testDir}. Add some test images!`);
        }

        console.log(`  -> Found ${imageFiles.length} image(s):`, imageFiles);

        console.log('\n[Test Script - Step 3] Converting images to Base64 buffers...');
        const imagesPayload = imageFiles.map(file => {
            const filePath = path.join(testDir, file);
            const fileBuffer = fs.readFileSync(filePath);
            return {
                mimeType: getMimeType(filePath),
                data: fileBuffer.toString('base64')
            };
        });
        console.log('  -> Images successfully converted.');

        console.log('\n[Test Script - Step 4] Executing analyzeMealImages service...\n');
        
        const result = await analyzeMealImages(
            imagesPayload,
            mockUserInputAmount,
            mockDailyNutrition,
            mockUserProfile,
            apiKey
        );

        console.log('\n==============================================');
        console.log('[Test Script - Execution Finished]');
        console.log('==============================================\n');

        if (result.success) {
            // CRITICAL UPDATE: Check if the AI correctly formatted the new foodItems array
            const itemCount = result.data.foodItems ? result.data.foodItems.length : 0;
            
            console.log(`✅ [SUCCESS] AI returned valid parsed JSON.`);
            console.log(`🥘 Detected ${itemCount} distinct food item(s).\n`);
            
            console.log(JSON.stringify(result.data, null, 2));
        } else {
            console.log('❌ [FAILED] Service returned an error:\n');
            console.log(result.message);
        }

    } catch (error) {
        console.error('\n❌ [Test Script Error]:', error.message);
    }
};

runTest();