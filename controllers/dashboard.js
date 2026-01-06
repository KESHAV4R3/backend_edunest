// in this controller all the business logic that are related to profile are written

const Profile = require('../models/Profile');
const User = require('../models/User');
const { uploadToCloudinary } = require('../utils/cloudinaryUploader');
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const { deleteFromCloudinary } = require('../utils/cloudinaryDelete');
const { sendMail } = require('../utils/mailSender');
var jwt = require('jsonwebtoken');
const Course = require('../models/Course')
const isProduction = process.env.NODE_ENV === "production";
const CourseProgress = require("../models/courseProgress");
const RatingAndReview = require('../models/RatingAndReview');


// get student analytics 
exports.getStudentAnalytics = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Fetch user and enrolled courses
        // We populate section and subSection to count total videos accurately
        const userDetails = await User.findById(userId)
            .populate({
                path: "course",
                populate: {
                    path: "section",
                    populate: {
                        path: "subSection",
                    },
                },
            })
            .lean();

        if (!userDetails) {
            return res.status(404).json({ success: false, message: "User record missing" });
        }

        const enrolledCourses = (userDetails.course || []).filter(c => c !== null);

        // 2. Process each course for progress
        const analyticsData = await Promise.all(
            enrolledCourses.map(async (course) => {
                
                // Calculate Total Videos in this course
                let totalVideos = 0;
                if (course.section) {
                    course.section.forEach((sec) => {
                        if (sec.subSection) totalVideos += sec.subSection.length;
                    });
                }

                // Get progress for this student and this course
                // Use 'courseId' to match your reference code
                const progressDetails = await CourseProgress.findOne({
                    courseId: course._id, 
                    userId: userId,
                });

                const completedVideos = progressDetails?.completedVideos?.length || 0;
                
                // Calculate percentage
                const progressPercentage = totalVideos === 0 
                    ? 0 
                    : Math.round((completedVideos / totalVideos) * 100);

                // Fetch the review left by this student
                const userReview = await RatingAndReview.findOne({
                    course: course._id,
                    user: userId,
                }).select("rating review createdAt");

                return {
                    courseId: course._id,
                    courseName: course.name,
                    thumbnail: course.thumbnail,
                    totalVideos,
                    completedVideos,
                    progressPercentage,
                    review: userReview || null,
                };
            })
        );

        // 3. Global Dashboard Calculations
        const totalEnrolled = analyticsData.length;
        
        // Overall progress: Sum of all completed videos / Sum of all total videos
        const globalCompleted = analyticsData.reduce((acc, curr) => acc + curr.completedVideos, 0);
        const globalTotal = analyticsData.reduce((acc, curr) => acc + curr.totalVideos, 0);
        
        const overallProgress = globalTotal === 0 ? 0 : Math.round((globalCompleted / globalTotal) * 100);

        return res.status(200).json({
            success: true,
            analytics: {
                totalEnrolled,
                overallProgress,
                courses: analyticsData,
                totalModulesCompleted: globalCompleted
            },
        });
    } catch (error) {
        console.error("Student Analytics Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate analytics report",
            error: error.message
        });
    }
};


// get all earnings
exports.getAllEarnings = async (req, res) => {
    try {
        const userId = req.user.id;
        const instructor = await User.findById(userId)
            .populate({
                path: "earnings.course",
                select: "name price thumbnail createdAt description", 
            })
            .lean();

        if (!instructor) {
            return res.status(404).json({ success: false, message: "Instructor not found" });
        }

        // 1. Filter out courses missing Name, Thumbnail, or Data
        const validEarnings = (instructor.earnings || []).filter(item => 
            item.course && 
            item.course.name && 
            item.course.thumbnail
        );

        // 2. Analytical Calculations
        let totalOverallRevenue = 0;
        let totalOverallStudents = 0;
        
        // Yield Rate Calculation: (Actual Students / Target Benchmark of 50) * 100
        const enrollmentTarget = 50; 

        const processedCourses = validEarnings.map(item => {
            const revenue = (item.course?.price || 0) * (item.studentEnrolled || 0);
            totalOverallRevenue += revenue;
            totalOverallStudents += item.studentEnrolled;

            return {
                id: item.course._id,
                name: item.course.name,
                thumbnail: item.course.thumbnail,
                price: item.course.price,
                students: item.studentEnrolled,
                revenue: revenue,
                createdAt: item.course.createdAt,
                // Yield rate logic: Percentage of reaching the target
                yieldRate: Math.min(Math.round((item.studentEnrolled / enrollmentTarget) * 100), 100)
            };
        });

        // 3. Find Last Course Created (Latest Date)
        const lastCourseCreated = processedCourses.length > 0 
            ? processedCourses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] 
            : null;

        return res.status(200).json({
            success: true,
            analytics: {
                totalOverallRevenue,
                totalOverallStudents,
                totalLiveCourses: processedCourses.length,
                lastCourse: lastCourseCreated,
                courses: processedCourses
            }
        });
    } catch (error) {
        console.error("Dashboard Analytics Error:", error);
        return res.status(500).json({ success: false, message: "Failed to generate dashboard data" });
    }
};

