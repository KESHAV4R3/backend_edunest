const nodemailer = require("nodemailer");
require('dotenv').config();

exports.sendMail = async (email, title, body) => {
    try {
        // Create a transporter using Google SMTP
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.MAIL_USER, // Your Gmail address
                pass: process.env.MAIL_PASSWORD, // Your App Password
            },
        });

        // Send email
        const info = await transporter.sendMail({
            from: `"EDUNEST EDTECH" <${process.env.MAIL_USER}>`, // Sender address
            to: email,
            subject: title,
            html: body
        });

        console.log('Email sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error.message);
        throw error; // Re-throw to handle in the calling function
    }
};
