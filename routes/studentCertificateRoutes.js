const express = require('express');
const router = express.Router();
const {
    getStudentAssessmentMarks,
    getStudentCertificates,
    getCertificateDetails,
    downloadCertificate,
    getStudentBatches
} = require('../controllers/studentCertificateController');
const authMiddleware = require('../middlewares/authMiddleware');

// Get all batches for a student
router.get('/batches/:studentId', authMiddleware, getStudentBatches);

// Get student's assessment marks for a specific batch
router.get('/marks/:studentId/:batchId', authMiddleware, getStudentAssessmentMarks);

// Get student's certificates for a specific batch
router.get('/certificates/:studentId/:batchId', authMiddleware, getStudentCertificates);

// Get certificate details for view/download
router.get('/certificate/:certificateId', authMiddleware, getCertificateDetails);

// Download certificate
router.get('/download/:certificateId', authMiddleware, downloadCertificate);

module.exports = router;
