const nodemailer = require('nodemailer');
require('dotenv').config();

exports.sendMail = async (to, subject, htmlContent) => {
    try {
        const smtpConfig = {
            host: process.env.MAIL_HOST,
            port: process.env.MAIL_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        };

        const transporter = nodemailer.createTransport(smtpConfig);

        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to,
            subject,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("✅ Email sent:", info.messageId);
        return info;

    } catch (error) {
        console.error("❌ Email sending failed:", error.message);
        throw error;
    }
};