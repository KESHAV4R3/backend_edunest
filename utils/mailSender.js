const nodemailer = require('nodemailer');

exports.sendMail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.APP_PASSWORD
      },
      // Production settings
      pool: true, // Use connection pooling
      maxConnections: 1, // Limit connections to prevent rate limiting
      maxMessages: 5, // Max messages per connection
      rateDelta: 1000, // Time between messages (ms)
      rateLimit: 5 // Max messages per second
    });

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: to,
      subject: subject,
      text: text,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('📧 Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('❌ Error sending mail:', error);
    throw error;
  }
};
