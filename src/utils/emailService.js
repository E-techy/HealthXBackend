const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendEmail = async (to, subject, text) => {
    try {
        await transporter.sendMail({
            from: `"Health X Support" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
        });
    } catch (error) {
        console.error("Email sending failed:", error);
    }
};

module.exports = { sendEmail };