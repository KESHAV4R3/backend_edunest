// in this file we will write all the routes that are related to the dashboard

const express = require('express');
const dashboard = express.Router();

// import the controllers
const { getCartCourse, removeCourseFromCart, removeAllCourseFromCart, getAllEarnings, insertCartCourse, updateProfile, getAllStudents, getAllCoursesInDataBase, getAllCourses, sendmailToUserByAdmin, deleteAccountByAdmin, getAllInstructors,getStudentAnalytics, sendmailToAdmin, deleteAccount, getUserDetails } = require('../controllers/dashboard');

// import the middleware
const { isAuthenticated, isAdmin, isInstructor, isStudent } = require('../middlewares/auth');

dashboard.put('/updateProfile', isAuthenticated, updateProfile);
dashboard.get('/getAllStudents', isAuthenticated, isAdmin, getAllStudents);
dashboard.get('/getAllInstructors', isAuthenticated, isAdmin, getAllInstructors);
dashboard.get('/getAllCourses', isAuthenticated, getAllCourses);
dashboard.get('/getAllEarnings', isAuthenticated, isInstructor, getAllEarnings);
dashboard.get('/getAllCoursesInDataBase', isAuthenticated, isAdmin, getAllCoursesInDataBase);
dashboard.delete('/deleteAccount', isAuthenticated, deleteAccount);
dashboard.delete('/deleteAccountByAdmin/:id', isAuthenticated, isAdmin, deleteAccountByAdmin);
dashboard.get('/getUserDetails', isAuthenticated, getUserDetails);
dashboard.get('/getCartCourse', isAuthenticated, isStudent, getCartCourse);
dashboard.put('/insertCartCourse/:courseId', isAuthenticated, isStudent, insertCartCourse);
dashboard.patch('/removeCourseFromCart/:courseId', isAuthenticated, isStudent, removeCourseFromCart);
dashboard.delete('/removeAllCourseFromCart', isAuthenticated, isStudent, removeAllCourseFromCart);
dashboard.post('/sendmailToAdmin', sendmailToAdmin);
dashboard.post('/sendmailToUser', isAuthenticated, isAdmin, sendmailToUserByAdmin);
dashboard.get('/getStudentAnalytics', isAuthenticated, isStudent, getStudentAnalytics);

module.exports = dashboard;
