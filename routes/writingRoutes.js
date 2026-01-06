const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const multer = require('multer');
const {
    getStudentWriting,
    uploadWritingImage,
    submitWritingTask
} = require('../controllers/lsrwController');

const router = express.Router();

// Configure multer for image uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Accept image files (JPEG, PNG)
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg' || file.mimetype === 'image/png') {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG or PNG image files are allowed'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Student routes - Get visible writing tasks
router.get('/student/:batch_id', authMiddleware, getStudentWriting);

// Student routes - Upload image file
router.post('/upload-image', authMiddleware, upload.single('image'), uploadWritingImage);

// Student routes - Submit writing task
router.post('/submit', authMiddleware, submitWritingTask);

module.exports = router;










