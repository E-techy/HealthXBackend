const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ADD THIS MISSING LINE:
const upload = require('../utils/uploadConfig'); 

// Now this will work!
router.post('/signup', upload.single('profileImage'), authController.signup);

router.post('/verify-otp', authController.verifySignupOTP);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;