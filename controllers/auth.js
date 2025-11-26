// in this controller all the business logic that are related to authentication and authorization are written
const axios = require('axios')
const isProduction = process.env.NODE_ENV === 'production';
const Otp = require('../models/Otp');
const User = require('../models/User');
const Profile = require('../models/Profile');
const otpGenerator = require('otp-generator');
const bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');
require('dotenv').config();
const { sendMail } = require('../utils/mailSender');
const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// send otp ww
exports.sendOtp = async (req, res) => {
    try {

        // fetch data from req.body
        const { email } = req.body;
        console.log("sendOtp Request Body:", req.body);
        if (!email || !req.body) {
            return res.status(404).json({
                success: false,
                message: 'Email is required'
            });
        }

        // verify the validity of the email
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: "Invalid email format" });
        }

        // check if user is already exist
        if (await User.findOne({ email }).lean()) {
            return res.status(400).json({
                success: false,
                message: 'User already registered, login to continue.'
            });
        }

        // generate otp
        let otp = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false
        });

        // make sure the otp is unique , generate the otp till it is unique
        while (await Otp.findOne({ otp: otp }).lean()) {
            otp = otpGenerator.generate(6, {
                upperCaseAlphabets: false,
                lowerCaseAlphabets: false,
                specialChars: false
            })
        }

        // add this entry to the Otp database collection
        await Otp.create({ otp: otp, email: email });

        res.status(200).json({
            success: true,
            message: 'Otp has been sent successfully in the users mail'
        });

    } catch (error) {
        console.error("Error in sendOtp:", error);
        return res.status(500).json({
            success: false,
            message: 'Server Error, unable to send Otp'
        });
    }
}

// sign-up ww
exports.signUp = async (req, res) => {
    try {

        // fetch data from req.body
        const { firstName, lastName, email, password, confirmPassword, accountType, otp } = req.body;
        console.log("signUp Request Body:", { ...req.body, password: "***", confirmPassword: "***" });
        if (!firstName || !email || !password || !confirmPassword || !accountType || !otp) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // match the password and confirm password
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords and confirm password does not match'
            });
        }

        // find the recent otp based on the provided mail
        // it will give the latest entry on the database Otp with the given email
        const recentOtp = await Otp.findOne({ email }).sort({ createdAt: -1 }).limit(1).lean();

        // validate the otp
        // no recent OTP in database
        if (!recentOtp) {
            return res.status(400).json({
                success: false,
                message: 'OTP not found, Resend it'
            });
        }
        // otp does not match
        else if (recentOtp.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'invalid OTP'
            });
        }

        // hash password using bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // create the entry in database
        const userImageUrl = `https://ui-avatars.com/api/?name=${firstName}+${lastName}`
        const userProfile = await Profile.create({
            userName: "",
            gender: "",
            dob: "",
            about: "",
            profession: ""
        })

        // create the entry in user database collection
        const newUser = await User.create({
            firstName, lastName, email, password: hashedPassword, accountType, image: userImageUrl, profile: userProfile._id
        })

        if (newUser) {
            //  if user is created successfully then send a mail to the user
            console.log("User created successfully. Sending welcome email to:", email);
            await sendMail(email, "Welcome to EDUNEST",
                `
             <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000000; color: #ffffff; border: 1px solid #333333;">
    <!-- Header -->
    <div style="background: #d10000; padding: 25px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">WELCOME TO EDUNEST</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 25px;">
        <p style="margin-bottom: 15px; line-height: 1.6;">Thank you for signing up with EDUNEST as a ${accountType}. We are excited to have you on board!</p>
        
        <p style="margin-bottom: 15px;">Here are some resources to get you started:</p>
        
        <ul style="padding-left: 20px; margin-bottom: 20px;">
            <li style="margin-bottom: 12px;">
                <a href="https://example.com/start" 
                   style="color: #d10000; text-decoration: none; font-weight: bold; border-bottom: 1px solid #d10000;">
                   Getting Started Guide
                </a>
            </li>
            <li>
                <a href="https://example.com/support" 
                   style="color: #d10000; text-decoration: none; font-weight: bold; border-bottom: 1px solid #d10000;">
                   Support Center
                </a>
            </li>
        </ul>
        
        <p style="margin-bottom: 15px;">We hope you enjoy your experience with us.</p>
        
        <p style="margin-top: 25px;">
            Best regards,<br>
            <span style="color: #d10000; font-weight: bold;">The EDUNEST Team</span>
        </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #1a1a1a; text-align: center; padding: 15px; font-size: 12px; border-top: 1px solid #333333;">
        © 2023 EDUNEST | <a href="#" style="color: #d10000; text-decoration: none;">Privacy Policy</a> | <a href="#" style="color: #d10000; text-decoration: none;">Contact Us</a>
    </div>
</div>
            `)
        }

        return res.status(200).json({
            success: true,
            message: 'User is registered successfully, login to continue'
        });

    } catch (error) {
        console.error("Error in signUp:", error);
        return res.status(500).json({
            success: false,
            message: 'Server Error, unable to register the user'
        });
    }
}

