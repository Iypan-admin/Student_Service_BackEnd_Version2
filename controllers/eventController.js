const supabase = require('../config/supabaseClient');

// Get upcoming events for students (public access)
const getUpcomingEvents = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Use local date to avoid timezone issues
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    let query = supabase
      .from('academic_events')
      .select(`
        id,
        title,
        description,
        event_type,
        event_start_date,
        event_end_date,
        event_start_time,
        event_end_time,
        status
      `)
      .gte('event_start_date', todayStr)
      .eq('status', 'active')
      .order('event_start_date', { ascending: true })
      .order('event_start_time', { ascending: true })
      .limit(parseInt(limit));

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch upcoming events', 
        details: error.message 
      });
    }

    // Filter out expired events (events that have passed their end date)
    const filteredData = (data || []).filter(event => {
      // If event has an end_date, check if it's not expired
      if (event.event_end_date) {
        return event.event_end_date >= todayStr;
      }
      // If no end_date, check if start_date is not expired
      return event.event_start_date >= todayStr;
    });

    res.json({
      success: true,
      data: filteredData,
      count: filteredData.length
    });

  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
};

// Get events by date range for students
const getEventsByDateRange = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ 
        success: false, 
        error: 'Start date and end date are required' 
      });
    }

    let query = supabase
      .from('academic_events')
      .select(`
        id,
        title,
        description,
        event_type,
        event_start_date,
        event_end_date,
        event_start_time,
        event_end_time,
        status
      `)
      .gte('event_start_date', start_date)
      .lte('event_start_date', end_date)
      .eq('status', 'active')
      .order('event_start_date', { ascending: true })
      .order('event_start_time', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch events',
        details: error.message 
      });
    }

    // Filter out expired events (events that have passed their end date)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const filteredData = (data || []).filter(event => {
      // If event has an end_date, check if it's not expired
      if (event.event_end_date) {
        return event.event_end_date >= todayStr;
      }
      // If no end_date, check if start_date is not expired
      return event.event_start_date >= todayStr;
    });

    res.json({
      success: true,
      data: filteredData,
      count: filteredData.length,
      date_range: { start_date, end_date }
    });

  } catch (error) {
    console.error('Get events by date range error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

// Test database connection
const testDatabaseConnection = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('academic_events')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Database connection test failed:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Database connection failed', 
        details: error.message 
      });
    }

    res.json({
      success: true,
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database connection test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database connection test failed', 
      details: error.message 
    });
  }
};

module.exports = {
  getUpcomingEvents,
  getEventsByDateRange,
  testDatabaseConnection
};
