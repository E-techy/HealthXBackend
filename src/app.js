const express = require('express');
const authRoutes = require('./routes/authRoutes');
const path = require('path'); // ADD THIS

const app = express();

app.use(express.json());

// ADD THIS: Make the "public" folder accessible via HTTP
app.use('/public', express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: "Internal Server Error" });
});

module.exports = app;  