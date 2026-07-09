const UserSettings = require('../models/UserSettings');

// GET: Retrieve user settings
exports.getSettings = async (req, res) => {
    try {
        let settings = await UserSettings.findOne({ userId: req.user.id });

        // If settings don't exist yet, create a default document for this user
        if (!settings) {
            settings = await UserSettings.create({ userId: req.user.id });
        }

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error("🔥 GET SETTINGS ERROR:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to retrieve settings." 
        });
    }
};

// PUT: Update user settings
exports.updateSettings = async (req, res) => {
    try {
        // Extract userId and _id from req.body to prevent users from maliciously modifying them
        const { userId, _id, ...updateData } = req.body;

        // findOneAndUpdate with upsert: true will create the document if it doesn't exist,
        // and update it if it does. $set ensures we only update the fields provided in the request.
        const updatedSettings = await UserSettings.findOneAndUpdate(
            { userId: req.user.id },
            { $set: updateData },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Settings updated successfully.",
            data: updatedSettings
        });
    } catch (error) {
        console.error("🔥 UPDATE SETTINGS ERROR:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to update settings." 
        });
    }
};