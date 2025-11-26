
const mongoose = require('mongoose');
const { sendMail } = require('../utils/mailSender')

const otpSchema = new mongoose.Schema({

    // email of receiver
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    otp: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: {
        type: Date,
        default: Date.now(),
        expires: 5 * 60 // 5 minutes
    }
})


// function that sends a email verification mail
async function sendVerificationEmail(email, otp) {
    try {
        const mailResponse = await sendMail(
            email,
            "Email Verification from EDUNEST",
            `
           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 0; border: 1px solid #333; border-radius: 5px; background-color: #000; color: #fff;">
    <!-- Header -->
    <div style="background: #d10000; padding: 20px; border-radius: 5px 5px 0 0; text-align: center;">
        <h2 style="color: #fff; margin: 0; font-size: 24px;">EMAIL VERIFICATION</h2>
    </div>
    
    <!-- Content -->
    <div style="padding: 20px;">
        <p>Dear User,</p>
        <p>Thank you for signing up with <strong style="color: #d10000;">EDUNEST</strong>. Please use the following OTP to verify your email address:</p>
        
        <h3 style="color: #d10000; text-align: center; background: #222; padding: 15px; border-radius: 5px; font-size: 24px; letter-spacing: 3px;">
            ${otp}
        </h3>

        <p>If you did not request this, please ignore this email.</p>
    </div>
    
    <!-- Footer -->
    <div style="padding: 15px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #333;">
        Best Regards,<br>
        <span style="color: #d10000; font-weight: bold;">EDUNEST Team</span>
    </div>
</div>

            `
        );
        console.log("Email sent successfully: ", mailResponse.messageId);
    } catch (error) {
        console.error("Error in sending verification email:", {
            message: error.message,
            code: error.code,
            response: error.response,
            stack: error.stack
        });
        // We don't throw here to prevent the OTP creation from failing, 
        // but this means the user won't get the email even if the API returns success.
        // For debugging, this log is crucial.
    }
}


// before saving the entry in this model the pre middle-ware gets executed, in this before saving the data to this
// collection the call back function gets executed and after the execution of the function the entry gets stored inside the 
// database Otp collection

otpSchema.pre("save", async function (next) {
    // "this" keyword represent the document that is going to save in this model
    await sendVerificationEmail(this.email, this.otp);
    // the next call will add the entry into the model
    next();
})

module.exports = mongoose.model("Otp", otpSchema)