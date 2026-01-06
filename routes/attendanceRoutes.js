const express = require('express');
const router = express.Router();
const { getStudentAttendance, getStudentBatchAttendance } = require('../controllers/attendanceController');
const authMiddleware = require('../middlewares/authMiddleware');

// Get student's attendance for all enrolled batches
router.get('/student', authMiddleware, getStudentAttendance);

// Get student's attendance for a specific batch
router.get('/student/batch/:batchId', authMiddleware, getStudentBatchAttendance);

module.exports = router;






