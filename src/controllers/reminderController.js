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

// ==========================================
// ADVANCED GET ROUTE
// ==========================================
exports.getRemindersAdvanced = async (req, res) => {
    try {
        const userId = req.user.id;
        // Using query parameters for GET requests (e.g., ?afterDate=1719244800000&ids=id1,id2)
        const { afterDate, ids } = req.query; 
        
        let query = { userId: userId };

        // Filter 1: Get reminders updated after a specific epoch timestamp
        if (afterDate) {
            query.updatedAt = { $gt: Number(afterDate) };
        }
        
        // Filter 2: Get specific reminders by an array of IDs
        if (ids) {
            // Split the comma-separated string from the URL into an array
            const idArray = ids.split(',');
            query._id = { $in: idArray };
        }

        const reminders = await Reminder.find(query);
        
        res.status(200).json({ 
            success: true, 
            count: reminders.length,
            data: reminders 
        });
    } catch (error) {
        console.error("🔥 GET REMINDERS CRASH:", error.message);
        res.status(500).json({ success: false, message: "Server error fetching reminders." });
    }
};

// ==========================================
// ADVANCED BULK UPDATE
// ==========================================
exports.bulkUpdateReminders = async (req, res) => {
    try {
        const userId = req.user.id;
        const { updates } = req.body; // Expects an array of { id: "...", changes: { ... } }

        if (!updates || updates.length === 0) {
            return res.status(400).json({ success: false, message: "No updates provided." });
        }

        const bulkOps = updates.map(item => {
            const updateData = { ...item.changes };
            
            // Security: Never let the client change the Document ID or the User ID
            delete updateData._id; 
            delete updateData.userId;
            delete updateData.category; // Do not allow changing the discriminator type

            return {
                updateOne: {
                    filter: { _id: item.id, userId: userId },
                    update: { $set: updateData }
                }
            };
        });

        // strict: 'throw' ensures that if an update contains invalid fields for that discriminator, it fails safely
        const result = await Reminder.bulkWrite(bulkOps, { strict: 'throw' });

        res.status(200).json({ 
            success: true, 
            message: "Bulk update successful.",
            modifiedCount: result.modifiedCount 
        });
    } catch (error) {
        console.error("🔥 BULK UPDATE CRASH:", error.message);
        res.status(400).json({ success: false, message: error.message });
    }
};

// ==========================================
// ADVANCED DELETION
// ==========================================
exports.deleteRemindersAdvanced = async (req, res) => {
    try {
        const userId = req.user.id;
        const { reminderIds, createdAfterDate, category, deleteAll } = req.body;
        
        let query = { userId: userId };

        // Determine the deletion strategy based on the payload
        if (deleteAll === true) {
            // Leave query as just { userId } to wipe their entire slate
        } else if (reminderIds && reminderIds.length > 0) {
            // Delete specific array of IDs
            query._id = { $in: reminderIds };
        } else if (createdAfterDate) {
            // Delete anything created after a specific date (e.g., rollback bad sync)
            query.createdAt = { $gt: Number(createdAfterDate) };
        } else if (category) {
            // Delete all reminders of a specific type (e.g., user wants to wipe all "SLEEP" logs)
            query.category = category;
        } else {
            return res.status(400).json({ success: false, message: "No valid deletion criteria provided." });
        }

        const result = await Reminder.deleteMany(query);

        res.status(200).json({ 
            success: true, 
            message: "Deletion completed.",
            deletedCount: result.deletedCount 
        });
    } catch (error) {
        console.error("🔥 DELETION CRASH:", error.message);
        res.status(500).json({ success: false, message: "Server error deleting reminders." });
    }
};