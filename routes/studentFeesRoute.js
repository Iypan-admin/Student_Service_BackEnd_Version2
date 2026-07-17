const express = require('express');
const router = express.Router();
const { getStudentCourseFees, getStudentCourseFeesByEnrollment } = require('../controllers/studentFeesController');

// Original endpoint (works for single enrollment)
router.get('/student-course-fees/:registrationNumber', getStudentCourseFees);

// New endpoint (works for multiple enrollments - specific enrollment)
router.get('/student-course-fees/:registrationNumber/:enrollmentId', getStudentCourseFeesByEnrollment);

module.exports = router;
