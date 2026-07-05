const { GoogleGenAI } = require('@google/genai');
const { visionExtractionPrompt, contextualAnalysisPrompt } = require('../config/prompts');
const fs = require('fs');

// Initialize with the default key from ENV, but allow overriding
const getDefaultAiClient = () => {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

// Helper to convert a local file to the format Gemini expects
const fileToGenerativePart = (filePath, mimeType) => {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
            mimeType
        },
    };
};

/**
 * Step 1: Extract base facts from the image
 */
const extractFoodDataFromImage = async (imagePath, mimeType, userApiKey) => {
    const ai = userApiKey ? new GoogleGenAI({ apiKey: userApiKey }) : getDefaultAiClient();
    const model = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';

    const imagePart = fileToGenerativePart(imagePath, mimeType);

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: [visionExtractionPrompt, imagePart],
            config: {
                responseMimeType: "application/json",
            }
        });

        // The response format should be JSON based on our prompt instructions
        const resultText = response.text();
        return JSON.parse(resultText);
    } catch (error) {
        console.error("Error in Vision Extraction:", error);
        throw new Error("Failed to extract nutritional data from image.");
    }
};

/**
 * Step 2: Analyze the food within the user's context
 */
const analyzeFoodContext = async (userData, todayLog, extractedFood, portion, userApiKey) => {
    const ai = userApiKey ? new GoogleGenAI({ apiKey: userApiKey }) : getDefaultAiClient();
    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

    const prompt = contextualAnalysisPrompt(userData, todayLog, extractedFood, portion);

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const resultText = response.text();
        return JSON.parse(resultText);
    } catch (error) {
        console.error("Error in Context Analysis:", error);
        throw new Error("Failed to generate personalized nutritional insights.");
    }
};

module.exports = {
    extractFoodDataFromImage,
    analyzeFoodContext
};