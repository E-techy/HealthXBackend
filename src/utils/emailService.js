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
    const startTime = new Date();

    console.log("📧 ===== EMAIL PROCESS START =====");
    console.log("⏰ Time:", startTime.toISOString());
    console.log("📤 From:", process.env.EMAIL_USER);
    console.log("📥 To:", to);
    console.log("📝 Subject:", subject);
    console.log("📄 Message:", text);

    try {
        const info = await transporter.sendMail({
            from: `"Health X Support" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
        });

        const endTime = new Date();

        console.log("✅ Email sent successfully!");
        console.log("📨 Message ID:", info.messageId);
        console.log("📬 Response:", info.response);
        console.log("⏱ Duration:", `${endTime - startTime} ms`);
        console.log("📧 ===== EMAIL PROCESS END =====\n");

    } catch (error) {
        const errorTime = new Date();

        console.error("❌ EMAIL FAILED");
        console.error("⏰ Time:", errorTime.toISOString());
        console.error("📤 From:", process.env.EMAIL_USER);
        console.error("📥 To:", to);
        console.error("📝 Subject:", subject);
        console.error("💥 Error Message:", error.message);
        console.error("📚 Stack Trace:", error.stack);
        console.error("📧 ===== EMAIL PROCESS END (FAILED) =====\n");
    }
};

module.exports = { sendEmail };