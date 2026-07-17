const supabase = require('../config/supabaseClient');

// ===========================================
// STUDENT ANNOUNCEMENTS CONTROLLER
// ===========================================

// Get upcoming events for announcements (public access)
const getUpcomingEventsForAnnouncements = async (req, res) => {
  try {
    console.log('📢 Fetching upcoming events for student announcements...');
    
    // Get current date for filtering
    const today = new Date().toISOString().split('T')[0];
    
    // Query upcoming events from academic_events table
    const { data: events, error } = await supabase
      .from('academic_events')
      .select('*')
      .gte('event_start_date', today)
      .eq('status', 'active')
      .order('event_start_date', { ascending: true })
      .limit(10);

    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        error: error.message
      });
    }

    console.log(`✅ Found ${events?.length || 0} upcoming events for announcements`);
    
    res.json({
      success: true,
      data: events || [],
      count: events?.length || 0,
      message: 'Upcoming events fetched successfully'
    });

  } catch (error) {
    console.error('❌ Error fetching upcoming events for announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get events by date range for announcements
const getEventsByDateRangeForAnnouncements = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    console.log(`📅 Fetching events from ${start_date} to ${end_date} for announcements...`);
    
    const { data: events, error } = await supabase
      .from('academic_events')
      .select('*')
      .gte('event_start_date', start_date)
      .lte('event_start_date', end_date)
      .eq('status', 'active')
      .order('event_start_date', { ascending: true });

    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        error: error.message
      });
    }

    console.log(`✅ Found ${events?.length || 0} events in date range for announcements`);
    
    res.json({
      success: true,
      data: events || [],
      count: events?.length || 0,
      message: 'Events fetched successfully'
    });

  } catch (error) {
    console.error('❌ Error fetching events by date range for announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Test database connection for announcements
const testAnnouncementDatabaseConnection = async (req, res) => {
  try {
    console.log('🔍 Testing database connection for announcements...');
    
    const { data, error } = await supabase
      .from('academic_events')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Database connection test failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: error.message
      });
    }

    console.log('✅ Database connection test successful for announcements');
    
    res.json({
      success: true,
      message: 'Database connection successful for announcements',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error testing database connection for announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection test failed',
      error: error.message
    });
  }
};

module.exports = {
  getUpcomingEventsForAnnouncements,
  getEventsByDateRangeForAnnouncements,
  testAnnouncementDatabaseConnection
};







