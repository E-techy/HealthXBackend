const crypto = require('crypto');

// Get the key from env, or use a default
const RAW_KEY = process.env.ENCRYPTION_KEY || 'healthx_emergency_fallback_key';

// FIX: Generate a guaranteed 32-byte (256-bit) key by hashing the raw string with SHA-256.
// This prevents the "Invalid key length" error regardless of what is in your .env file.
const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(RAW_KEY)).digest(); 

const IV_LENGTH = 16; 

exports.encrypt = (text) => {
    if (!text) return null;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
        console.error("Encryption failed:", e.message);
        return null;
    }
};

exports.decrypt = (text) => {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        console.error("Decryption failed:", e.message);
        return null; 
    }
};

exports.maskSSN = (ssn) => {
    if (!ssn || ssn.length < 4) return '***-**-****';
    return `***-**-${ssn.slice(-4)}`;
};
