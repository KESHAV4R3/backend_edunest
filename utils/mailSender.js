const nodemailer = require("nodemailer");
require('dotenv').config();

exports.sendMail = async (email, title, body) => {
    try {
        const smtpPort = parseInt(process.env.SMTP_PORT) || 587;

        // SMTP configuration
        const smtpConfig = {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: smtpPort,
            // Port 465 uses SSL/TLS (secure: true)
            // Port 587 uses STARTTLS (secure: false)
            secure: smtpPort === 465,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD,
            },
            // TLS settings for better compatibility
            tls: {
                // Don't fail on invalid certs (some SMTP servers have issues)
                rejectUnauthorized: false,
                // Minimum TLS version
                minVersion: 'TLSv1.2',
            },
            // Connection timeouts
            connectionTimeout: 10000, // 10 seconds
            greetingTimeout: 5000, // 5 seconds
            socketTimeout: 10000, // 10 seconds
        };

       
        // Create a transporter
        const transporter = nodemailer.createTransport(smtpConfig);

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
