const RatingAndReview = require('../models/RatingAndReview');
const Course = require('../models/Course');

// Add a comment

exports.addRatingAndReview = async (req, res) => {
    try {
        const { courseId, review, rating } = req.body;
        const userId = req.user.id;

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ success: false, message: "Course not found" });
        }

        const existing = await RatingAndReview.findOne({ course: courseId, user: userId });
        if (existing) {
            return res.status(400).json({ success: false, message: "You already reviewed this course" });
        }

        const newReview = await RatingAndReview.create({
            course: courseId,
            user: userId,
            review,
            rating
        });

        course.reviews.push(newReview._id);

        const allReviews = await RatingAndReview.find({ course: courseId });
        const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
        const avgRating = totalRating / allReviews.length;

        course.averageRating = avgRating.toFixed(1);
        await course.save();

        res.status(201).json({
            success: true,
            message: "Review added successfully",
            data: newReview
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Error adding review",
            error: err.message
        });
    }
};

//  Delete a comment
exports.deleteReview = async (req, res) => {
    try {
        const userId = req.user.id;
        const { reviewId, courseId } = req.params;

        const review = await RatingAndReview.findById(reviewId);
        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found or unauthorized" });
        }
        await RatingAndReview.findByIdAndDelete(reviewId);

        const course = await Course.findById(courseId);
        if (course) {
            course.reviews = course.reviews.filter(id => id.toString() !== reviewId);

            const remainingReviews = await RatingAndReview.find({ course: courseId });
            const totalRating = remainingReviews.reduce((sum, r) => sum + r.rating, 0);
            const avgRating = remainingReviews.length > 0 ? totalRating / remainingReviews.length : 0;

            course.averageRating = avgRating.toFixed(1);
            await course.save();
        }

        res.status(200).json({ success: true, message: "Review deleted successfully" });

    } catch (err) {
        console.error("Error deleting review:", err);
        res.status(500).json({
            success: false,
            message: "Error deleting review",
            error: err.message
        });
    }
};

// Update a comment
exports.updateReview = async (req, res) => {
    try {
        const userId = req.user.id;
        const { reviewId } = req.params;
        const { review, rating } = req.body;

        const existingReview = await RatingAndReview.findById(reviewId);

        if (!existingReview) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }

        if (existingReview.user.toString() !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized: You can only update your own review" });
        }

        if (review) existingReview.review = review;
        if (rating) existingReview.rating = rating;

        await existingReview.save();

        const courseId = existingReview.course;
        const allReviews = await RatingAndReview.find({ course: courseId });
        const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
        const avgRating = totalRating / allReviews.length;

        await Course.findByIdAndUpdate(courseId, {
            averageRating: avgRating.toFixed(1)
        });

        res.status(200).json({
            success: true,
            message: "Review updated",
            data: existingReview
        });

    } catch (err) {
        console.error("Error updating review:", err);
        res.status(500).json({
            success: false,
            message: "Error updating review",
            error: err.message
        });
    }
};

// get top courses
exports.getTop10CommentsByCourse = async (req, res) => {
    try {
        const { courseId } = req.params;

        const course = await Course.findById(courseId).select("reviews")
            .populate({
                path: "reviews",
                select: "user review rating",
                populate: {
                    path: "user",
                    select: "firstName lastName image"
                }
            })

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            });
        }

        const sortedTop10Reviews = course.reviews
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 10);

        res.status(200).json({
            success: true,
            message: "Top 10 comments fetched successfully",
            data: sortedTop10Reviews,
        });

    } catch (error) {
        console.error("Error fetching top 10 comments:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching top comments",
            error: error.message,
        });
    }
};


//  Get a review by courseId and userId
exports.getReviewByCourseAndUser = async (req, res) => {
    try {

        const userId = req.user.id;
        const { courseId } = req.params;

        const review = await RatingAndReview.findOne({ course: courseId, user: userId })
            .populate("user", "firstName lastName image email");

        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }

        res.status(200).json({ success: true, data: review });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error fetching review", error: err.message });
    }
};

exports.getTopTenReviews = async (req, res) => {
    try {
        // Fetch top 10 reviews
        // Sorting logic: Highest Rating (5 down to 1), then Most Recent (newest first)
        const topReviews = await RatingAndReview.find({})
            .sort({ rating: -1, createdAt: -1 }) 
            .limit(10)
            .populate({
                path: "user",
                select: "firstName lastName image", // Only get necessary public info
            })
            .populate({
                path: "course",
                select: "name", // Optional: show which course the review is for
            })
            .lean()
            .exec();

        if (!topReviews || topReviews.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No reviews found",
                data: []
            });
        }

        return res.status(200).json({
            success: true,
            message: "Top 10 reviews fetched successfully",
            data: topReviews
        });

    } catch (error) {
        console.error("Top Reviews Fetch Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error, unable to fetch top reviews",
            error: error.message
        });
    }
};