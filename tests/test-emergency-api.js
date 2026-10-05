/**
 * Emergency API Route Verification Script
 * Run with: node tests/test-emergency-api.js
 */
const path = require('path');
// Explicitly resolve the root .env file regardless of current working directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const http = require('http');

const PORT = process.env.PORT || 5001;
const BASE_URL = process.env.TEST_API_URL || `http://localhost:${PORT}`;
const parsedUrl = new URL(BASE_URL);

// ANSI Output formatting
const COLOR_PASS = '\x1b[32m✔ PASS:\x1b[0m';
const COLOR_FAIL = '\x1b[31m✘ FAIL:\x1b[0m';
const COLOR_INFO = '\x1b[36mℹ INFO:\x1b[0m';

const sendRequest = (method, reqPath, data = null) => {
    return new Promise((resolve, reject) => {
        const payload = data ? JSON.stringify(data) : null;

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: reqPath,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload && { 'Content-Length': Buffer.byteLength(payload) })
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsedBody = JSON.parse(body);
                    resolve({ statusCode: res.statusCode, body: parsedBody });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, rawBody: body });
                }
            });
        });

        req.on('error', (err) => reject(err));
        if (payload) req.write(payload);
        req.end();
    });
};

const runEmergencyTestSuite = async () => {
    console.log(`\n======================================================`);
    console.log(`Starting Emergency Services API Automated Test Suite`);
    console.log(`Target: ${BASE_URL} (Port: ${PORT})`);
    console.log(`======================================================\n`);

    let createdTrackingId = '';
    let createdAuthKey = '';
    const testPassword = 'HealthXEmergency@2026';

    try {
        // TEST 1: Create Emergency Session
        console.log(`${COLOR_INFO} Test 1: POST /api/emergency/create`);
        const createRes = await sendRequest('POST', '/api/emergency/create', {
            title: 'Critical Incident - Expressway Pileup',
            description: 'Multi-vehicle collision near exit 14. Emergency dispatch initiated.',
            password: testPassword
        });

        if (createRes.statusCode === 201 && createRes.body && createRes.body.success) {
            createdTrackingId = createRes.body.data.emergencyTrackingId;
            createdAuthKey = createRes.body.data.authKey;
            console.log(`${COLOR_PASS} Session created successfully.`);
            console.log(`       Tracking ID: ${createdTrackingId}`);
            console.log(`       Auth Key:    ${createdAuthKey}`);
            console.log(`       Share Link:  ${createRes.body.data.shareableLink}\n`);
        } else {
            throw new Error(`Failed to create emergency: ${JSON.stringify(createRes.body || createRes.rawBody)}`);
        }

        // TEST 2: Fetch Public Session Metadata
        console.log(`${COLOR_INFO} Test 2: GET /api/emergency/${createdTrackingId}/info`);
        const infoRes = await sendRequest('GET', `/api/emergency/${createdTrackingId}/info`);

        if (infoRes.statusCode === 200 && infoRes.body && infoRes.body.success) {
            console.log(`${COLOR_PASS} Metadata fetched.`);
            console.log(`       Title:      ${infoRes.body.data.title}`);
            console.log(`       Protected:  ${infoRes.body.data.isPasswordProtected}`);
            console.log(`       Status:     ${infoRes.body.data.status}\n`);
        } else {
            throw new Error(`Failed to get public info: ${JSON.stringify(infoRes.body || infoRes.rawBody)}`);
        }

        // TEST 3: Direct Link Access via AuthKey (Magic Link Token)
        console.log(`${COLOR_INFO} Test 3: POST /api/emergency/join/magic (No password)`);
        const magicJoinRes = await sendRequest('POST', '/api/emergency/join/magic', {
            emergencyTrackingId: createdTrackingId,
            authKey: createdAuthKey
        });

        if (magicJoinRes.statusCode === 200 && magicJoinRes.body && magicJoinRes.body.success) {
            console.log(`${COLOR_PASS} Magic auth bypass successful.`);
            console.log(`       Session Token: ${magicJoinRes.body.data.token.substring(0, 24)}...\n`);
        } else {
            throw new Error(`Failed magic link join: ${JSON.stringify(magicJoinRes.body || magicJoinRes.rawBody)}`);
        }

        // TEST 4: Manual Login via Tracking ID + Correct Password
        console.log(`${COLOR_INFO} Test 4: POST /api/emergency/join/credentials (Valid Password)`);
        const credJoinRes = await sendRequest('POST', '/api/emergency/join/credentials', {
            emergencyTrackingId: createdTrackingId,
            password: testPassword
        });

        if (credJoinRes.statusCode === 200 && credJoinRes.body && credJoinRes.body.success) {
            console.log(`${COLOR_PASS} Credentials authentication successful.`);
            console.log(`       Session Token: ${credJoinRes.body.data.token.substring(0, 24)}...\n`);
        } else {
            throw new Error(`Failed credentials join: ${JSON.stringify(credJoinRes.body || credJoinRes.rawBody)}`);
        }

        // TEST 5: Negative Test: Manual Login with Wrong Password
        console.log(`${COLOR_INFO} Test 5: POST /api/emergency/join/credentials (Invalid Password Verification)`);
        const invalidCredRes = await sendRequest('POST', '/api/emergency/join/credentials', {
            emergencyTrackingId: createdTrackingId,
            password: 'WrongPasswordTest'
        });

        if (invalidCredRes.statusCode === 401 && !invalidCredRes.body.success) {
            console.log(`${COLOR_PASS} Security check passed: Unauthorized access was blocked.`);
            console.log(`       Server Message: "${invalidCredRes.body.message}"\n`);
        } else {
            throw new Error(`Security failed: Wrong password returned status ${invalidCredRes.statusCode}`);
        }

        console.log(`======================================================`);
        console.log(`\x1b[32mAll Emergency Session Routes Tested & Working!\x1b[0m`);
        console.log(`======================================================\n`);

    } catch (err) {
        console.error(`\n${COLOR_FAIL} Test execution interrupted:`, err.message);
        process.exit(1);
    }
};

runEmergencyTestSuite();
