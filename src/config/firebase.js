const admin = require('firebase-admin');
const serviceAccount = require('./healthx-firebase-adminsdk.json'); // Your downloaded key

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;