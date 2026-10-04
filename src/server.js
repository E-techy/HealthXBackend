require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const redis = require('./config/redis');
const initTimeSeriesCollection = require('./config/initTimeSeries');

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
    await initTimeSeriesCollection();
    app.listen(PORT, () => {
        console.log(`Health X Backend running on port ${PORT}`);
    });
});
