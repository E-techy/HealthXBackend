const { GoogleGenAI } = require('@google/genai');
const { analyzeMeal } = require('../config/prompts');

// Initialize the SDK. It will automatically pick up process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({});

/**
 * Helper function to safely parse JSON from AI, stripping any rogue markdown.
 */
const extractAndParseJSON = (text) => {
    try {
        // Remove markdown formatting if the AI ignores the prompt instructions
        const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (error) {
        throw new Error('AI response could not be parsed into valid JSON.');
    }
};

/**
 * Analyzes meal images and returns structured nutritional data.
 * * @param {Array} images - Array of image objects { mimeType: 'image/jpeg', data: 'base64string' }
 * @param {String} userInputAmount - The amount the user says they ate (e.g., "1 bowl")
 * @param {Object} dailyNutrition - The user's current daily nutrition stats
 * @param {Object} userProfile - The user's health profile, allergies, and goals
 * @returns {Object} { success: Boolean, data?: Object, message?: String }
 */
const analyzeMealImages = async (images, userInputAmount, dailyNutrition, userProfile) => {
    try {
        // 1. Validate inputs
        if (!images || images.length === 0) {
            return { success: false, message: 'No images provided for analysis.' };
        }

        // 2. Prepare the dynamic prompt by injecting the variables
        const finalPrompt = analyzeMeal
            .replace('{{USER_INPUT_AMOUNT}}', userInputAmount || 'Not specified')
            .replace('{{CURRENT_DAILY_NUTRITION_JSON}}', JSON.stringify(dailyNutrition))
            .replace('{{USER_PROFILE_JSON}}', JSON.stringify(userProfile));

        // 3. Format images for the Gemini API
        // The API requires inlineData objects with mimeType and base64 data
        const imageParts = images.map(img => ({
            inlineData: {
                mimeType: img.mimeType,
                data: img.data
            }
        }));

        // 4. Combine prompt and images into the content array
        const contents = [finalPrompt, ...imageParts];

        // 5. Call the Gemini API (using gemini-2.5-flash as it is fast and supports multimodal)
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                // Enforce JSON output at the API level (highly recommended)
                responseMimeType: "application/json",
                // Set a reasonable temperature for analytical tasks (lower = more deterministic)
                temperature: 0.2, 
            }
        });

        const responseText = response.text;

        if (!responseText) {
            throw new Error('AI returned an empty response.');
        }

        // 6. Parse and validate the JSON
        const parsedData = extractAndParseJSON(responseText);

        // 7. Return the successful payload
        return {
            success: true,
            data: parsedData
        };

    } catch (error) {
        // Log the error for debugging purposes
        console.error('[Meal Analyzer Error]:', error.message);
        
        // Return a clean error message to the client
        return {
            success: false,
            message: error.message || 'An unexpected error occurred during AI analysis.'
        };
    }
};

module.exports = {
    analyzeMealImages
};