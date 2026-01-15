const nodemailer = require('nodemailer');
require('dotenv').config();

exports.sendMail = async (to, subject, htmlContent) => {
    try {
        if (!process.env.MAIL_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            throw new Error('SMTP configuration is missing. Please check your .env file');
        }

        const transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: parseInt(process.env.MAIL_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            },
            tls: {
                rejectUnauthorized: false // Only for testing, remove in production
            }
        });

        // Verify connection configuration
        await transporter.verify();

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.SMTP_USER,
            to,
            subject,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("✅ Email sent:", info.messageId);
        return info;

    } catch (error) {
        console.error("❌ Email sending failed:", error.message);
        if (error.response) {
            console.error("SMTP Error Response:", error.response);
        }
        throw error;
    }
};