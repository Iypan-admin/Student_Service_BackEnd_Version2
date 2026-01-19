const supabase = require('../config/supabaseClient');

// ✅ Get Batches by Center with Dynamic Seat Calculation (OPTIMIZED VERSION)
// This version uses the batch_seat_availability view for better performance
const getBatchesByCenter = async (req, res) => {
    const { center } = req.body; // Extract center ID from request body

    if (!center) {
        return res.status(400).json({ error: 'Center ID is required' });
    }

    try {
        // Fetch batches with seat availability using the view
        const { data: batchAvailability, error: viewError } = await supabase
            .from('batch_seat_availability')
            .select('*');

        if (viewError) {
            throw viewError;
        }

        // Fetch full batch details with relations (approved, started, and completed batches)
        const { data: batches, error: batchError } = await supabase
            .from('batches')
            .select(`
                *,
                courses (course_name, type, language, level, mode, program),
                centers (center_id, center_name),
                teachers (teacher_id, users (name, full_name))
            `)
            .eq('center', center)
            .in('status', ['Approved', 'Started', 'Completed']);

        if (batchError) {
            throw batchError;
        }

        // Merge seat availability data with batch details
        const batchesWithSeats = batches.map(batch => {
            const availability = batchAvailability.find(
                av => av.batch_id === batch.batch_id
            );

            return {
                ...batch,
                max_students: availability?.max_students || batch.max_students || 10,
                enrolled_students: availability?.enrolled_students || 0,
                available_seats: availability?.available_seats || batch.max_students || 10,
                is_full: availability?.is_full || false,
                time_from: batch.time_from,
                time_to: batch.time_to,
            };
        });

        // Filter out full batches - only show batches with available seats
        const availableBatches = batchesWithSeats.filter(batch => !batch.is_full);

        res.json({ 
            batches: availableBatches,
            total_batches: batches.length,
            available_batches: availableBatches.length,
            full_batches: batches.length - availableBatches.length
        });
    } catch (error) {
        console.error('Error fetching batches:', error);
        res.status(500).json({ 
            error: 'Failed to fetch batches', 
            details: error.message 
        });
    }
};


// ✅ Enroll Student in Batch with Capacity Check
const enrollStudent = async (req, res) => {
    const { student_id } = req.body; // Decoded from JWT
    const { batch_id } = req.body;

    if (!batch_id) {
        return res.status(400).json({ error: 'Batch ID is required' });
    }

    try {
        // Check if student is already enrolled in this batch
        const { data: existingEnrollment, error: checkError } = await supabase
            .from('enrollment')
            .select('enrollment_id')
            .eq('student', student_id)
            .eq('batch', batch_id)
            .maybeSingle(); // Use maybeSingle instead of single to avoid error if not found

        if (existingEnrollment) {
            return res.status(400).json({ error: 'You are already enrolled in this batch' });
        }

        // Get batch availability from the view (faster than separate queries)
        const { data: availability, error: availError } = await supabase
            .from('batch_seat_availability')
            .select('*')
            .eq('batch_id', batch_id)
            .single();

        if (availError || !availability) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        // Check if batch is full
        if (availability.is_full || availability.available_seats <= 0) {
            return res.status(400).json({ 
                error: 'Batch is full', 
                details: `This batch has reached its maximum capacity of ${availability.max_students} students`
            });
        }

        // Proceed with enrollment
        const { data, error } = await supabase
            .from('enrollment')
            .insert([{ 
                student: student_id, 
                batch: batch_id, 
                status: false  // Default value - needs admin approval
            }])
            .select();

        if (error) {
            throw error;
        }

        res.json({ 
            message: 'Enrollment successful, pending approval',
            batch_name: availability.batch_name,
            seats_remaining: availability.available_seats - 1
        });
    } catch (error) {
        console.error('Enrollment error:', error);
        res.status(500).json({ 
            error: 'Enrollment failed', 
            details: error.message 
        });
    }
};

// ✅ Get All Batches the Student is Enrolled In
const getEnrolledBatches = async (req, res) => {
    const { student_id } = req.student; // Decoded from JWT

    try {
        // Fetch student enrollments with batch details (approved, started, and completed batches)
        let { data: enrollments, error } = await supabase
            .from('enrollment')
            .select(`
                enrollment_id, created_at, student, status, end_date, is_permanent,
                batches!inner (
                    batch_id, batch_name, created_at, duration, status,
                    courses (
                        course_name, type, language, level, mode, program
                    ),
                    centers (center_id, center_name), 
                    teachers!batches_teacher_fkey (teacher_id, users (name, full_name))
                )
            `)
            .eq('student', student_id)
            .in('batches.status', ['Approved', 'Started', 'Completed']);

        if (error) {
            throw error;
        }

        // Get current date
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Check for expired enrollments and update status if needed
        // EXCLUDE permanent enrollments (final EMI completed - they never expire)
        for (let enrollment of enrollments) {
            if (enrollment.end_date && 
                enrollment.end_date < currentDate && 
                enrollment.status &&
                !enrollment.is_permanent) { // Only expire if not permanent
                // Update status to false
                await supabase
                    .from('enrollment')
                    .update({ status: false })
                    .eq('enrollment_id', enrollment.enrollment_id);

                enrollment.status = false; // Update local object for response
            }
        }

        res.json({ enrollments });
    } catch (error) {
        console.error('Error fetching enrolled batches:', error);
        res.status(500).json({ 
            error: 'Failed to fetch enrollments', 
            details: error.message 
        });
    }
};

module.exports = { getBatchesByCenter, enrollStudent, getEnrolledBatches };

