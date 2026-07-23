const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 🚨 STRICT SECURITY: Block these dangerous file extensions
const FORBIDDEN_EXTENSIONS = ['.exe', '.bat', '.sh', '.apk', '.msi', '.js', '.cmd', '.vbs', '.php', '.py'];

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
            cb(new Error("Internal server error during file upload initialization."));
        }
    },
    filename: function (req, file, cb) {
        try {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            
            // Extract the true extension from the original file
            const ext = path.extname(file.originalname);
            // Clean the base name (remove spaces)
            const safeBaseName = path.basename(file.originalname, ext).replace(/\s+/g, '_');
            
            // Reconstruct perfectly: 1784710660982-1234-My_Doc.pdf
            cb(null, uniqueSuffix + '-' + safeBaseName + ext);
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
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (FORBIDDEN_EXTENSIONS.includes(ext)) {
            console.warn(`[DocsManager] 🛡️ Security blocked malicious upload attempt. Ext: ${ext}`);
            return cb(new Error(`Security Alert: File type ${ext} is strictly forbidden.`), false);
        }
        
        cb(null, true); 
    }
});

module.exports = uploadDocs;