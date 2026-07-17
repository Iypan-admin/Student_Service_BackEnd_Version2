const supabase = require('./config/supabaseClient');

async function check() {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, role, center_id')
      .eq('role', 'center');
    
    if (error) {
      console.error("Error:", error.message);
    } else {
      console.log("Center Admin Users Mapping:", JSON.stringify(users, null, 2));
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

check();
