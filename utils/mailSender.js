const nodemailer = require('nodemailer');

// Verify environment variables on startup
const requiredEnvVars = ['MAIL_USER', 'APP_PASSWORD', 'SENDER_EMAIL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
}

exports.sendMail = async (to, subject, text) => {
  console.log(`📤 Attempting to send email to: ${to}`);
  
  // Validate input
  if (!to || !subject || !text) {
    const error = new Error('Missing required email parameters');
    console.error('❌ Validation error:', error.message);
    throw error;
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.APP_PASSWORD
    },
    // Connection timeout in ms (default is 30s)
    connectionTimeout: 10000,
    // How many milliseconds to wait for the connection to resolve
    socketTimeout: 30000,
    // Log SMTP traffic
    logger: true,
    // Debug output
    debug: true
  });

  // Verify connection configuration
  try {
    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ Server is ready to take our messages');
  } catch (error) {
    console.error('❌ SMTP connection verification failed:', error);
    throw new Error(`SMTP Connection Error: ${error.message}`);
  }

  const mailOptions = {
    from: process.env.SENDER_EMAIL,
    to: to,
    subject: subject,
    text: text,
    // Add headers to prevent emails from being marked as spam
    headers: {
      'X-Laziness-level': 1000
    }
  };

  try {
    console.log('✉️ Sending email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Error sending email:', {
      error: error.message,
      stack: error.stack,
      response: error.response
    });
    throw new Error(`Failed to send email: ${error.message}`);
  } finally {
    // Close the transporter when done
    transporter.close();
  }
};
