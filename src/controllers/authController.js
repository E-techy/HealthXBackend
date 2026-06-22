const UserAuth = require('../models/UserAuth');
const UserProfile = require('../models/UserProfile');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../utils/emailService');
const { generateJWT, generateOTP } = require('../utils/tokenUtils');

// 1. Initial Signup (Generates OTP)
exports.signup = async (req, res) => {
    try {
        // Data now comes from a Multipart form
        const { email, password, name } = req.body;
        
        let user = await UserAuth.findOne({ email });
        if (user) {
            return res.status(409).json({ success: false, message: "Email already registered. Please login." });
        }

        const otp = generateOTP();
        const otpExpires = Date.now() + 10 * 60 * 1000;

        user = new UserAuth({ email, passwordHash: password, otp, otpExpires });
        await user.save();

        // Construct the public URL for the image (if one was uploaded)
        let finalImageUrl = null;
        if (req.file) {
            // req.protocol = http or https
            // req.get('host') = localhost:5001 (or your future domain)
            // req.file.filename = the unique name multer generated
            finalImageUrl = req.file ? `/public/uploads/${req.file.filename}` : null;
        }

        // Save the public URL to the UserProfile
        await UserProfile.create({ 
            userId: user._id, 
            name, 
            profileImageUri: finalImageUrl 
        });

        await sendEmail(email, "Health X - Verify Your Email", `Your OTP for Health X is: ${otp}`);

        res.status(201).json({ success: true, message: "OTP sent to email. Please verify to complete signup." });
    } catch (error) {
        console.error("🔥 SIGNUP CRASH:", error);
        res.status(500).json({ success: false, message: "Server error during signup." });
    }
};

// 2. Verify OTP for Signup
exports.verifySignupOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await UserAuth.findOne({ email });

        if (!user) return res.status(404).json({ success: false, message: "User not found." });
        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
        }

        user.isEmailVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        const token = generateJWT(user._id);
        const profile = await UserProfile.findOne({ userId: user._id });

        res.status(200).json({
            success: true,
            message: "Email verified successfully.",
            token,
            // ADDED: Return the profilePhotoUrl to the Android app
            user: { 
                accountId: user._id, 
                email: user.email, 
                name: profile.name,
                profilePhotoUrl: profile.profileImageUri
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error during verification." });
    }
};

// 3. Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await UserAuth.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }
        if (!user.isEmailVerified) {
            return res.status(403).json({ success: false, message: "Please verify your email first." });
        }
        if (user.accountStatus !== 'ACTIVE') {
            return res.status(403).json({ success: false, message: `Account is ${user.accountStatus.toLowerCase()}.` });
        }

        user.lastLoginTimestamp = Date.now();
        await user.save();

        const token = generateJWT(user._id);
        const profile = await UserProfile.findOne({ userId: user._id });

        res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            // ADDED: Return the profilePhotoUrl to the Android app
            user: { 
                accountId: user._id, 
                email: user.email, 
                name: profile.name,
                profilePhotoUrl: profile.profileImageUri
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error during login." });
    }
};

// 4. Forgot Password (Send OTP)
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await UserAuth.findOne({ email });

        if (!user) {
            // Return 200 anyway for security (prevents email enumeration)
            return res.status(200).json({ success: true, message: "If an account exists, an OTP has been sent." });
        }

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpires = Date.now() + 15 * 60 * 1000; // 15 mins
        await user.save();

        await sendEmail(email, "Health X - Password Reset", `Your password reset OTP is: ${otp}`);
        
        res.status(200).json({ success: true, message: "OTP sent to registered email." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error processing request." });
    }
};

// 5. Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await UserAuth.findOne({ email });

        if (!user || user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
        }

        user.passwordHash = newPassword; // Will be hashed by the pre-save hook
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.status(200).json({ success: true, message: "Password updated successfully. You can now login." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error resetting password." });
    }
};