const multer = require('multer');
const path = require('path');
const fs = require('fs');

// We save docs outside the 'public' folder so they cannot be accessed directly via URL
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Creates a directory like src/../protected_docs
        const dir = path.join(__dirname, '../../protected_docs');
        
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Unique filename: timestamp + random number + original name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const uploadDocs = multer({ 
    storage: storage,
    limits: { fileSize: 15 * 1024 * 1024 } // Optional: limit file size to 15MB
});

module.exports = uploadDocs;