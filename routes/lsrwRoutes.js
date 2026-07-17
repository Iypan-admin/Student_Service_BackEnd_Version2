const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const {
    getStudentLSRW,
    submitStudentAnswers,
    getStudentReview
} = require('../controllers/lsrwController');

const router = express.Router();

// Student routes - Get visible LSRW content
router.get('/student/:batchId', authMiddleware, getStudentLSRW);

// Student routes - Submit answers
router.post('/submit', authMiddleware, submitStudentAnswers);

// Student routes - Get quiz review
router.get('/review/:lsrwId', authMiddleware, getStudentReview);

module.exports = router;

