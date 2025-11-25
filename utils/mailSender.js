const nodemailer = require("nodemailer");
require('dotenv').config();

exports.sendMail = async (email, title, body) => {
    try {
        let transporter;

        // Use SendGrid for production (when SENDGRID_API_KEY is set)
        // Use Gmail for local development
        if (process.env.SENDGRID_API_KEY) {
            console.log('📧 Using SendGrid for email delivery');
            transporter = nodemailer.createTransport({
                host: 'smtp.sendgrid.net',
                port: 587,
                secure: false,
                auth: {
                    user: 'apikey', // SendGrid uses 'apikey' as username
                    pass: process.env.SENDGRID_API_KEY,
                },
            });
        } else {
            console.log('📧 Using Gmail SMTP for email delivery');
            // Try port 2525 first (cloud-friendly), then 465 (SSL), fallback to 587
            const smtpPort = parseInt(process.env.SMTP_PORT) || 2525;
            const isSSL = smtpPort === 465;

            console.log(`   Attempting connection on port ${smtpPort} (SSL: ${isSSL})`);

            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: smtpPort,
                secure: isSSL, // true for 465, false for other ports
                auth: {
                    user: process.env.MAIL_USER,
                    pass: process.env.MAIL_PASSWORD,
                },
                tls: {
                    rejectUnauthorized: false,
                    minVersion: 'TLSv1.2',
                },
                connectionTimeout: 15000, // Increased timeout for slow connections
                greetingTimeout: 10000,
                socketTimeout: 15000,
            });
        }

        // Verify connection configuration
        await transporter.verify();
        console.log('✅ SMTP connection verified - Server is ready to send emails');

        // Email options
        const mailOptions = {
            from: `"EDUNEST EDTECH" <${process.env.MAIL_USER || 'noreply@edunest.com'}>`,
            to: email,
            subject: title,
            html: body,
            // Add message-id for better tracking
            messageId: `<${Date.now()}@${process.env.DOMAIN || 'edunest.com'}>`,
        };

        // Send email with retry logic
        const MAX_RETRIES = 3;
        let attempts = 0;
        let lastError;

        while (attempts < MAX_RETRIES) {
            try {
                attempts++;
                console.log(`Sending email (attempt ${attempts} of ${MAX_RETRIES})`);
                const info = await transporter.sendMail(mailOptions);
                console.log('Email sent:', info.messageId);
                return info;
            } catch (error) {
                lastError = error;
                console.error(`Attempt ${attempts} failed:`, error.message);
                if (attempts < MAX_RETRIES) {
                    // Wait before retrying (exponential backoff)
                    const delay = Math.pow(2, attempts) * 1000;
                    console.log(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // If we get here, all retries failed
        throw lastError;
    } catch (error) {
        console.error('Error in sendMail:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            response: error.response,
            command: error.command
        });
        throw error;
    }
};
