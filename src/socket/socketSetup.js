const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io; // Hold the global instance

// Standardized Event Names
const EVENTS = {
    VEHICLE_CONNECTED: 'vehicle:connected',
    VEHICLE_DISCONNECTED: 'vehicle:disconnected',
    VEHICLE_METADATA_UPDATED: 'vehicle:telemetry_updated',
    VEHICLE_CRITICAL_ALERT: 'alert:critical', // Low fuel, crash, speed anomalies
    CUSTOM_MESSAGE: 'message:custom',         // Standard broadcasts (levels: normal, alert, event, crash)
    PINNED_MESSAGE: 'message:pinned',         // Sticky notifications
    EMERGENCY_STATUS_CHANGED: 'emergency:status_changed',
    GLOBAL_MESSAGE: 'message:global'          // Broadcast to ALL users on the server
};

const initializeSocket = (server) => {
    io = socketIo(server, {
        cors: {
            origin: "*", 
            methods: ["GET", "POST"]
        }
    });

    // Middleware: Authenticate every incoming socket connection
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error('Authentication token required'));

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'healthx_emergency_secret_key');
            
            socket.emergencyTrackingId = decoded.emergencyTrackingId;
            socket.userRole = decoded.role;
            socket.userId = decoded.userId;

            next();
        } catch (error) {
            next(new Error('Invalid or expired token'));
        }
    });

    io.on('connection', (socket) => {
        // Auto-join the secure room for this specific emergency
        if (socket.emergencyTrackingId) {
            const roomName = `room:${socket.emergencyTrackingId.toUpperCase()}`;
            socket.join(roomName);
            console.log(`🔌 Socket Connected: User ${socket.userId || 'Guest'} joined ${roomName}`);
        } else {
            console.log(`🔌 Socket Connected: Global listener attached.`);
        }

        socket.on('disconnect', () => {
            console.log(`🔌 Socket Disconnected: User ${socket.userId || 'Guest'} left.`);
        });
    });
};

// Target a specific emergency room
const broadcastEvent = (emergencyTrackingId, eventName, payload) => {
    if (!io) {
        console.error('Socket.io has not been initialized yet.');
        return;
    }
    const roomName = `room:${emergencyTrackingId.toUpperCase()}`;
    io.to(roomName).emit(eventName, {
        timestamp: Date.now(),
        ...payload
    });
};

// Broadcast to EVERY connected client globally
const broadcastGlobalEvent = (eventName, payload) => {
    if (!io) {
        console.error('Socket.io has not been initialized yet.');
        return;
    }
    io.emit(eventName, {
        timestamp: Date.now(),
        ...payload
    });
};

module.exports = {
    initializeSocket,
    broadcastEvent,
    broadcastGlobalEvent,
    EVENTS
};
