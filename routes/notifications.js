// file: routes/notifications.js
const express = require("express");
const router = express.Router();
const { getNotifications, markAsRead } = require("../controllers/notificationsController");
const authMiddleware = require("../middlewares/authMiddleware"); // sets req.student

// GET /api/notifications
router.get("/", authMiddleware, getNotifications);
// Mark a notification as read
router.patch("/:id", authMiddleware, markAsRead);

module.exports = router;
