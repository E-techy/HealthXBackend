const express = require('express');
const authRoutes = require('./routes/authRoutes');
const path = require('path'); 
const subscriptionRoutes = require('./routes/subscriptionRoutes');

const app = express();

app.use(express.json());

// ADD THIS: Make the "public" folder accessible via HTTP
app.use('/public', express.static(path.join(__dirname, '../public')));


app.use('/api/auth', authRoutes);


// ADD THIS
app.use('/api/subscriptions', subscriptionRoutes);

// Add this near your other routes
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: "Internal Server Error" });
});

module.exports = app;  