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

            if (enrollmentError) {
                console.error('❌ Error fetching enrollment:', enrollmentError);
                return res.status(500).json({ 
                    success: false, 
                    message: "Failed to fetch enrollment details. Please try again." 
                });
            }

            if (!enrollment) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Enrollment not found" 
                });
            }

            batch_id = enrollment.batch;
            
            if (!batch_id) {
                console.error('⚠️ Enrollment found but batch_id is null:', enrollment_id);
                return res.status(400).json({ 
                    success: false, 
                    message: "Enrollment does not have an associated batch" 
                });
            }
            
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
            console.error('❌ Error inserting payment lock:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint,
                insertData
            });
            
            // Handle specific database errors
            if (error.code === '23505') { // Unique constraint violation
                return res.status(409).json({ 
                    success: false, 
                    message: batch_id 
                        ? "Payment mode already locked for this batch" 
                        : "Payment mode already locked" 
                });
            }
            
            if (error.code === '23503') { // Foreign key constraint violation
                return res.status(400).json({ 
                    success: false, 
                    message: "Invalid batch_id. Batch does not exist." 
                });
            }
            
            if (error.code === '42P01') { // Table does not exist
                console.error('❌ CRITICAL: student_payment_lock table does not exist!');
                return res.status(500).json({ 
                    success: false, 
                    message: "Database configuration error. Please contact support." 
                });
            }
            
            // Generic error response
            return res.status(500).json({ 
                success: false, 
                message: error.message || "Failed to lock payment type. Please try again." 
            });
        }

        console.log('✅ Payment lock created:', data);
        return res.status(200).json({ success: true, data: data[0] });

    } catch (err) {
        console.error('❌ Lock payment mode error:', err);
        console.error('Error stack:', err.stack);
        return res.status(500).json({ 
            success: false, 
            message: err.message || "Internal server error. Please try again later." 
        });
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
