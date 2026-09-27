const jwt = require('jsonwebtoken');
const PoliceUnit = require('../models/PoliceUnit');

exports.requirePoliceJWT = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ success: false, message: "Police authorization required." });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const policeUnit = await PoliceUnit.findById(decoded.id);
        
        if (!policeUnit) {
            return res.status(401).json({ success: false, message: "Invalid police credentials." });
        }

        req.policeUnit = { id: policeUnit._id, areaCode: policeUnit.areaCode };
        next();
    } catch (error) {
        console.error("🔥 Police JWT Verification Error:", error.message);
        return res.status(401).json({ success: false, message: "Not authorized." });
    }
};