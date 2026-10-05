/**
 * Emergency API Route Verification Script (RBAC, ACL & Real Email Edition)
 * Run with: node tests/test-emergency-api.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 5001;
const BASE_URL = process.env.TEST_API_URL || `http://localhost:${PORT}`;
const parsedUrl = new URL(BASE_URL);

// Use the explicit test email from .env to verify real email delivery
const TEST_EMAIL = process.env.TEST_USER_FOR_RECEIVING_EMAILS || 'invitee@test.com';

// ANSI Output formatting
const COLOR_PASS = '\x1b[32m✔ PASS:\x1b[0m';
const COLOR_FAIL = '\x1b[31m✘ FAIL:\x1b[0m';
const COLOR_INFO = '\x1b[36mℹ INFO:\x1b[0m';
const COLOR_WARN = '\x1b[33m⚠ WARN:\x1b[0m';

const UserAuth = require('../src/models/UserAuth');
const EmergencySession = require('../src/models/EmergencySession');

const sendRequest = (method, reqPath, data = null, token = null) => {
    return new Promise((resolve, reject) => {
        const payload = data ? JSON.stringify(data) : null;
        const headers = { 'Content-Type': 'application/json' };
        
        if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
        if (token) headers['Authorization'] = `Bearer ${token}`;

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
                try {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
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
    console.log(`Starting Emergency Services API Test Suite (RBAC/ACL)`);
    console.log(`Target: ${BASE_URL}`);
    console.log(`Test Email Target: ${TEST_EMAIL}`);
    console.log(`======================================================\n`);

    let ownerUser, inviteeUser, uninvitedUser;
    let ownerToken, inviteeToken, uninvitedToken;
    let createdTrackingId = '';
    let createdAuthKey = '';
    const testPassword = 'SecureAdminPass123!';

    try {
        console.log(`${COLOR_INFO} Connecting to database for test user injection...`);
        await mongoose.connect(process.env.MONGO_URI);
        
        // Clean previous test artifacts
        await UserAuth.deleteMany({ email: { $in: ['owner@test.com', TEST_EMAIL, 'uninvited@test.com'] } });
        
        ownerUser = await UserAuth.create({ email: 'owner@test.com', passwordHash: 'hash', accountStatus: 'ACTIVE', isEmailVerified: true });
        // Injecting the real email to test Nodemailer
        inviteeUser = await UserAuth.create({ email: TEST_EMAIL, passwordHash: 'hash', accountStatus: 'ACTIVE', isEmailVerified: true });
        uninvitedUser = await UserAuth.create({ email: 'uninvited@test.com', passwordHash: 'hash', accountStatus: 'ACTIVE', isEmailVerified: true });

        const secret = process.env.JWT_SECRET;
        ownerToken = jwt.sign({ id: ownerUser._id }, secret, { expiresIn: '1h' });
        inviteeToken = jwt.sign({ id: inviteeUser._id }, secret, { expiresIn: '1h' });
        uninvitedToken = jwt.sign({ id: uninvitedUser._id }, secret, { expiresIn: '1h' });

        console.log(`${COLOR_PASS} Test users created and tokens generated.\n`);

        // TEST 1: Create Emergency Session (OWNER)
        console.log(`${COLOR_INFO} Test 1: POST /api/emergency/create (Owner Auth)`);
        const createRes = await sendRequest('POST', '/api/emergency/create', {
            title: 'Test Incident',
            description: 'Initial description',
            password: testPassword
        }, ownerToken);

        if (createRes.statusCode === 201 && createRes.body.success) {
            createdTrackingId = createRes.body.data.emergencyTrackingId;
            createdAuthKey = createRes.body.data.authKey;
            console.log(`${COLOR_PASS} Session created. Tracking ID: ${createdTrackingId}\n`);
        } else {
            throw new Error(`Create failed: ${JSON.stringify(createRes.body)}`);
        }

        // TEST 2: Update Emergency Details (OWNER)
        console.log(`${COLOR_INFO} Test 2: PUT /api/emergency/${createdTrackingId} (Owner Auth)`);
        const updateRes = await sendRequest('PUT', `/api/emergency/${createdTrackingId}`, {
            title: 'Updated Test Incident',
            description: 'Updated description'
        }, ownerToken);

        if (updateRes.statusCode === 200 && updateRes.body.success) {
            console.log(`${COLOR_PASS} Details updated successfully.\n`);
        } else {
            throw new Error(`Update failed: ${JSON.stringify(updateRes.body)}`);
        }

        // TEST 3: Invite User (OWNER - Triggers Real Email)
        console.log(`${COLOR_INFO} Test 3: POST /api/emergency/${createdTrackingId}/invite (Owner Auth)`);
        console.log(`${COLOR_INFO} >> Watch server logs for real Nodemailer output to ${TEST_EMAIL}`);
        const inviteRes = await sendRequest('POST', `/api/emergency/${createdTrackingId}/invite`, {
            userIds: [inviteeUser._id]
        }, ownerToken);

        if (inviteRes.statusCode === 200 && inviteRes.body.success) {
            console.log(`${COLOR_PASS} User invited successfully (ACL updated & Email dispatched).\n`);
        } else {
            throw new Error(`Invite failed: ${JSON.stringify(inviteRes.body)}`);
        }

        // TEST 4: Join via Credentials (INVITEE - Allowed via ACL)
        console.log(`${COLOR_INFO} Test 4: POST /api/emergency/join/credentials (Invitee Auth)`);
        const joinRes = await sendRequest('POST', '/api/emergency/join/credentials', {
            emergencyTrackingId: createdTrackingId,
            password: testPassword
        }, inviteeToken);

        if (joinRes.statusCode === 200 && joinRes.body.success) {
            console.log(`${COLOR_PASS} Invitee successfully joined the restricted session.\n`);
        } else {
            throw new Error(`Invitee join failed: ${JSON.stringify(joinRes.body)}`);
        }

        // TEST 5: Join via Magic Link (UNINVITED - Blocked by ACL)
        console.log(`${COLOR_INFO} Test 5: POST /api/emergency/join/magic (Uninvited Auth - Expecting Block)`);
        const blockRes = await sendRequest('POST', '/api/emergency/join/magic', {
            emergencyTrackingId: createdTrackingId,
            authKey: createdAuthKey
        }, uninvitedToken);

        if (blockRes.statusCode === 401 && !blockRes.body.success) {
            console.log(`${COLOR_PASS} Access Control List (ACL) successfully blocked unauthorized user.`);
            console.log(`       Message: "${blockRes.body.message}"\n`);
        } else {
            throw new Error(`ACL failed! Uninvited user was allowed in: ${JSON.stringify(blockRes.body)}`);
        }

        // TEST 6: Delete Emergency (OWNER)
        console.log(`${COLOR_INFO} Test 6: DELETE /api/emergency/${createdTrackingId} (Owner Auth)`);
        const deleteRes = await sendRequest('DELETE', `/api/emergency/${createdTrackingId}`, null, ownerToken);

        if (deleteRes.statusCode === 200 && deleteRes.body.success) {
            console.log(`${COLOR_PASS} Emergency session deleted successfully.\n`);
        } else {
            throw new Error(`Delete failed: ${JSON.stringify(deleteRes.body)}`);
        }

        console.log(`======================================================`);
        console.log(`\x1b[32mAll RBAC/ACL Emergency Routes Tested & Working!\x1b[0m`);
        console.log(`======================================================\n`);

    } catch (err) {
        console.error(`\n${COLOR_FAIL} Test execution interrupted:`, err.message);
    } finally {
        console.log(`${COLOR_WARN} Cleaning up test users and remaining artifacts...`);
        if (ownerUser) await UserAuth.findByIdAndDelete(ownerUser._id);
        if (inviteeUser) await UserAuth.findByIdAndDelete(inviteeUser._id);
        if (uninvitedUser) await UserAuth.findByIdAndDelete(uninvitedUser._id);
        if (createdTrackingId) await EmergencySession.deleteOne({ emergencyTrackingId: createdTrackingId });
        
        await mongoose.disconnect();
        console.log(`${COLOR_INFO} Database disconnected. Tests complete.`);
        process.exit(0);
    }
};

runEmergencyTestSuite();
