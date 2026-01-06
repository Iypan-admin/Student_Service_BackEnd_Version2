const supabase = require('../config/supabaseClient');

/**
 * Lock the student's payment mode (full or emi)
 */
const lockPaymentMode = async (req, res) => {
    const { register_number, payment_type, enrollment_id } = req.body;

    if (!register_number || !payment_type) {
        return res.status(400).json({ success: false, message: "Missing register_number or payment_type" });
    }

    try {
        let batch_id = null;

        // ✅ If enrollment_id is provided, fetch the batch_id for per-batch locking
        if (enrollment_id) {
            const { data: enrollment, error: enrollmentError } = await supabase
                .from('enrollment')
                .select('batch')
                .eq('enrollment_id', enrollment_id)
                .single();

            if (enrollmentError || !enrollment) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Enrollment not found" 
                });
            }

            batch_id = enrollment.batch;
            console.log('🔒 Locking payment for batch:', batch_id);
        } else {
            console.log('⚠️ No enrollment_id provided - using legacy global lock');
        }

        // Build query based on whether we have batch_id
        let query = supabase
            .from('student_payment_lock')
            .select('*')
            .eq('register_number', register_number);

        if (batch_id) {
            query = query.eq('batch_id', batch_id);
        } else {
            // For backward compatibility: check for global lock (where batch_id IS NULL)
            query = query.is('batch_id', null);
        }

        const { data: existing } = await query.maybeSingle();

        if (existing) {
            return res.status(409).json({ 
                success: false, 
                message: batch_id 
                    ? "Payment mode already locked for this batch" 
                    : "Payment mode already locked" 
            });
        }

        // Insert lock with batch_id if provided
        const insertData = { 
            register_number, 
            payment_type 
        };
        
        if (batch_id) {
            insertData.batch_id = batch_id;
        }

        const { data, error } = await supabase
            .from('student_payment_lock')
            .insert([insertData])
            .select();

        if (error) {
            console.error('Error inserting payment lock:', error);
            return res.status(500).json({ success: false, message: error.message });
        }

        console.log('✅ Payment lock created:', data);
        return res.status(200).json({ success: true, data: data[0] });

    } catch (err) {
        console.error('❌ Lock payment mode error:', err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


/**
 * Get locked payment mode for student - PER BATCH
 * Supports ?enrollment_id=xxx query parameter for per-batch lock check
 */
const getLockedPaymentMode = async (req, res) => {
    const { register_number } = req.params;
    const { enrollment_id } = req.query; // ✅ Get enrollment_id from query param

    try {
        let batch_id = null;

        // ✅ If enrollment_id is provided, fetch the batch_id for per-batch lock check
        if (enrollment_id) {
            const { data: enrollment, error: enrollmentError } = await supabase
                .from('enrollment')
                .select('batch')
                .eq('enrollment_id', enrollment_id)
                .single();

            if (enrollmentError || !enrollment) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Enrollment not found" 
                });
            }

            batch_id = enrollment.batch;
            // console.log('🔍 Checking payment lock for batch:', batch_id);
        } else {
            console.log('🔍 Checking global payment lock (no enrollment_id)');
        }

        // Build query based on whether we have batch_id
        let query = supabase
            .from('student_payment_lock')
            .select('*')
            .eq('register_number', register_number);

        if (batch_id) {
            query = query.eq('batch_id', batch_id);
        } else {
            // For backward compatibility: check for global lock (where batch_id IS NULL)
            query = query.is('batch_id', null);
        }

        const { data, error } = await query.maybeSingle();

        if (error || !data) {
            console.log('🔓 No payment lock found');
            return res.status(404).json({ success: false, message: "Not locked yet" });
        }

        // console.log('✅ Payment lock found:', data);
        return res.status(200).json({ success: true, data });

    } catch (err) {
        console.error('❌ Get payment lock error:', err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    lockPaymentMode,
    getLockedPaymentMode,
};
