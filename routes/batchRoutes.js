const express = require('express');
const { getBatchesByCenter, enrollStudent, getEnrolledBatches } = require('../controllers/batchController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/list', getBatchesByCenter);
router.post('/enroll', enrollStudent);
router.get('/enrolled', authMiddleware, getEnrolledBatches);

module.exports = router;
