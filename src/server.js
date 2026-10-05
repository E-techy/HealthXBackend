require('dotenv').config();
const http = require('http'); // Import native http
const app = require('./app');
const connectDB = require('./config/db');
const redis = require('./config/redis');
const initTimeSeriesCollection = require('./config/initTimeSeries');
const { initializeSocket } = require('./socket/socketSetup'); // Import Socket engine

const PORT = process.env.PORT || 5001;

// 1. Wrap the Express app in a native HTTP server
const server = http.createServer(app);

// 2. Attach Socket.io to the HTTP server
initializeSocket(server);

connectDB().then(async () => {
    await initTimeSeriesCollection();
    
    // 3. Listen on the SERVER, not the app
    server.listen(PORT, () => {
        console.log(`Health X Backend running on port ${PORT}`);
        console.log(`WebSocket Engine is live and listening.`);
    });
});
