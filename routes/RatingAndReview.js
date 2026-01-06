const express = require('express');
const {
    addRatingAndReview,
    deleteReview,
    updateReview,
    getTop10CommentsByCourse,
    getReviewByCourseAndUser,
    getTopTenReviews
} = require('../controllers/RatingAndReview');

const { isAuthenticated, isStudent } = require('../middlewares/auth');

const ratingRoutes = express.Router();

// POST: Add a new review (requires login)
ratingRoutes.post('/add', isAuthenticated, isStudent, addRatingAndReview);

// DELETE: Delete a review by reviewId and courseId (requires login)
ratingRoutes.delete('/delete/:reviewId/:courseId', isAuthenticated, isStudent, deleteReview);

// PUT: Update a review by reviewId (requires login)
ratingRoutes.put('/update/:reviewId', isAuthenticated, isStudent, updateReview);

// GET: Top 10 reviews for a course based on rating
ratingRoutes.get('/top-comments/:courseId', getTop10CommentsByCourse);

// GET: Get a review by courseId and userId
ratingRoutes.get('/review/:courseId/', isAuthenticated, isStudent, getReviewByCourseAndUser);

// GET: Get top 10 reviews overall
ratingRoutes.get('/top-reviews', getTopTenReviews);


module.exports = ratingRoutes;
