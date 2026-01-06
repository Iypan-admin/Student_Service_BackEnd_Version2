const express = require("express");
const { getNotesByBatch, getGMeetsByBatch } = require("../controllers/classController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// Get all notes for a batch
router.get("/notes/:batch_id", authMiddleware, getNotesByBatch);

// Get all gmeets for a batch
router.get("/gmeets/:batch_id", authMiddleware, getGMeetsByBatch);

module.exports = router;
