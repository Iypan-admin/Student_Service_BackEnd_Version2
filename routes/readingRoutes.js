const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const {
    getStudentReading,
    submitReadingAttempt
} = require('../controllers/lsrwController');

const router = express.Router();

// Student routes - Get visible reading materials
router.get('/student/:batch_id', authMiddleware, getStudentReading);

// Student routes - Submit reading quiz attempt
router.post('/attempt', authMiddleware, submitReadingAttempt);

module.exports = router;

















