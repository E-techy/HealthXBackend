const express = require('express');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Middleware to parse incoming JSON payloads from Android
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: "Internal Server Error" });
});

module.exports = app;