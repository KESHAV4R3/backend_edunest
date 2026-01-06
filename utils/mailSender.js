// sendMail.js
const axios = require('axios');
require('dotenv').config();

exports.sendMail = async (to, subject, htmlContent) => {
  try {
    const apiKey = process.env.X_BREVO_API_KEY;
    if (!apiKey) {
      throw new Error("Brevo API key missing. Set X_BREVO_API_KEY in .env");
    }

    const senderRaw = process.env.X_MAIL_FROM;
    const senderEmail = senderRaw.match(/<(.+)>/) ? senderRaw.match(/<(.+)>/)[1] : "";
    const senderName = senderRaw.split("<")[0].trim().replace(/"/g, "");

    const payload = {
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent
    };

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Email sent:", response.data);
    return response.data;

  } catch (error) {
    console.log("❌ Email sending failed:", error.response?.data || error.message);
    throw error;
  }
};