// update profile  ww
exports.updateProfile = async (req, res) => {

    // in this i can use patch instead so that i am able to change only the modified data not all 

    try {

        // fetch the data from the req.body
        const {
            firstName,
            lastName,
            userName,
            gender,
            dob,
            about, profession } = req.body

        console.log("updateProfile Request Body:", req.body);
        console.log("updateProfile Request Files:", req.files);

        const userId = req.user.id;
        const profilePicture = req.files ? req.files.profilePicture : null;

        // validate the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            })
        }

        // not working
        // delete the existing profile picture from the cloudinary id it exist
        // if (user.image.includes("cloudinary.com")) {
        //     deleteFromCloudinary(user.image);
        // }

        // upload the profile picture to the cloudinary
        let url = null;
        if (profilePicture) {
            const profilePictureUrl = await uploadToCloudinary(profilePicture, "CLOUDINARY_PROFILE_FOLDER", 10);
            user.image = profilePictureUrl.secure_url;
            url = profilePictureUrl.secure_url;
        }

        const userProfile = await Profile.findById(user.profile);
        // update the profile
        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        userProfile.userName = userName || userProfile.userName;
        userProfile.gender = gender || userProfile.gender;
        userProfile.dob = dob || userProfile.dob;
        userProfile.about = about || userProfile.about;
        userProfile.profession = profession || userProfile.profession;

        await userProfile.save();
        await user.save();

        // since the profile has been updated , so we need to update the token
        const payload = {
            name: user.firstName + ' ' + user.lastName,
            email: user.email,
            accountType: user.accountType,
            id: user._id,
            image: user.image
        }
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' });

        // return cookie as a response
        return res.status(200).cookie('token', token, {
            expires: new Date(Date.now() + 5 * 60 * 60 * 1000), // the token will get expire after 5 hours
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "None" : "Lax",
            // secure: true,
            // sameSite: 'Strict',
            path: '/',
        }).json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                name: user.firstName + " " + user.lastName,
                email: user.email,
                accountType: user.accountType,
                id: user._id,
                image: user.image
            },
            personalData: {
                firstName: user.firstName,
                lastName: user.lastName,
                gender: userProfile.gender,
                dob: userProfile.dob,
                about: userProfile.about,
                profession: userProfile.profession,
                userName: userProfile.userName
            }
        })

    } catch (error) {
        
        return res.status(500).json({
            success: false,
            message: 'Internal server error, unable to update profile',
            error: error.message
        })
    }
}

// delete account  ww
exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            })
        }

        // Delete the profile picture from Cloudinary if it exists
        if (user?.image.includes("cloudinary.com")) {
            deleteFromCloudinary(user.image);
        }

        // delete the profile
        const profileId = user.profile;
        await Profile.findByIdAndDelete(profileId);

        return res.status(200).json({
            success: true,
            message: 'Account deleted successfully'
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error, unable to delete account',
            error: error.message
        })
    }
}

//delete by admin ww
exports.deleteAccountByAdmin = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            })
        }

        // Delete the profile picture from Cloudinary if it exists
        if (user?.image.includes("cloudinary.com")) {
            deleteFromCloudinary(user.image);
        }

        // delete the profile
        const profileId = user.profile;
        await Profile.findByIdAndDelete(profileId);

        return res.status(200).json({
            success: true,
            message: 'Account deleted successfully'
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error, unable to delete account',
            error: error.message
        })
    }
}

// get user details ww
exports.getUserDetails = async (req, res) => {
    try {

        // fetch the data from the req.body
        const userId = req.user.id;
        const user = await User.findById(userId)
            .populate({ path: "profile" })
            .populate({ path: "course", select: "name description thumbnail" })
            .lean()
            .exec();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            })
        }

        return res.status(200).json({
            success: true,
            message: 'User details fetched successfully',
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                gender: user.profile.gender,
                dob: user.profile.dob,
                about: user.profile.about,
                profession: user.profile.profession,
                userName: user.profile.userName,
                course: user.course,
                role: user.accountType
            }
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error, unable to get user details',
            error: error.message
        })
    }
}

