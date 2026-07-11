const { GoogleGenAI } = require('@google/genai');
const { updateNutritionLogPrompt } = require('../config/prompts');

const extractAndParseJSON = (text) => {
    try {
        const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (error) {
        console.error('\n[NutritionUpdater - RAW AI OUTPUT]:\n', text, '\n');
        throw new Error('AI response could not be parsed into valid JSON.');
    }
};

const calculateUpdatedLog = async (currentLog, newFoodData, activeGoals) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const modelName = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
        const ai = new GoogleGenAI({ apiKey: apiKey });

        const finalPrompt = updateNutritionLogPrompt
            .replace('{{CURRENT_NUTRITION}}', JSON.stringify(currentLog))
            .replace('{{NEW_FOOD}}', JSON.stringify(newFoodData))
            .replace('{{USER_GOALS}}', JSON.stringify(activeGoals));

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ text: finalPrompt }],
            config: {
                responseMimeType: "application/json",
                temperature: 0.1, // Low temp for math/logic stability
            }
        });

        if (!response.text) throw new Error('AI returned an empty response.');
        
        return { success: true, data: extractAndParseJSON(response.text) };
    } catch (error) {
        console.error('[NutritionUpdater - ERROR]:', error.message);
        return { success: false, message: error.message };
    }
};

module.exports = { calculateUpdatedLog };