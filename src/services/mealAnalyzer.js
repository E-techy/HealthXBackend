const { GoogleGenAI } = require('@google/genai');
const { analyzeMeal } = require('../config/prompts');

/**
 * Helper function to safely parse JSON from AI, stripping any rogue markdown.
 */
const extractAndParseJSON = (text) => {
    try {
        console.log('[MealAnalyzer - Utility] Stripping markdown and parsing JSON...');
        const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (error) {
        // CRITICAL UPDATE: Log the raw text so you can debug prompt drift
        console.error('\n[MealAnalyzer - RAW AI OUTPUT THAT FAILED PARSING]:\n', text, '\n');
        throw new Error('AI response could not be parsed into valid JSON.');
    }
};

const analyzeMealImages = async (images, userInputAmount, dailyNutrition, userProfile, apiKey) => {
    try {
        console.log('[MealAnalyzer - Step 1] Validating inputs and API key...');
        if (!apiKey) {
            return { success: false, message: 'Missing Gemini API Key.' };
        }
        if (!images || images.length === 0) {
            return { success: false, message: 'No images provided for analysis.' };
        }

        console.log('[MealAnalyzer - Step 2] Initializing GoogleGenAI client...');
        const ai = new GoogleGenAI({ apiKey: apiKey });

        console.log('[MealAnalyzer - Step 3] Injecting user data into the system prompt...');
        const finalPrompt = analyzeMeal
            .replace('{{USER_INPUT_AMOUNT}}', userInputAmount || 'Not specified')
            .replace('{{CURRENT_DAILY_NUTRITION_JSON}}', JSON.stringify(dailyNutrition))
            .replace('{{USER_PROFILE_JSON}}', JSON.stringify(userProfile));

        console.log(`[MealAnalyzer - Step 4] Formatting ${images.length} image(s) for the Gemini API...`);
        const imageParts = images.map(img => ({
            inlineData: {
                mimeType: img.mimeType,
                data: img.data
            }
        }));

        // CRITICAL UPDATE: Explicitly cast the prompt as a text object for the new SDK
        const contents = [{ text: finalPrompt }, ...imageParts];

        console.log('[MealAnalyzer - Step 5] Sending payload to gemini-2.5-flash (Awaiting response)...');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                responseMimeType: "application/json",
                temperature: 0.2, 
            }
        });

        console.log('[MealAnalyzer - Step 6] Response received. Extracting text payload...');
        const responseText = response.text;

        if (!responseText) {
            throw new Error('AI returned an empty response.');
        }

        console.log('[MealAnalyzer - Step 7] Parsing response text to structured JSON object...');
        const parsedData = extractAndParseJSON(responseText);

        console.log('[MealAnalyzer - Step 8] Analysis complete. Returning successful payload.');
        return {
            success: true,
            data: parsedData
        };

    } catch (error) {
        console.error('[MealAnalyzer - ERROR]:', error.message);
        return {
            success: false,
            message: error.message || 'An unexpected error occurred during AI analysis.'
        };
    }
};

module.exports = {
    analyzeMealImages
};