// google login
exports.googleLogin = async (req, res) => {
    try {
        const { access_token, accountType } = req.body;

        if (!access_token) {
            return res.status(400).json({
                success: false,
                message: "Access token is required",
            });
        }

        // Fetch user info from Google
        const { data } = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        const { email, name, picture } = data;

        // Check if user exists in DB
        const user = await User.findOne({ email });

        if (accountType != user.accountType) {
            return res.json({
                success: false,
                message: "invalid User"
            })
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found. Please register first.",
            });
        }

        // Create JWT token
        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                name: `${user.firstName} ${user.lastName}`,
                accountType: user.accountType,
                image: user.image,
            },
            process.env.JWT_SECRET,
            { expiresIn: "10h" }
        );

        // Set token as secure cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "None" : "Lax",
            secure: true,
            sameSite: "None",
            expires: new Date(Date.now() + 10 * 60 * 60 * 1000),
        });

        // Respond with user data
        return res.status(200).json({
            success: true,
            message: "Login successful",
            user: {
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                accountType: user.accountType,
                image: user.image,
            },
        });
    } catch (error) {
        console.error("Google login error:", error.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: "Google login failed",
        });
    }

};

// google signUp
exports.googleSignUp = async (req, res) => {
    try {
        const { access_token, accountType } = req.body;

        if (!access_token || !accountType) {
            return res.status(400).json({
                success: false,
                message: "Access token and account type are required",
            });
        }

        if (accountType == "Admin") {
            return res.json({
                success: false,
                message: "Feature not for Admin"
            })
        }

        // Get user info from Google
        const { data } = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        const { email, name, picture } = data;

        // Check if user already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists. Please login instead.",
            });
        }

        const [firstName, ...rest] = name.split(" ");
        const lastName = rest.join(" ") || "";

        // Create a profile
        const userProfile = await Profile.create({
            userName: "",
            gender: "",
            dob: "",
            about: "",
            profession: "",
        });

        // Create the user
        const newUser = await User.create({
            firstName,
            lastName,
            email,
            accountType,
            image: picture || `https://ui-avatars.com/api/?name=${firstName}+${lastName}`,
            profile: userProfile._id,
            password: "google_temp_password"
        });

        if (newUser) {
            // Send welcome email
            await sendMail(email, "Welcome to EDUNEST", `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000000; color: #ffffff; border: 1px solid #333333;">
          <div style="background: #d10000; padding: 25px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">WELCOME TO EDUNEST</h1>
          </div>
          <div style="padding: 25px;">
            <p style="margin-bottom: 15px;">Thank you for signing up with EDUNEST as a ${accountType}. We're excited to have you!</p>
            <ul style="padding-left: 20px; margin-bottom: 20px;">
              <li><a href="https://example.com/start" style="color: #d10000;">Getting Started Guide</a></li>
              <li><a href="https://example.com/support" style="color: #d10000;">Support Center</a></li>
            </ul>
            <p>We hope you enjoy your experience with us.</p>
            <p style="margin-top: 25px;">Best regards,<br><span style="color: #d10000;">The EDUNEST Team</span></p>
          </div>
          <div style="background: #1a1a1a; text-align: center; padding: 15px; font-size: 12px; border-top: 1px solid #333333;">
            © 2023 EDUNEST | <a href="#" style="color: #d10000;">Privacy Policy</a> | <a href="#" style="color: #d10000;">Contact Us</a>
          </div>
        </div>
      `);
        }

        return res.status(201).json({
            success: true,
            message: "User registered successfully. Please login to continue.",
        });
    } catch (error) {
        console.error("Google registration error:", error.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: "Server Error. Unable to register the user with Google.",
        });
    }
};

