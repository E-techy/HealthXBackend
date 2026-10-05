const express = require('express');
const authRoutes = require('./routes/authRoutes');
const path = require('path'); 
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const nutritionRoutes = require('./routes/nutritionRoutes');
const settingRoutes = require('./routes/settingRoutes');
const accessRoutes = require('./routes/accessRoutes');
const configRoutes = require('./routes/configRoutes');
const mapRoutes = require('./routes/mapRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');



// ADD THIS IMPORT
const docsRoutes = require('./routes/docsRoutes');

const app = express();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// ADD THIS: Make the "public" folder accessible via HTTP
app.use('/public', express.static(path.join(__dirname, '../public')));

app.use('/emergency', express.static(path.join(__dirname, '../emergency_services')));



app.use('/api/auth', authRoutes);

app.use('/device', deviceRoutes);


// ADD THIS
app.use('/api/subscriptions', subscriptionRoutes);

app.use('/api/nutrition',nutritionRoutes );

// Add this near your other routes
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

app.use('/api/settings', settingRoutes);

app.use('/api/access', accessRoutes);

app.use('/api/docs', docsRoutes);

app.use('/api/maps', mapRoutes);

app.use('/api/config', configRoutes);

app.use('/api/emergency', emergencyRoutes);

app.use('/api/vehicles', vehicleRoutes);





app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: "Internal Server Error" });
});

module.exports = app;  