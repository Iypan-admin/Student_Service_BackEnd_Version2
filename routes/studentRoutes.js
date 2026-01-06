const express = require('express');
const {
    registerStudent, loginStudent, getStudentDetails,
    updateStudent, deleteStudent, getStates, getCentersByState,
    getAllCenters, forgotPassword, resetPassword
} = require('../controllers/studentController');
const authMiddleware = require('../middlewares/authMiddleware');
const { getEliteCardByRegNo } = require('../controllers/eliteCardController');





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

// ✅ Fixed route path
router.get('/elite-card/:registration_number', getEliteCardByRegNo);


module.exports = router;
