const Reminder = require('../models/Reminder');
const mongoose = require('mongoose');

// STANDARD CREATE
exports.createReminders = async (req, res) => {
    try {
        const { reminders } = req.body;
        const userId = req.user.id;

        const remindersWithUser = reminders.map(r => ({ ...r, userId }));

        // Mongoose automatically checks the 'category' string here 
        // and applies the specific Discriminator schema!
        const insertedDocs = await Reminder.insertMany(remindersWithUser);

        res.status(201).json({
            success: true,
            message: `${insertedDocs.length} reminders created successfully.`,
            insertedIds: insertedDocs.map(doc => doc._id)
        });
    } catch (error) {
        // If a client sends dosageAmount to a HYDRATION reminder, 
        // it will get caught here as a StrictModeError/ValidationError.
        console.error("🔥 CREATE REMINDERS CRASH:", error.message);
        res.status(400).json({ success: false, message: error.message });
    }
};

// OFFLINE AUTO-SYNC
exports.syncReminders = async (req, res) => {
    try {
        const { lastClientSyncTime, clientPendingUploads } = req.body;
        const userId = req.user.id;

        if (clientPendingUploads && clientPendingUploads.length > 0) {
            const bulkOps = clientPendingUploads.map(reminder => {
                const updateData = { ...reminder, userId };
                const queryId = reminder._id ? new mongoose.Types.ObjectId(reminder._id) : new mongoose.Types.ObjectId();
                delete updateData._id; 

                // Mongoose bulkWrite perfectly supports discriminators. 
                // As long as updateData contains the 'category' field, it validates correctly.
                return {
                    updateOne: {
                        filter: { _id: queryId, userId: userId },
                        update: { $set: updateData },
                        upsert: true
                    }
                };
            });
            
            await Reminder.bulkWrite(bulkOps, { strict: 'throw' });
        }

        const syncTimeDate = new Date(lastClientSyncTime || 0); 
        const serverNewerReminders = await Reminder.find({
            userId: userId,
            updatedAt: { $gt: syncTimeDate }
        });

        res.status(200).json({
            success: true,
            serverCurrentTime: Date.now(),
            updatedReminders: serverNewerReminders
        });

    } catch (error) {
        console.error("🔥 SYNC CRASH:", error.message);
        res.status(400).json({ success: false, message: error.message });
    }
};