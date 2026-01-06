// routes/webhookpaymentRoutes.js
const express = require("express");
const router = express.Router();
const { razorpayWebhook } = require("../controllers/paymentWebhookController");

router.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    razorpayWebhook
);

module.exports = router;
