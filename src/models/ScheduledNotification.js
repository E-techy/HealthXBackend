const mongoose = require('mongoose');

const scheduledNotificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    
    // Link back to the original reminder so we can delete/update the notification if the reminder changes
    reminderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reminder', index: true }, 
    
    // The category defined in your notificationService.js (e.g., 'REMINDER_ALERT')
    notificationCategory: { type: String, required: true }, 
    
    // Epoch timestamp. The cron job will filter based on this exact field.
    triggerTime: { type: Number, required: true }, 
    
    // Queue tracking
    status: { 
        type: String, 
        enum: ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'], 
        default: 'PENDING' 
    },
    
    // The complete JSON data to be stringified and sent to FCM
    // Schema.Types.Mixed allows you to dump dynamic JSON into this field
    payload: { type: mongoose.Schema.Types.Mixed, required: true }, 
    
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() }
});

// Auto-update the updatedAt epoch timestamp
scheduledNotificationSchema.pre('save', async function() {
    this.updatedAt = Date.now();
});

// ==========================================
// THE PERFORMANCE INDEX (CRITICAL)
// ==========================================
// This index organizes documents by Status first, then Ascending Trigger Time.
// Your 1-minute worker query will look like: 
// db.ScheduledNotifications.find({ status: 'PENDING', triggerTime: { $lte: currentTime } })
// Because of this index, MongoDB handles that query in milliseconds, even with millions of rows.
scheduledNotificationSchema.index({ status: 1, triggerTime: 1 });

module.exports = mongoose.model('ScheduledNotification', scheduledNotificationSchema);