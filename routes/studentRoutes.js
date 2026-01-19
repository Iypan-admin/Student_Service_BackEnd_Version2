const express = require('express');
const multer = require('multer');
const {
    registerStudent, loginStudent, getStudentDetails,
    updateStudent, deleteStudent, getStates, getCentersByState,
    getAllCenters, forgotPassword, resetPassword, uploadProfilePicture,
    deleteProfilePicture
} = require('../controllers/studentController');
const authMiddleware = require('../middlewares/authMiddleware');
const { getEliteCardByRegNo } = require('../controllers/eliteCardController');

// Multer setup for file uploads (memory storage)
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
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});





const router = express.Router();

router.post('/register', registerStudent);
router.post('/login', loginStudent);
router.get('/states', getStates);
router.post('/details', getStudentDetails);
router.get('/centers', getCentersByState);
router.get('/all-centers', getAllCenters);
router.put('/update', authMiddleware, updateStudent);
router.delete('/delete', authMiddleware, deleteStudent);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/upload-profile-picture', authMiddleware, upload.single('file'), uploadProfilePicture);
router.delete('/delete-profile-picture', authMiddleware, deleteProfilePicture);

// ✅ Fixed route path
router.get('/elite-card/:registration_number', getEliteCardByRegNo);


module.exports = router;
