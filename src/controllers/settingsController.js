const UserSettings = require('../models/UserSettings');

// GET: Retrieve user settings
exports.getSettings = async (req, res) => {
    const userId = req.user?.id;
    console.log(`[INFO] GET /settings - Request initiated by user: ${userId}`);

    try {
        console.log(`[INFO] GET /settings - Fetching settings from database for user: ${userId}`);
        let settings = await UserSettings.findOne({ userId });

        // If settings don't exist yet, create a default document for this user
        if (!settings) {
            console.log(`[INFO] GET /settings - No settings found. Creating default document for user: ${userId}`);
            settings = await UserSettings.create({ userId });
            console.log(`[INFO] GET /settings - Default settings created successfully for user: ${userId}`);
        } else {
            console.log(`[INFO] GET /settings - Settings retrieved successfully for user: ${userId}`);
        }

        // Unchanged response payload
        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        // Log the detailed, raw error to the server console only
        console.error(`[ERROR] GET /settings - Failed to retrieve/create settings for user: ${userId}`);
        console.error(`[ERROR DETAILS] ${error.name}: ${error.message}`, error);
        
        // Unchanged client response
        res.status(500).json({ 
            success: false, 
            message: "Failed to retrieve settings." 
        });
    }
};

// PUT: Update user settings
exports.updateSettings = async (req, res) => {
    const userId = req.user?.id;
    console.log(`[INFO] PUT /settings - Request initiated by user: ${userId}`);

    try {
        // Extract userId and _id from req.body to prevent users from maliciously modifying them
        const { userId: bodyUserId, _id, ...updateData } = req.body;
        
        console.log(`[INFO] PUT /settings - Updating settings for user: ${userId}`);
        console.log(`[DEBUG] PUT /settings - Fields being updated: ${Object.keys(updateData).join(', ') || 'None'}`);

        // findOneAndUpdate with upsert: true will create the document if it doesn't exist,
        // and update it if it does. $set ensures we only update the fields provided in the request.
        const updatedSettings = await UserSettings.findOneAndUpdate(
            { userId: userId },
            { $set: updateData },
            { new: true, upsert: true, runValidators: true }
        );

        console.log(`[INFO] PUT /settings - Settings updated successfully for user: ${userId}`);

        // Unchanged response payload
        res.status(200).json({
            success: true,
            message: "Settings updated successfully.",
            data: updatedSettings
        });
    } catch (error) {
        // Check if it's a Mongoose Validation Error to log it more clearly on the backend
        if (error.name === 'ValidationError') {
            console.error(`[WARN] PUT /settings - Mongoose Validation Error for user: ${userId} | Details: ${error.message}`);
        } else {
            console.error(`[ERROR] PUT /settings - Update failed for user: ${userId}`);
            console.error(`[ERROR DETAILS] ${error.name}: ${error.message}`, error);
        }

        // Unchanged client response
        res.status(500).json({ 
            success: false, 
            message: "Failed to update settings." 
        });
    }
};