const jwt = require('jsonwebtoken');
const UserAuth = require('../models/UserAuth');

exports.requireJWT = async (req, res, next) => {
    try {
        // 1. Look for the token in the headers
        let token;
        
        // The standard format Android will send is: "Authorization: Bearer <token>"
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            // Split the string by the space and grab the actual token payload
            token = req.headers.authorization.split(' ')[1];
        }

        // If no token was attached at all
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: "Not authorized. No token provided." 
            });
        }

        // 2. Verify and decode the token
        // This will throw an error automatically if the token is tampered with or expired
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Verify the user still exists in the database
        // (e.g., they didn't delete their account from another device)
        const user = await UserAuth.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: "The user belonging to this token no longer exists." 
            });
        }

        // 4. Ensure the account isn't suspended
        if (user.accountStatus !== 'ACTIVE') {
            return res.status(403).json({ 
                success: false, 
                message: `Access denied. Account is ${user.accountStatus.toLowerCase()}.` 
            });
        }

        // 5. Attach the user data to the request object
        // Now, your reminderController can safely call `req.user.id`
        req.user = { id: user._id };
        
        // 6. Pass control to the next function (the controller)
        next();

    } catch (error) {
        console.error("🔥 JWT Verification Error:", error.message);
        
        // Give the Android app a specific error message so it knows to force a re-login
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: "Session expired. Please log in again." 
            });
        }
        
        return res.status(401).json({ 
            success: false, 
            message: "Not authorized. Invalid token." 
        });
    }
};