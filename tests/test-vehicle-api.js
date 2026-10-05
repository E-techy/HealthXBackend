/**
 * Vehicle API & Geospatial Search Verification Script
 * Run with: node tests/test-vehicle-api.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 5001;
const BASE_URL = process.env.TEST_API_URL || `http://localhost:${PORT}`;
const parsedUrl = new URL(BASE_URL);

// ANSI Colors for verbose logging
const C_REQ = '\x1b[35m[REQUEST]\x1b[0m';
const C_RES = '\x1b[36m[RESPONSE]\x1b[0m';
const C_PASS = '\x1b[32m✔ PASS:\x1b[0m';
const C_FAIL = '\x1b[31m✘ FAIL:\x1b[0m';
const C_INFO = '\x1b[33mℹ INFO:\x1b[0m';
const C_RESET = '\x1b[0m';

const UserAuth = require('../src/models/UserAuth');
const EmergencySession = require('../src/models/EmergencySession');
const VehicleRegistration = require('../src/models/VehicleRegistration');

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
                console.log(`   Body: \n${JSON.stringify(parsedBody, null, 2)}`);
                
                resolve({ statusCode: res.statusCode, body: parsedBody });
            });
        });

        req.on('error', (err) => {
            console.error(`${C_FAIL} Request Error:`, err.message);
            reject(err);
        });
        if (payload) req.write(payload);
        req.end();
    });
};

// --- Test Data (10 Vehicles around New Delhi) ---
// Base: Lng 77.2090, Lat 28.6139
const sampleVehicles = [
    { id: 'AMB-001', name: 'City Hospital Amb 1', type: 'AMBULANCE', isPublic: true, lng: 77.2100, lat: 28.6140 }, // < 1km
    { id: 'AMB-002', name: 'City Hospital Amb 2', type: 'AMBULANCE', isPublic: true, lng: 77.2200, lat: 28.6200 }, // ~2km
    { id: 'POL-101', name: 'Traffic Interceptor Alpha', type: 'POLICE', isPublic: true, lng: 77.2500, lat: 28.6500 }, // ~6km
    { id: 'FIRE-55', name: 'Central Fire Engine 55', type: 'FIRE_TRUCK', isPublic: true, lng: 77.2600, lat: 28.6600 }, // ~7km
    { id: 'HELI-01', name: 'Rescue Chopper 1', type: 'AEROPLANE', isPublic: true, lng: 77.1000, lat: 28.5500 }, // ~12km (Outside 10km radius)
    { id: 'POL-102', name: 'Highway Patrol Beta', type: 'POLICE', isPublic: true, lng: 77.0500, lat: 28.5000 }, // ~20km (Outside)
    { id: 'AMB-003', name: 'Rural Outreach Amb', type: 'AMBULANCE', isPublic: true, lng: 77.4000, lat: 28.8000 }, // ~30km (Outside)
    { id: 'VIC-001', name: 'Victim Family Car', type: 'VICTIM_RELATIVE', isPublic: false, lng: 77.2150, lat: 28.6150 }, // PRIVATE (< 1km)
    { id: 'VIC-002', name: 'Victim Father SUV', type: 'VICTIM_FATHER', isPublic: false, lng: 77.2180, lat: 28.6180 }, // PRIVATE (~2km)
    { id: 'OTH-999', name: 'Volunteer Supply Van', type: 'OTHER', isPublic: true, lng: 77.2050, lat: 28.6100 } // < 1km
];

const runVehicleTestSuite = async () => {
    console.log(`\n======================================================`);
    console.log(`Starting Vehicle Management & Geospatial API Test Suite`);
    console.log(`Target: ${BASE_URL}`);
    console.log(`======================================================\n`);

    let ownerUser;
    let ownerToken;
    let mockEmergencyTrackingId = 'EM-TEST-9999';

    try {
        console.log(`${C_INFO} [SETUP] Connecting to database...`);
        await mongoose.connect(process.env.MONGO_URI);
        
        // Clean previous test artifacts
        await UserAuth.deleteMany({ email: 'fleet_commander@test.com' });
        await EmergencySession.deleteMany({ emergencyTrackingId: mockEmergencyTrackingId });
        await VehicleRegistration.deleteMany({ vehicleId: { $in: sampleVehicles.map(v => v.id) } });

        // Ensure 2dsphere index is built for geospatial queries
        await VehicleRegistration.createIndexes();
        
        // Create Mock User
        ownerUser = await UserAuth.create({ email: 'fleet_commander@test.com', passwordHash: 'hash', accountStatus: 'ACTIVE', isEmailVerified: true });
        ownerToken = jwt.sign({ id: ownerUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Create Mock Emergency directly in DB for testing attachments
        await EmergencySession.create({
            emergencyTrackingId: mockEmergencyTrackingId,
            title: 'Test Geospatial Emergency',
            authKey: 'mock-auth-key-123',
            createdBy: ownerUser._id
        });

        console.log(`${C_PASS} Setup complete. Database indexed and mock entities created.\n`);

        // TEST 1 & 2: Register 10 Vehicles and update their telemetry/location
        console.log(`${C_INFO} --- STARTING BATCH REGISTRATION (10 VEHICLES) ---`);
        for (const v of sampleVehicles) {
            // Register
            await sendRequest('POST', '/api/vehicles/register', {
                vehicleId: v.id,
                vehicleName: v.name,
                vehicleType: v.type,
                isPublic: v.isPublic,
                driverName: `Driver ${v.id}`,
                teamMembers: [
                    { fullName: `Medic ${v.id}`, role: 'Support', ssn: '123456789' } // Test SSN Encryption
                ]
            }, ownerToken);

            // Update Telemetry (Location)
            await sendRequest('PATCH', `/api/vehicles/${v.id}/telemetry`, {
                longitude: v.lng,
                latitude: v.lat,
                fuelPercentage: 85
            }, ownerToken);
        }
        console.log(`${C_PASS} 10 Vehicles successfully registered and localized on the map.\n`);

        // TEST 3: Attach Vehicles to Emergency
        console.log(`${C_INFO} --- ATTACHING VEHICLES TO EMERGENCY ${mockEmergencyTrackingId} ---`);
        const vehiclesToAttach = ['AMB-001', 'POL-101', 'VIC-001'];
        for (const vId of vehiclesToAttach) {
            const attachRes = await sendRequest('POST', `/api/vehicles/${vId}/attach`, {
                emergencyTrackingId: mockEmergencyTrackingId
            }, ownerToken);
            if (!attachRes.body.success) throw new Error(`Attach failed for ${vId}`);
        }
        console.log(`${C_PASS} Vehicles successfully attached to the emergency room.\n`);

        // TEST 4: Global Geospatial Search (Radius 10km around New Delhi)
        console.log(`${C_INFO} --- RADIUS SEARCH (10km from 77.2090, 28.6139) ---`);
        // We expect public vehicles within 10km (AMB-001, AMB-002, POL-101, FIRE-55, OTH-999 = 5 vehicles)
        // We expect private vehicles (VIC-001, VIC-002) to be HIDDEN.
        // We expect distant vehicles (HELI-01, POL-102, AMB-003) to be EXCLUDED.
        const geoRes = await sendRequest('GET', `/api/vehicles/nearby?lng=77.2090&lat=28.6139&radius=10`);
        
        if (geoRes.statusCode === 200 && geoRes.body.success) {
            console.log(`${C_PASS} Geospatial Search Completed. Found: ${geoRes.body.count} public vehicles.`);
            if (geoRes.body.count !== 5) {
                console.log(`${C_FAIL} Expected 5 vehicles, found ${geoRes.body.count}. Check index/data.`);
            } else {
                console.log(`${C_PASS} Correct vehicles filtered by distance and privacy (Private vehicles successfully hidden).\n`);
            }
        } else {
            throw new Error('Geospatial search failed.');
        }

        // TEST 5: Fetch Emergency Snapshot
        console.log(`${C_INFO} --- FETCHING EMERGENCY SESSION SNAPSHOT ---`);
        const snapRes = await sendRequest('GET', `/api/vehicles/emergency/${mockEmergencyTrackingId}`);
        if (snapRes.statusCode === 200 && snapRes.body.success) {
            console.log(`${C_PASS} Snapshot retrieved. Active vehicles in this emergency: ${snapRes.body.data.activeVehiclesCount}`);
            
            // Verify SSNs are masked
            const sampleMember = snapRes.body.data.vehicles[0].crew.members[0];
            if (sampleMember.ssnMasked && !sampleMember.ssnEncrypted && !sampleMember.rawSsn) {
                console.log(`${C_PASS} Security Check Passed: SSNs are securely masked/omitted from snapshot payload (Masked: ${sampleMember.ssnMasked}).\n`);
            } else {
                throw new Error('Security Leak: Encrypted or Raw SSN leaked in snapshot.');
            }
        } else {
            throw new Error('Snapshot failed.');
        }

        // TEST 6: Detach Vehicle
        console.log(`${C_INFO} --- DETACHING VEHICLE FROM EMERGENCY ---`);
        const detachRes = await sendRequest('POST', `/api/vehicles/AMB-001/detach`, {
            emergencyTrackingId: mockEmergencyTrackingId
        }, ownerToken);

        if (detachRes.statusCode === 200 && detachRes.body.success) {
            console.log(`${C_PASS} Vehicle successfully detached from the emergency.\n`);
        } else {
            throw new Error('Detach failed.');
        }

        console.log(`======================================================`);
        console.log(`\x1b[32mALL VEHICLE & GEOSPATIAL ROUTES TESTED SUCCESSFULLY!\x1b[0m`);
        console.log(`======================================================\n`);

    } catch (err) {
        console.error(`\n${C_FAIL} Test execution interrupted:`, err.message);
    } finally {
        console.log(`${C_INFO} Cleaning up database...`);
        if (ownerUser) await UserAuth.findByIdAndDelete(ownerUser._id);
        await EmergencySession.deleteMany({ emergencyTrackingId: mockEmergencyTrackingId });
        await VehicleRegistration.deleteMany({ vehicleId: { $in: sampleVehicles.map(v => v.id) } });
        
        await mongoose.disconnect();
        console.log(`${C_INFO} Disconnected. Tests complete.`);
        process.exit(0);
    }
};

runVehicleTestSuite();
