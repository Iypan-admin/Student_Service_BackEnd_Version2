const express = require("express");
const {
    makePayment,
    getTransactions,
} = require("../controllers/paymentController");

const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// ✅ Student Makes a Manual Payment
router.post("/", authMiddleware, makePayment);

// ✅ Get All Transactions of a Student
router.get("/", authMiddleware, getTransactions);

// ✅ Razorpay Webhook (Use /api/razorpay/webhook instead)
// router.post(
//     "/razorpay-webhook",
//     express.raw({ type: "application/json" }),
//     razorpayWebhook
// );

module.exports = router;