// get All Students ww
exports.getAllStudents = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const total = await User.countDocuments({ accountType: "Student" });
        const totalPages = Math.ceil(total / limit);
        const isLastPage = page >= totalPages;

        const students = await User.find(
            { accountType: "Student" },
            "firstName lastName image email"
        )
            .populate({ path: "profile" })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec();

        if (students.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No students found'
            });
        }

        return res.json({
            success: true,
            message: 'Students fetched successfully',
            data: {
                students,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1,
                    isLastPage: isLastPage  // Added this line
                }
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error, unable to get students',
            error: error.message
        });
    }
};

// get All Instructor ww
exports.getAllInstructors = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const total = await User.countDocuments({ accountType: "Instructor" });
        const totalPages = Math.ceil(total / limit);
        const isLastPage = page >= totalPages;

        const instructors = await User.find(
            { accountType: "Instructor" },
            "firstName lastName image email"
        )
            .populate({ path: "profile" })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec();

        if (instructors.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No instructors found'
            });
        }

        return res.json({
            success: true,
            message: 'Instructors fetched successfully',
            data: {
                instructors,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1,
                    isLastPage: isLastPage
                }
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error, unable to get instructors',
            error: error.message
        });
    }
}

// get all courses of that user to display in dashboard ww
exports.getAllCourses = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // First get the user's courses count
        const user = await User.findById(userId).select("course");
        const total = user?.course?.length || 0;
        const totalPages = Math.ceil(total / limit);
        const isLastPage = page >= totalPages;

        // Get paginated courses
        const userWithCourses = await User.findById(userId)
            .select("course")
            .populate({ 
                path: "course", 
                select: "name description language price thumbnail averageRating",
                options: {
                    skip: skip,
                    limit: limit
                }
            })
            .lean();

        if (!userWithCourses || !userWithCourses.course || userWithCourses.course.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No courses found',
                data: {
                    courses: [],
                    pagination: {
                        currentPage: page,
                        totalPages: 0,
                        totalItems: 0,
                        itemsPerPage: limit,
                        hasNextPage: false,
                        hasPreviousPage: false,
                        isLastPage: true
                    }
                }
            });
        }

        return res.json({
            success: true,
            message: 'Courses fetched successfully',
            data: {
                courses: userWithCourses.course,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1,
                    isLastPage
                }
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error, unable to get courses',
            error: error.message
        });
    }
}

// get all courses that are available in the database ww
exports.getAllCoursesInDataBase = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Get total count first
        const total = await Course.countDocuments({});
        const totalPages = Math.ceil(total / limit);
        const isLastPage = page >= totalPages;

        const allCourses = await Course.find({})
            .select("name instructor reviews description language whatYouWillLearn price thumbnail averageRating")
            .populate({ path: "instructor", select: "firstName lastName image" })
            .populate({ path: "reviews", select: "rating review" })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec();

        if (!allCourses || allCourses.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No courses found",
                data: {
                    courses: [],
                    pagination: {
                        currentPage: page,
                        totalPages: 0,
                        totalItems: 0,
                        itemsPerPage: limit,
                        hasNextPage: false,
                        hasPreviousPage: false,
                        isLastPage: true
                    }
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: "Courses fetched successfully",
            data: {
                courses: allCourses,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1,
                    isLastPage
                }
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error in getting courses",
            error: error.message
        });
    }
}

// send mail to the adim ww
exports.sendmailToAdmin = async (req, res) => {
    try {
        const { firstName, lastName, email, message } = req.body;

        // send mail to owner/admin
        await sendMail(process.env.MAIL_USER, `Mail from ${firstName} ${lastName}`,
            `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 0; border: 1px solid #333; border-radius: 5px; background-color: #000; color: #fff;">
  <!-- Header -->
  <div style="background: #d10000; padding: 20px; border-radius: 5px 5px 0 0; text-align: center;">
    <h2 style="color: #fff; margin: 0; font-size: 24px;">NEW USER MESSAGE</h2>
  </div>

  <!-- Content -->
  <div style="padding: 20px;">
    <p>Dear Admin,</p>
    <p>A user has sent you a message through the <strong style="color: #d10000;">EDUNEST</strong> platform. Please find the message below:</p>

    <!-- Message Content -->
    <div style="color: #d10000; background: #222; padding: 15px; border-radius: 5px; font-size: 16px; white-space: pre-wrap;">
      ${message}
    </div>

    <!-- Sender Email -->
    <p style="margin-top: 20px;">
      <strong style="color: #fff;">Sender Email:</strong>
      <span style="color: #d10000;">${email}</span>
    </p>

    <!-- Reply Button -->
    <div style="text-align: center; margin-top: 20px;">
      <a href="mailto:${email}" style="display: inline-block; padding: 12px 20px; background-color: #d10000; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Reply to User
      </a>
    </div>

    <p style="margin-top: 20px;">Please review the message and respond accordingly.</p>
  </div>

  <!-- Footer -->
  <div style="padding: 15px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #333;">
    Best Regards,<br />
    <span style="color: #d10000; font-weight: bold;">EDUNEST Notification System</span>
  </div>
</div>

            `
        );

        return res.json(
            {
                success: true,
                message: 'Mail sent to admin successfully'
            }
        )
    } catch (error) {
        console.error('Error sending mail to admin:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            response: error.response,
            command: error.command
        });
        return res.status(500).json(
            {
                success: false,
                message: 'Failed to send mail to admin',
                errorDetails: {
                    message: error.message,
                    code: error.code,
                    response: error.response,
                    command: error.command,
                    stack: error.stack
                }
            }
        )
    }
}

