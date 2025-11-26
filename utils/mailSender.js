const nodemailer = require("nodemailer");
require("dotenv").config();

exports.sendMail = async (email, title, body) => {
    try {
        console.log("📧 Using Gmail SMTP for email delivery");

        const mailConfig = {
            host: process.env.MAIL_HOST,
            port: process.env.MAIL_PORT,
            secure: process.env.MAIL_PORT == 465,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD,
            },
            tls: {
                rejectUnauthorized: false,
            },
            // Add timeouts to fail faster and avoid hanging
            connectionTimeout: 10000,
            greetingTimeout: 5000,
            socketTimeout: 10000,
            // Force IPv4 to avoid IPv6 issues on some cloud providers
            family: 4,
        };

        console.log("SMTP Config:", {
            host: mailConfig.host,
            port: mailConfig.port,
            secure: mailConfig.secure,
            user: mailConfig.auth.user,
            // Do not log the password
        });

        const transporter = nodemailer.createTransport(mailConfig);

        // Verify SMTP connection
        await transporter.verify();
        console.log("✅ Gmail SMTP verified — ready to send email");

        const mailOptions = {
            from: `"EDUNEST EDTECH" <${process.env.MAIL_USER}>`,
            to: email,
            subject: title,
            html: body,
            messageId: `<${Date.now()}@edunest.com>`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("📨 Email sent →", info.messageId);

        return info;

    } catch (error) {
        console.error("❌ Error sending mail:", {
            message: error.message,
            code: error.code,
            stack: error.stack,
            command: error.command,
            response: error.response
        });
        throw error;
    }
};
