const express = require('express');
const router = express.Router();
const { lockPaymentMode, getLockedPaymentMode } = require('../controllers/paymentLockController');

// POST /api/payment-lock
router.post('/', lockPaymentMode);

// GET /api/payment-lock/:register_number
router.get('/:register_number', getLockedPaymentMode);

module.exports = router;
