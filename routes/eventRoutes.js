const express = require('express');
const router = express.Router();
const {
  getUpcomingEvents,
  getEventsByDateRange,
  testDatabaseConnection
} = require('../controllers/eventController');

// GET /api/events/upcoming - Get upcoming events (public access for students)
router.get('/upcoming', getUpcomingEvents);

// GET /api/events/range - Get events by date range (public access for students)
router.get('/range', getEventsByDateRange);

// GET /api/events/test/database - Test database connection
router.get('/test/database', testDatabaseConnection);

module.exports = router;