// automatic login ww
exports.loginAutomatic = async (req, res) => {

    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token not found",
            });
        }
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decode.id).lean();
        // check if the user is there or not
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }
        return res.status(200).json({
            success: true,
            message: 'User is logged in successfully',
            user: decode
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: 'Invalid token'
        })
    }
}

// login ww
exports.login = async (req, res) => {
    try {
        console.log('Login request received:', req.body);

        // fetch data from req.body
        const { email, password, accountType } = req.body;
        if (!email || !password || !accountType) {
            console.log('Missing fields in request:', { email: !!email, password: !!password, accountType: !!accountType });
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // verify the validity of the email
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: "Invalid email format" });
        }

        // check if user is there or not
        console.log('Searching for user with email:', email);
        const currentUser = await User.findOne({ email }).lean();
        console.log('User found:', currentUser ? 'Yes' : 'No');

        if (!currentUser) {
            console.log('User not found in database');
            return res.status(404).json({
                success: false,
                message: 'User not found, kindly Register'
            })
        }
        console.log('User account type:', currentUser.accountType, 'Requested account type:', accountType);
        if (currentUser.accountType != accountType) {
            console.log('Account type mismatch');
            return res.status(400).json({
                success: false,
                message: `Invalid account type. Expected ${currentUser.accountType} but got ${accountType}`
            })
        }

        // match the password
        console.log('Comparing passwords...');
        const isPasswordMatch = await bcrypt.compare(password, currentUser.password);
        console.log('Password match result:', isPasswordMatch);

        if (isPasswordMatch) {

            // generate the token
            console.log('Generating JWT token...');
            const payload = {
                name: currentUser.firstName + ' ' + currentUser.lastName,
                email: currentUser.email,
                accountType: currentUser.accountType,
                id: currentUser._id,
                image: currentUser.image
            }
            console.log('JWT payload:', payload);
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10h' });
            console.log('JWT token generated successfully');

            // return cookie as a response
            res.cookie('token', token, {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? "None" : "Lax",
                secure: true,
                sameSite: 'None',
                expires: new Date(Date.now() + 10 * 60 * 60 * 1000),
            })
                .status(200).json({
                    success: true,
                    message: 'User logged in successfully',
                    user: {
                        name: currentUser.firstName + ' ' + currentUser.lastName,
                        image: currentUser.image,
                        role: currentUser.accountType,
                        accountType: currentUser.accountType,
                        email: currentUser.email
                    }
                })

            // both the cookie and the token will be expired in 5-hours from the time of creation

        }
        else {
            return res.status(404).json({
                success: false,
                message: 'wrong password'
            })
        }

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server Error, unable to login',
            error: error.message
        })
    }
}

// logout ww
exports.logout = async (req, res) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "None" : "Lax",
            secure: true,
            sameSite: 'None',
        });

        return res.status(200).json({
            success: true,
            message: "Logout successful",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server Error, unable to logout'
        });
    }
};


//---------------------------------- For admin

// send OTP ww
exports.sendOtpToOwner = async (req, res) => {
    try {
        const OwnerMail = process.env.MAIL_USER;
        // generate otp
        let otp = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false
        });

        // make sure the otp is unique , generate the otp till it is unique
        while (await Otp.findOne({ otp: otp }).lean()) {
            otp = otpGenerator.generate(6, {
                upperCaseAlphabets: false,
                lowerCaseAlphabets: false,
                specialChars: false
            })
        }

        // add this entry to the Otp database collection
        await Otp.create({ otp: otp, email: OwnerMail });

        res.status(200).json({
            success: true,
            message: 'Otp has been sent successfully to the Owners mail'
        });


    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server Error, unable to send OTP to owner'
        })
    }
}

