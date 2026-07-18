const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        try {
            const dir = path.join(__dirname, '../../protected_docs');
            
            // Auto-create directory safely
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`[DocsManager] 📁 Created secure directory at: ${dir}`);
            }
            cb(null, dir);
        } catch (error) {
            console.error("[DocsManager] ❌ Failed to create destination directory:", error.message);
            // Pass the error to multer so it aborts cleanly
            cb(new Error("Internal server error during file upload initialization."));
        }
    },
    filename: function (req, file, cb) {
        try {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            // Replace spaces with underscores to prevent URL encoding issues later
            const safeName = file.originalname.replace(/\s+/g, '_');
            cb(null, uniqueSuffix + '-' + safeName);
        } catch (error) {
            console.error("[DocsManager] ❌ Error generating filename:", error.message);
            cb(new Error("Failed to process file name."));
        }
    }
});

const uploadDocs = multer({ 
    storage: storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
    fileFilter: (req, file, cb) => {
        // You can add logic here to reject executable files like .exe or .sh
        cb(null, true); 
    }
});

module.exports = uploadDocs;