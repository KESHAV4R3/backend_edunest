const nodemailer = require("nodemailer");

exports.sendMail = async (email, title, body) => {
    try {
        console.log(`Sending email to: ${email}`);
        
        const transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: parseInt(process.env.MAIL_PORT),
            secure: process.env.MAIL_SECURE === 'true',
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD,
            }
        });

        const info = await transporter.sendMail({
            from: `"EDUNEST EDTECH" <${process.env.MAIL_FROM}>`,
            to: email,
            subject: title,
            html: body
        });

        console.log("Email sent successfully:", info.messageId);
        return info;
        
    } catch (error) {
        console.error('Email send failed:', {
            to: email,
            error: error.message,
            response: error.response
        });
        throw error;
    }
};