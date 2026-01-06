const express = require("express");
const {
    makePayment,
    getTransactions,
    razorpayWebhook,
} = require("../controllers/paymentController");

const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// ✅ Student Makes a Manual Payment
router.post("/", authMiddleware, makePayment);

// ✅ Get All Transactions of a Student
router.get("/", authMiddleware, getTransactions);

// ✅ Razorpay Webhook (No Auth, only signature verification)
router.post(
    "/razorpay-webhook",
    express.raw({ type: "application/json" }),
    razorpayWebhook
);

module.exports = router;
