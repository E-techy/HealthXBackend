const Reminder = require('../models/Reminder');
const mongoose = require('mongoose');

// ==========================================
// STANDARD CREATE
// ==========================================
exports.createReminders = async (req, res) => {
    const userId = req.user.id;
    const logPrefix = `[ReminderController - Create | User: ${userId}]`;
    console.log(`\n${logPrefix} ================= NEW REQUEST =================`);

    try {
        const { reminders } = req.body;
        
        if (!reminders || !Array.isArray(reminders) || reminders.length === 0) {
            console.warn(`${logPrefix} Warning: No reminders provided in the request body.`);
            return res.status(400).json({ success: false, message: "No reminders provided." });
        }

        console.log(`${logPrefix} Attempting to create ${reminders.length} reminder(s).`);

        const remindersWithUser = reminders.map(r => ({ ...r, userId }));

        // Mongoose automatically checks the 'category' string here 
        // and applies the specific Discriminator schema!
        const insertedDocs = await Reminder.insertMany(remindersWithUser);

        console.log(`${logPrefix} Success: ${insertedDocs.length} reminder(s) saved to DB.`);
        console.log(`${logPrefix} ================= REQUEST COMPLETE =================\n`);

        return res.status(201).json({
            success: true,
            message: `${insertedDocs.length} reminders created successfully.`,
            insertedIds: insertedDocs.map(doc => doc._id)
        });
    } catch (error) {
        console.error(`${logPrefix} 🔥 CRASH in createReminders:`, error.message);
        return res.status(400).json({ 
            success: false, 
            message: "Failed to create reminders. Please check your data format.",
            error: error.message 
        });
    }
};

// ==========================================
// OFFLINE AUTO-SYNC
// ==========================================
exports.syncReminders = async (req, res) => {
    const userId = req.user.id;
    const logPrefix = `[ReminderController - Sync | User: ${userId}]`;
    console.log(`\n${logPrefix} ================= NEW REQUEST =================`);

    try {
        const { lastClientSyncTime, clientPendingUploads } = req.body;
        
        console.log(`${logPrefix} Sync initiated. Last Client Sync: ${lastClientSyncTime || 'Never'}`);
        console.log(`${logPrefix} Pending client uploads: ${clientPendingUploads ? clientPendingUploads.length : 0}`);

        // 1. Process Client Uploads (Upsert)
        if (clientPendingUploads && Array.isArray(clientPendingUploads) && clientPendingUploads.length > 0) {
            console.log(`${logPrefix} Building bulk operations for ${clientPendingUploads.length} items...`);
            
            const bulkOps = clientPendingUploads.map(reminder => {
                const updateData = { ...reminder, userId };
                
                // Ensure safe ObjectId generation
                let queryId;
                try {
                    queryId = reminder._id ? new mongoose.Types.ObjectId(reminder._id) : new mongoose.Types.ObjectId();
                } catch (idErr) {
                    queryId = new mongoose.Types.ObjectId(); // Fallback if client sent a bad ID format
                }
                
                delete updateData._id; 

                return {
                    updateOne: {
                        filter: { _id: queryId, userId: userId },
                        update: { $set: updateData },
                        upsert: true
                    }
                };
            });
            
            const bulkResult = await Reminder.bulkWrite(bulkOps, { strict: 'throw' });
            console.log(`${logPrefix} Bulk write complete. Modified: ${bulkResult.modifiedCount}, Upserted: ${bulkResult.upsertedCount}`);
        }

        // 2. Fetch Server Updates for Client
        const syncTimeDate = new Date(lastClientSyncTime || 0); 
        console.log(`${logPrefix} Fetching server records updated after: ${syncTimeDate.toISOString()}`);
        
        const serverNewerReminders = await Reminder.find({
            userId: userId,
            updatedAt: { $gt: syncTimeDate }
        });

        console.log(`${logPrefix} Success: Sending ${serverNewerReminders.length} updated record(s) back to client.`);
        console.log(`${logPrefix} ================= REQUEST COMPLETE =================\n`);

        return res.status(200).json({
            success: true,
            serverCurrentTime: Date.now(),
            updatedReminders: serverNewerReminders
        });

    } catch (error) {
        console.error(`${logPrefix} 🔥 CRASH in syncReminders:`, error.message);
        return res.status(400).json({ 
            success: false, 
            message: "Sync failed.", 
            error: error.message 
        });
    }
};

// ==========================================
// ADVANCED GET ROUTE
// ==========================================
exports.getRemindersAdvanced = async (req, res) => {
    const userId = req.user.id;
    const logPrefix = `[ReminderController - Get Adv | User: ${userId}]`;
    console.log(`\n${logPrefix} ================= NEW REQUEST =================`);

    try {
        const { afterDate, ids } = req.query; 
        let query = { userId: userId };

        console.log(`${logPrefix} Query Params -> afterDate: ${afterDate || 'None'}, ids: ${ids ? 'Provided' : 'None'}`);

        if (afterDate) {
            query.updatedAt = { $gt: Number(afterDate) };
        }
        
        if (ids) {
            const idArray = ids.split(',').map(id => id.trim());
            query._id = { $in: idArray };
        }

        console.log(`${logPrefix} Executing DB query...`);
        const reminders = await Reminder.find(query);
        
        console.log(`${logPrefix} Success: Fetched ${reminders.length} reminder(s).`);
        console.log(`${logPrefix} ================= REQUEST COMPLETE =================\n`);

        return res.status(200).json({ 
            success: true, 
            count: reminders.length,
            data: reminders 
        });
    } catch (error) {
        console.error(`${logPrefix} 🔥 CRASH in getRemindersAdvanced:`, error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Server error fetching reminders.",
            error: error.message
        });
    }
};

