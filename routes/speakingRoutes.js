const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const multer = require('multer');
const {
    getStudentSpeaking,
    saveSpeakingAttempt,
    uploadSpeakingAudio
} = require('../controllers/lsrwController');

const router = express.Router();

// Configure multer for audio uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Accept audio files
        if (file.mimetype.startsWith('audio/') || file.mimetype === 'audio/webm') {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'), false);
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Student routes - Get visible speaking materials
router.get('/student/:batch_id', authMiddleware, getStudentSpeaking);

// Student routes - Upload audio file
router.post('/upload-audio', authMiddleware, upload.single('audio'), uploadSpeakingAudio);

// Student routes - Save/Submit speaking attempt
router.post('/attempt', authMiddleware, saveSpeakingAttempt);

module.exports = router;

















