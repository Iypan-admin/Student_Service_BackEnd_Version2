const express = require('express');
const router = express.Router();
const {
  getUpcomingEventsForAnnouncements,
  getEventsByDateRangeForAnnouncements,
  testAnnouncementDatabaseConnection
} = require('../controllers/announcementController');

// ===========================================
// STUDENT ANNOUNCEMENTS ROUTES
// ===========================================

// Get upcoming events for announcements (public access)
router.get('/upcoming', getUpcomingEventsForAnnouncements);

// Get events by date range for announcements
router.get('/range', getEventsByDateRangeForAnnouncements);

// Test database connection for announcements
router.get('/test/database', testAnnouncementDatabaseConnection);

module.exports = router;