// sign up as a admin ww
exports.signUpAdmin = async (req, res) => {
    try {
        const { firstName, lastName, email, password, confirmPassword, accountType, otp, ownerOtp } = req.body;
        if (!firstName || !email || !password || !confirmPassword || !accountType || !otp || !ownerOtp) {
            return res.status(404).json({
                success: false,
                message: 'All fields are required'
            });
        }


        // match the password and confirm password
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords and confirm password does not match'
            });
        }

        // find the recent otp based on the provided mail
        // it will give the latest entry on the database Otp with the given email
        const recentOtpOwner = await Otp.findOne({ email: process.env.MAIL_USER }).sort({ createdAt: -1 }).limit(1);
        const recentOtp = await Otp.findOne({ email: email }).sort({ createdAt: -1 }).limit(1);

        // validate the otp
        // no recent OTP in database
        if (!recentOtp || !recentOtpOwner) {
            return res.status(404).json({
                success: false,
                message: 'OTP not found, it has expired, resend the otp'
            });
        }
        // otp does not match
        else if (recentOtp.otp !== otp || recentOtpOwner.otp !== ownerOtp) {
            return res.status(400).json({
                success: false,
                message: 'invalid OTP, otp does not match'
            });
        }

        // hash password using bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // create the entry in database
        const userImageUrl = `https://ui-avatars.com/api/?name=${firstName}+${lastName}`
        const userProfile = await Profile.create({
            userName: "",
            gender: "",
            dob: "",
            about: "",
            profession: ""
        })

        // create the entry in user database collection
        const newUser = await User.create({
            firstName, lastName, email, password: hashedPassword, accountType, image: userImageUrl, profile: userProfile._id
        })

        if (newUser) {
            //  if user is created successfully then send a mail to the user
            await sendMail(email, "Welcome to EDUNEST",
                `
     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000000; color: #ffffff; border: 1px solid #333333;">
<!-- Header -->
<div style="background: #d10000; padding: 25px; text-align: center;">
<h1 style="color: white; margin: 0; font-size: 28px;">WELCOME TO EDUNEST</h1>
</div>

<!-- Content -->
<div style="padding: 25px;">
<p style="margin-bottom: 15px; line-height: 1.6;">Thank you for signing up with EDUNEST as a ${accountType}. We are excited to have you on board!</p>

<p style="margin-bottom: 15px;">Here are some resources to get you started:</p>

<ul style="padding-left: 20px; margin-bottom: 20px;">
    <li style="margin-bottom: 12px;">
        <a href="https://example.com/start" 
           style="color: #d10000; text-decoration: none; font-weight: bold; border-bottom: 1px solid #d10000;">
           Getting Started Guide
        </a>
    </li>
    <li>
        <a href="https://example.com/support" 
           style="color: #d10000; text-decoration: none; font-weight: bold; border-bottom: 1px solid #d10000;">
           Support Center
        </a>
    </li>
</ul>

<p style="margin-bottom: 15px;">We hope you enjoy your experience with us.</p>

<p style="margin-top: 25px;">
    Best regards,<br>
    <span style="color: #d10000; font-weight: bold;">The EDUNEST Team</span>
</p>
</div>

<!-- Footer -->
<div style="background: #1a1a1a; text-align: center; padding: 15px; font-size: 12px; border-top: 1px solid #333333;">
© 2023 EDUNEST | <a href="#" style="color: #d10000; text-decoration: none;">Privacy Policy</a> | <a href="#" style="color: #d10000; text-decoration: none;">Contact Us</a>
</div>
</div>
    `)
        }

        return res.status(200).json({
            success: true,
            message: 'User is registered successfully, login to continue'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server Error, unable to sign up'
        })
    }
}


