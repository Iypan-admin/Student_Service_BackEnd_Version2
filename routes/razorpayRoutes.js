const express = require("express");
const { createOrder, verifyPayment, manualSyncPayment } = require("../controllers/razorpayController");

const router = express.Router();

router.post("/create-order", createOrder);
router.post("/verify", verifyPayment);
router.post("/manual-sync", manualSyncPayment); // 👈 New Advanced Option

module.exports = router;