// send mail by admin to user ww
exports.sendmailToUserByAdmin = async (req, res) => {
    try {
        const { name, email, message } = req.body;
        console.log(req.body)

        // send mail to owner/admin
        await sendMail(email, `Mail from Edunest Admin`,
            `
           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 0; border: 1px solid #333; border-radius: 5px; background-color: #000; color: #fff;">

  <!-- Header -->
  <div style="background: #d10000; padding: 20px; border-radius: 5px 5px 0 0; text-align: center;">
    <h2 style="color: #fff; margin: 0; font-size: 24px;">MESSAGE FROM EDUNEST ADMIN</h2>
  </div>

  <!-- Content -->
  <div style="padding: 20px;">
    <p>Dear <strong style="color: #d10000;">${name}</strong>,</p>

    <p>We hope you're doing well. Below is a message from the <strong style="color: #d10000;">EDUNEST</strong> admin </p>

    <!-- Admin Message -->
    <div style="color: #d10000; background: #222; padding: 15px; border-radius: 5px; font-size: 16px; white-space: pre-wrap; margin-top: 15px;">
      ${message}
    </div>

    <p style="margin-top: 20px;">If you have any further questions or concerns, feel free to reply to this email directly.</p>

    <!-- Footer Message -->
    <p style="margin-top: 20px;">Thank you for being a part of the <strong style="color: #d10000;">EDUNEST</strong> community.</p>
  </div>

  <!-- Footer -->
  <div style="padding: 15px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #333;">
    Warm Regards,<br />
    <span style="color: #d10000; font-weight: bold;">EDUNEST Admin Team</span>
  </div>
</div>
           `
        );
        return res.json(
            {
                success: true,
                message: 'Mail sent to user successfully'
            }
        )
    } catch (error) {
        console.error('Error sending mail to user by admin:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            response: error.response,
            command: error.command
        });
        return res.status(500).json(
            {
                success: false,
                message: 'Failed to send mail to user',
                errorDetails: {
                    message: error.message,
                    code: error.code,
                    response: error.response,
                    command: error.command,
                    stack: error.stack
                }
            }
        )
    }
}

// get cart course ww
exports.getCartCourse = async (req, res) => {
    try {
        const id = req.user.id;
        const courses = await User.findById(id)
            .select("cartCourse")
            .populate({
                path: "cartCourse",
                select: "name description language price thumbnail averageRating"
            })
            .lean()
            .exec();
        if (!courses) {
            return res.status(200).json({
                success: false,
                message: "user not found"
            })
        }
        return res.status(200).json({
            success: true,
            message: "course fetched successfully",
            courses
        })
    } catch (error) {
        return res.status(500).json(
            {
                success: false,
                message: "unable to fetch data , interval server error"
            }
        )
    }
}

// insert courses in cart ww
exports.insertCartCourse = async (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = req.params.courseId;
        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: "course id is required"
            })
        }
        const user = await User.findByIdAndUpdate(userId, { $addToSet: { cartCourse: courseId } });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "user not found"
            })
        }
        return res.status(200).json({
            success: true,
            message: "data inserted into the cart"
        })
    }

    catch (error) {
        return res.status(500).json({
            success: false,
            message: "failed to inserted into the cart, internal server error",
        })
    }
}

// remove from cart ww
exports.removeCourseFromCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = req.params.courseId;

        if (!userId || !courseId) {
            return res.json({
                success: false,
                message: "all data are required"
            })
        }
        const user = await User.findByIdAndUpdate(userId, { $pull: { cartCourse: courseId } });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "user is not present "
            })
        }
        return res.json({
            success: true,
            message: "course removed from cart"
        })
    } catch (error) {
        return res.json({
            success: false,
            message: "internal server error, unable to delete course from cart"
        })
    }
}

// remove all the courses from the cart ww
exports.removeAllCourseFromCart = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required"
            });
        }

        const user = await User.findByIdAndUpdate(userId, { $set: { cartCourse: [] } });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "All courses removed from cart",
            cartCourse: user.cartCourse // Return the empty array for verification
        });
    } catch (error) {
        console.error("Error removing courses from cart:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};