/**
 * Real-Time Tracking & Historical Trail API Verification Script
 * Run with: node tests/test-tracking-api.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const redis = require('../src/config/redis'); // Required for Redis cleanup

const PORT = process.env.PORT || 5001;
const BASE_URL = process.env.TEST_API_URL || `http://localhost:${PORT}`;
const parsedUrl = new URL(BASE_URL);

// ANSI Colors for verbose logging
const C_REQ = '\x1b[35m[REQUEST]\x1b[0m';
const C_RES = '\x1b[36m[RESPONSE]\x1b[0m';
const C_PASS = '\x1b[32m✔ PASS:\x1b[0m';
const C_FAIL = '\x1b[31m✘ FAIL:\x1b[0m';
const C_INFO = '\x1b[33mℹ INFO:\x1b[0m';

const UserAuth = require('../src/models/UserAuth');
const EmergencySession = require('../src/models/EmergencySession');
const VehicleRegistration = require('../src/models/VehicleRegistration');
const VehicleBreadcrumb = require('../src/models/VehicleBreadcrumb');

const sendRequest = (method, reqPath, data = null, token = null) => {
    return new Promise((resolve, reject) => {
        const payload = data ? JSON.stringify(data) : null;
        const headers = { 'Content-Type': 'application/json' };
        
        if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
        if (token) headers['Authorization'] = `Bearer ${token}`;

        console.log(`\n${C_REQ} ${method} ${reqPath}`);
        if (token) console.log(`   Headers: Authorization: Bearer <token_hidden>`);
        if (payload) console.log(`   Payload: \n${JSON.stringify(data, null, 2)}`);

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: reqPath,
            method: method,
            headers: headers
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                let parsedBody = body;
                try { parsedBody = JSON.parse(body); } catch (e) {}
                
                console.log(`${C_RES} Status: ${res.statusCode}`);
                if (res.statusCode >= 400) {
                    console.log(`   Error Body: \n${JSON.stringify(parsedBody, null, 2)}`);
                } else {
                    console.log(`   Success Body (Truncated): \n${JSON.stringify(parsedBody, null, 2).substring(0, 500)}...`);
                }
                
                resolve({ statusCode: res.statusCode, body: parsedBody });
            });
        });

        req.on('error', (err) => reject(err));
        if (payload) req.write(payload);
        req.end();
    });
};

const runTrackingTestSuite = async () => {
    console.log(`\n======================================================`);
    console.log(`Starting High-Speed Tracking & Time-Series Test Suite`);
    console.log(`Target: ${BASE_URL}`);
    console.log(`======================================================\n`);

    let ownerUser;
    let ownerToken;
    const trackingId = 'EM-TRACK-2026';
    
    // 3 Test Vehicles
    const vehicles = [
        { id: 'TRK-AMB-01', name: 'Alpha Ambulance', type: 'AMBULANCE' },
        { id: 'TRK-POL-01', name: 'Bravo Police', type: 'POLICE' },
        { id: 'TRK-FIR-01', name: 'Charlie Fire', type: 'FIRE_TRUCK' }
    ];

    try {
        // --------------------------------------------------------------------
        // SETUP: Database, Mock User, Emergency, and Attached Vehicles
        // --------------------------------------------------------------------
        console.log(`${C_INFO} [SETUP] Initializing database and Mock Data...`);
        await mongoose.connect(process.env.MONGO_URI);
        
        // Clean up from any previous failed runs
        await UserAuth.deleteMany({ email: 'tracker_admin@test.com' });
        await EmergencySession.deleteMany({ emergencyTrackingId: trackingId });
        await VehicleRegistration.deleteMany({ vehicleId: { $in: vehicles.map(v => v.id) } });
        await VehicleBreadcrumb.deleteMany({ 'metadata.emergencyTrackingId': trackingId });

        // 1. Create User & Token
        ownerUser = await UserAuth.create({ email: 'tracker_admin@test.com', passwordHash: 'hash', accountStatus: 'ACTIVE', isEmailVerified: true });
        ownerToken = jwt.sign({ id: ownerUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // 2. Create Emergency Session
        await EmergencySession.create({
            emergencyTrackingId: trackingId,
            title: 'Highway Pursuit & Rescue',
            authKey: 'mock-auth-key-tracking',
            createdBy: ownerUser._id,
            status: 'ACTIVE'
        });

        // 3. Register & Attach 3 Vehicles to the Emergency
        for (const v of vehicles) {
            await VehicleRegistration.create({
                vehicleId: v.id,
                ownerId: ownerUser._id,
                isPublic: true,
                activeEmergencies: [trackingId], // Attach directly for testing
                connectionStatus: 'CONNECTED',
                identity: { vehicleName: v.name, vehicleType: v.type },
                crew: { driverName: 'Test Driver' }
            });
        }
        console.log(`${C_PASS} Setup complete. 3 vehicles attached to emergency ${trackingId}.\n`);

        // --------------------------------------------------------------------
        // TEST 1: LIVE GPS PUSH (FAST-PATH TO REDIS)
        // --------------------------------------------------------------------
        console.log(`${C_INFO} --- TEST 1: Pushing Live GPS updates to Redis ---`);
        for (let i = 0; i < vehicles.length; i++) {
            const v = vehicles[i];
            const liveRes = await sendRequest('POST', '/api/tracking/live', {
                emergencyTrackingId: trackingId,
                vehicleId: v.id,
                locationData: {
                    longitude: 77.2000 + (i * 0.01), // Slightly different positions
                    latitude: 28.6000 + (i * 0.01),
                    speed: 60 + (i * 5),
                    heading: 90,
                    timestamp: Date.now()
                }
            }, ownerToken);

            if (liveRes.statusCode !== 200 || !liveRes.body.success) {
                throw new Error(`Live push failed for ${v.id}`);
            }
        }
        console.log(`${C_PASS} All 3 vehicles successfully updated live locations in Redis.\n`);

        // --------------------------------------------------------------------
        // TEST 2: FETCH BATCH LIVE LOCATIONS (REDIS PIPELINE)
        // --------------------------------------------------------------------
        console.log(`${C_INFO} --- TEST 2: Fetching Batch Live Locations (Specific Vehicles) ---`);
        const batchRes = await sendRequest('POST', '/api/tracking/live/batch', {
            emergencyTrackingId: trackingId,
            vehicleIds: ['TRK-AMB-01', 'TRK-FIR-01'] // Fetching only 2 of the 3
        }, ownerToken);

        if (batchRes.statusCode === 200 && batchRes.body.success && batchRes.body.count === 2) {
            console.log(`${C_PASS} Successfully fetched 2 specific vehicles from Redis instantly.\n`);
        } else {
            throw new Error('Batch fetch failed.');
        }

        // --------------------------------------------------------------------
        // TEST 3: FETCH ALL LIVE LOCATIONS FOR EMERGENCY (REDIS)
        // --------------------------------------------------------------------
        console.log(`${C_INFO} --- TEST 3: Fetching ALL Live Locations for Emergency ---`);
        const allLiveRes = await sendRequest('GET', `/api/tracking/live/emergency/${trackingId}`, null, ownerToken);

        if (allLiveRes.statusCode === 200 && allLiveRes.body.success && allLiveRes.body.count === 3) {
            console.log(`${C_PASS} Successfully fetched all 3 active vehicles attached to this emergency.\n`);
        } else {
            throw new Error('All live locations fetch failed.');
        }

        // --------------------------------------------------------------------
        // TEST 4: BULK SAVE TRAIL DATA (MONGODB TIME-SERIES)
        // --------------------------------------------------------------------
        console.log(`${C_INFO} --- TEST 4: Simulating Bulk Trail Upload (Local Buffer Sync) ---`);
        // Simulate a vehicle uploading 5 seconds of historical data at once
        const mockBreadcrumbs = Array.from({ length: 5 }).map((_, idx) => ({
            longitude: 77.2000 + (idx * 0.001),
            latitude: 28.6000 + (idx * 0.001),
            speed: 65,
            heading: 95,
            timestamp: Date.now() - ((5 - idx) * 1000) // 5 seconds ago up to 1 second ago
        }));

        const bulkRes = await sendRequest('POST', '/api/tracking/trail/bulk', {
            emergencyTrackingId: trackingId,
            vehicleId: 'TRK-AMB-01',
            breadcrumbs: mockBreadcrumbs
        }, ownerToken);

        if (bulkRes.statusCode === 201 && bulkRes.body.success) {
            console.log(`${C_PASS} Successfully saved bulk breadcrumb trail to MongoDB Time-Series.\n`);
        } else {
            throw new Error('Bulk trail upload failed.');
        }

        // --------------------------------------------------------------------
        // TEST 5: FETCH HISTORICAL TRAIL (MONGODB)
        // --------------------------------------------------------------------
        console.log(`${C_INFO} --- TEST 5: Fetching Historical Trail for past 1 Hour ---`);
        const trailRes = await sendRequest('GET', `/api/tracking/trail/${trackingId}/TRK-AMB-01?hours=1`, null, ownerToken);

        if (trailRes.statusCode === 200 && trailRes.body.success && trailRes.body.count === 5) {
            console.log(`${C_PASS} Successfully retrieved exactly 5 historical points for the vehicle.\n`);
        } else {
            throw new Error('Historical trail fetch failed.');
        }

        console.log(`======================================================`);
        console.log(`\x1b[32mALL TRACKING & REDIS ROUTES TESTED SUCCESSFULLY!\x1b[0m`);
        console.log(`======================================================\n`);

    } catch (err) {
        console.error(`\n${C_FAIL} Test execution interrupted:`, err.message);
    } finally {
        console.log(`${C_INFO} Cleaning up database and Redis cache...`);
        if (ownerUser) await UserAuth.findByIdAndDelete(ownerUser._id);
        await EmergencySession.deleteMany({ emergencyTrackingId: trackingId });
        await VehicleRegistration.deleteMany({ vehicleId: { $in: vehicles.map(v => v.id) } });
        await VehicleBreadcrumb.deleteMany({ 'metadata.emergencyTrackingId': trackingId });

        // Cleanup Redis Keys
        for (const v of vehicles) {
            await redis.del(`em:${trackingId}:veh:${v.id}:loc`);
        }
        
        await mongoose.disconnect();
        redis.quit(); // Gracefully close Redis connection
        console.log(`${C_INFO} Disconnected. Tests complete.`);
        process.exit(0);
    }
};

runTrackingTestSuite();