// ==========================================
// SINGLE UPDATE (Added for Router Compatibility)
// ==========================================
exports.updateReminder = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const logPrefix = `[ReminderController - Single Update | User: ${userId}]`;
    console.log(`\n${logPrefix} ================= NEW REQUEST =================`);

    try {
        console.log(`${logPrefix} Updating reminder ID: ${id}`);
        
        const updateData = { ...req.body };
        delete updateData._id;
        delete updateData.userId;
        delete updateData.category; // Protect discriminator

        const updatedReminder = await Reminder.findOneAndUpdate(
            { _id: id, userId: userId },
            { $set: updateData },
            { new: true, runValidators: true, strict: 'throw' }
        );

        if (!updatedReminder) {
            console.warn(`${logPrefix} Warning: Reminder not found or unauthorized.`);
            return res.status(404).json({ success: false, message: "Reminder not found." });
        }

        console.log(`${logPrefix} Success: Reminder updated.`);
        console.log(`${logPrefix} ================= REQUEST COMPLETE =================\n`);

        return res.status(200).json({ success: true, data: updatedReminder });
    } catch (error) {
        console.error(`${logPrefix} 🔥 CRASH in updateReminder:`, error.message);
        return res.status(400).json({ success: false, message: error.message });
    }
};

// ==========================================
// ADVANCED BULK UPDATE
// ==========================================
exports.bulkUpdateReminders = async (req, res) => {
    const userId = req.user.id;
    const logPrefix = `[ReminderController - Bulk Update | User: ${userId}]`;
    console.log(`\n${logPrefix} ================= NEW REQUEST =================`);

    try {
        const { updates } = req.body; 

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            console.warn(`${logPrefix} Warning: No updates provided.`);
            return res.status(400).json({ success: false, message: "No updates provided." });
        }

        console.log(`${logPrefix} Processing ${updates.length} update operation(s).`);

        const bulkOps = updates.map(item => {
            const updateData = { ...item.changes };
            
            delete updateData._id; 
            delete updateData.userId;
            delete updateData.category; 

            return {
                updateOne: {
                    filter: { _id: item.id, userId: userId },
                    update: { $set: updateData }
                }
            };
        });

        const result = await Reminder.bulkWrite(bulkOps, { strict: 'throw' });

        console.log(`${logPrefix} Success: ${result.modifiedCount} document(s) modified.`);
        console.log(`${logPrefix} ================= REQUEST COMPLETE =================\n`);

        return res.status(200).json({ 
            success: true, 
            message: "Bulk update successful.",
            modifiedCount: result.modifiedCount 
        });
    } catch (error) {
        console.error(`${logPrefix} 🔥 CRASH in bulkUpdateReminders:`, error.message);
        return res.status(400).json({ 
            success: false, 
            message: "Failed to update reminders.",
            error: error.message 
        });
    }
};

// ==========================================
// ADVANCED DELETION
// ==========================================
exports.deleteRemindersAdvanced = async (req, res) => {
    const userId = req.user.id;
    const logPrefix = `[ReminderController - Delete Adv | User: ${userId}]`;
    console.log(`\n${logPrefix} ================= NEW REQUEST =================`);

    try {
        const { reminderIds, createdAfterDate, category, deleteAll } = req.body;
        let query = { userId: userId };

        if (deleteAll === true) {
            console.log(`${logPrefix} Action: Wiping ALL reminders for user.`);
        } else if (reminderIds && Array.isArray(reminderIds) && reminderIds.length > 0) {
            console.log(`${logPrefix} Action: Deleting specific array of ${reminderIds.length} IDs.`);
            query._id = { $in: reminderIds };
        } else if (createdAfterDate) {
            console.log(`${logPrefix} Action: Deleting reminders created after ${createdAfterDate}.`);
            query.createdAt = { $gt: Number(createdAfterDate) };
        } else if (category) {
            console.log(`${logPrefix} Action: Deleting all reminders in category '${category}'.`);
            query.category = category;
        } else {
            console.warn(`${logPrefix} Warning: No valid deletion criteria provided.`);
            return res.status(400).json({ success: false, message: "No valid deletion criteria provided." });
        }

        const result = await Reminder.deleteMany(query);

        console.log(`${logPrefix} Success: ${result.deletedCount} reminder(s) deleted.`);
        console.log(`${logPrefix} ================= REQUEST COMPLETE =================\n`);

        return res.status(200).json({ 
            success: true, 
            message: "Deletion completed.",
            deletedCount: result.deletedCount 
        });
    } catch (error) {
        console.error(`${logPrefix} 🔥 CRASH in deleteRemindersAdvanced:`, error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Server error deleting reminders.",
            error: error.message
        });
    }
};