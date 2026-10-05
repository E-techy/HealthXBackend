require('dotenv').config();
const http = require('http'); 
const app = require('./app');
const connectDB = require('./config/db');
const redis = require('./config/redis');
const initTimeSeriesCollection = require('./config/initTimeSeries');
const { initializeSocket } = require('./socket/socketSetup'); 

const PORT = process.env.PORT || 5001;

// Wrap the Express app in a native HTTP server
const server = http.createServer(app);

// Attach Socket.io to the HTTP server
initializeSocket(server);

connectDB().then(async () => {
    await initTimeSeriesCollection();
    
    // Listen on the SERVER, not the app
    server.listen(PORT, () => {
        console.log(`Health X Backend running on port ${PORT}`);
        console.log(`WebSocket Engine is live and listening.`);
    });
});
