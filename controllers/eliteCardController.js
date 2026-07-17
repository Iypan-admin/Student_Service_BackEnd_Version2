const supabase = require('../config/supabaseClient');

// Fetch elite card by registration number
const getEliteCardByRegNo = async (req, res) => {
    try {
        // Debug logs
        // console.log("✅ Route hit: GET /elite-card/:register_number");
        // console.log("📥 Registration Number:", req.params.registration_number);

        const { registration_number } = req.params;

        // Supabase query
        const { data, error } = await supabase
            .from('student_elite_cards')
            .select('card_type, card_number')
            .eq('register_number', registration_number) // ✅ DB column name = register_number
            .maybeSingle(); // ✅ safer than .single()

        // Error handling
        if (error) {
            console.error("❌ Supabase error:", error.message);
            return res.status(500).json({ success: false, message: 'Database query failed' });
        }

        // No data found
        if (!data) {
            return res.status(404).json({ success: false, message: 'No elite card found' });
        }

        // Success response
        res.status(200).json({ success: true, data });

    } catch (error) {
        // Error response
        console.error('❌ Elite card fetch error:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { getEliteCardByRegNo };
