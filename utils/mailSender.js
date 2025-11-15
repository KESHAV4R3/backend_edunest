const nodemailer = require("nodemailer");
require('dotenv').config()

exports.sendMail = async (email, title, body) => {
    try {

        // transporter
        const transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: 587, // Add port explicitly
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD,
            },
        });

        // Verify transporter connection
        await transporter.verify();
        console.log("Server is ready to take our messages");

        // send email
        const info = await transporter.sendMail({
            from: `"EDUNEST EDTECH pvt.ltd" <${process.env.MAIL_USER}>`, // Use email in from field
            to: `${email}`,
            subject: `${title}`,
            html: `${body}`
        });

        console.log("Email sent successfully:", info.messageId);
        return info;
        
    } catch (error) {
        console.error('Error occurred while sending email:', error.message);
        throw error; // Re-throw to handle in calling function
    }
}
