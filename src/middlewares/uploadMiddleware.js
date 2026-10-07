const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directories exist
const dirs = [
    'public/emergency_victim',
    'public/emergency_culprit',
    'public/emergency_detailed_docs'
];

dirs.forEach(dir => {
    const fullPath = path.join(__dirname, '../../', dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dest = 'public/uploads'; // fallback
        if (file.fieldname === 'victimImage') dest = 'public/emergency_victim';
        else if (file.fieldname === 'culpritImage') dest = 'public/emergency_culprit';
        else if (file.fieldname === 'detailedDoc') dest = 'public/emergency_detailed_docs';
        
        cb(null, path.join(__dirname, '../../', dest));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'detailedDoc') {
        // Accept PDFs and Word Docs
        if (file.mimetype === 'application/pdf' || file.mimetype.includes('word')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid document type. Only PDF and Word allowed.'), false);
        }
    } else {
        // Accept Images for Victim/Culprit
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images are allowed.'), false);
        }
    }
};

// Enforce 3MB limit
const upload = multer({ 
    storage, 
    fileFilter,
    limits: { fileSize: 3 * 1024 * 1024 } // 3 MB
});

module.exports = upload;
