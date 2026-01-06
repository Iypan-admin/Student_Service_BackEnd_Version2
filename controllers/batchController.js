const supabase = require('../config/supabaseClient');

// ✅ Get Batches by Center with Dynamic Seat Calculation and Smart Filtering
const getBatchesByCenter = async (req, res) => {
    const { center, student_id } = req.body; // Extract center ID and optional student_id

    if (!center) {
        return res.status(400).json({ error: 'Center ID is required' });
    }

    // NEW LOGIC: Students should only see Approved batches + their enrolled batches
    
    // Step 1: Fetch ONLY Approved batches from this center (for new enrollment)
    const { data: approvedBatches, error: approvedError } = await supabase
        .from('batches')
        .select(`
            *,
            courses (course_name, type, language, level, mode, program),
            centers (center_id, center_name),
            teachers!batches_teacher_fkey (teacher_id, users (name))
        `)
        .eq('center', center)
        .eq('status', 'Approved'); // Only Approved batches for enrollment

    if (approvedError) {
        return res.status(400).json({ error: approvedError.message });
    }

    // Step 2: If student_id provided, fetch their enrolled batches (any status)
    let enrolledBatchIds = [];
    let enrolledBatches = [];
    
    if (student_id) {
        // Get enrolled batch IDs
        const { data: studentEnrollments, error: enrollError } = await supabase
            .from('enrollment')
            .select('batch')
            .eq('student', student_id);
        
        if (!enrollError && studentEnrollments) {
            enrolledBatchIds = studentEnrollments.map(e => e.batch);
        }

        // Fetch full details of enrolled batches (any status)
        if (enrolledBatchIds.length > 0) {
            const { data: enrolledBatchesData, error: enrolledBatchesError } = await supabase
                .from('batches')
                .select(`
                    *,
                    courses (course_name, type, language, level, mode, program),
                    centers (center_id, center_name),
                    teachers!batches_teacher_fkey (teacher_id, users (name))
                `)
                .in('batch_id', enrolledBatchIds);
            
            if (!enrolledBatchesError && enrolledBatchesData) {
                enrolledBatches = enrolledBatchesData;
            }
        }
    }

    // Step 3: Combine Approved + Enrolled batches and remove duplicates
    const batchesMap = new Map();
    
    // Add approved batches
    if (approvedBatches) {
        approvedBatches.forEach(batch => {
            batchesMap.set(batch.batch_id, batch);
        });
    }
    
    // Add enrolled batches (they will not override approved ones)
    enrolledBatches.forEach(batch => {
        if (!batchesMap.has(batch.batch_id)) {
            batchesMap.set(batch.batch_id, batch);
        }
    });
    
    // Convert back to array
    const batches = Array.from(batchesMap.values());

    // Calculate seat occupancy for each batch
    const batchesWithSeats = await Promise.all(batches.map(async (batch) => {
        // Count enrolled students for this batch
        const { data: enrollments, error: enrollError } = await supabase
            .from('enrollment')
            .select('enrollment_id', { count: 'exact', head: false })
            .eq('batch', batch.batch_id);

        if (enrollError) {
            console.error(`Error counting enrollments for batch ${batch.batch_id}:`, enrollError);
        }

        // Get enrolled count
        const enrolled_students = enrollments ? enrollments.length : 0;

        // Set max_students: Use batch.max_students if it exists, otherwise default to 10
        const max_students = batch.max_students || 10;

        // Check if student is enrolled in this batch
        const is_student_enrolled = enrolledBatchIds.includes(batch.batch_id);

        return {
            ...batch,
            max_students,
            enrolled_students,
            available_seats: max_students - enrolled_students,
            is_full: enrolled_students >= max_students,
            is_student_enrolled,
            time_from: batch.time_from,
            time_to: batch.time_to,
        };
    }));

    // Smart filtering: Show batches that are either:
    // 1. Have available seats (not full), OR
    // 2. Student is already enrolled in them (even if full)
    const visibleBatches = batchesWithSeats.filter(batch => 
        !batch.is_full || batch.is_student_enrolled
    );

    res.json({ 
        batches: visibleBatches,
        total_batches: batches.length,
        available_batches: visibleBatches.filter(b => !b.is_full).length,
        enrolled_batches: visibleBatches.filter(b => b.is_student_enrolled).length,
        full_batches: batches.length - visibleBatches.length
    });
};


// ✅ Enroll Student in Batch with Capacity Check
const enrollStudent = async (req, res) => {
    const { student_id } = req.body; // Decoded from JWT
    const { batch_id } = req.body;

    if (!batch_id) {
        return res.status(400).json({ error: 'Batch ID is required' });
    }

    // Check if student is already enrolled in this batch
    const { data: existingEnrollment, error: checkError } = await supabase
        .from('enrollment')
        .select('enrollment_id')
        .eq('student', student_id)
        .eq('batch', batch_id)
        .single();

    if (existingEnrollment) {
        return res.status(400).json({ error: 'You are already enrolled in this batch' });
    }

    // Get batch details to check capacity and course
    const { data: batch, error: batchError } = await supabase
        .from('batches')
        .select(`
            batch_id, 
            batch_name, 
            max_students,
            courses (course_name)
        `)
        .eq('batch_id', batch_id)
        .single();

    if (batchError || !batch) {
        return res.status(404).json({ error: 'Batch not found' });
    }

    // Check if this is a free course (ON-GR-FL-A1 or ON-FR-FL-A1)
    const courseName = batch.courses?.course_name;
    const freeCourses = ['ON-GR-FL-A1', 'ON-FR-FL-A1'];
    const isFreeCourse = freeCourses.includes(courseName);

    // Count current enrollments
    const { data: enrollments, error: countError } = await supabase
        .from('enrollment')
        .select('enrollment_id', { count: 'exact', head: false })
        .eq('batch', batch_id);

    if (countError) {
        console.error('Error counting enrollments:', countError);
    }

    const currentEnrollments = enrollments ? enrollments.length : 0;
    const maxStudents = batch.max_students || 10;

    // Check if batch is full
    if (currentEnrollments >= maxStudents) {
        return res.status(400).json({ 
            error: 'Batch is full', 
            details: `This batch has reached its maximum capacity of ${maxStudents} students`
        });
    }

    // Proceed with enrollment
    // For free courses (ON-GR-FL-A1, ON-FR-FL-A1): auto-approve with permanent status
    // For other courses: require payment/approval
    const enrollmentData = {
        student: student_id,
        batch: batch_id,
        status: isFreeCourse ? true : false,  // Auto-approve for free courses
        is_permanent: isFreeCourse ? true : false  // Permanent enrollment for free courses
    };

    const { data, error } = await supabase
        .from('enrollment')
        .insert([enrollmentData]);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.json({ 
        message: isFreeCourse 
            ? 'Enrollment successful! You now have access to the course.' 
            : 'Enrollment successful, pending approval',
        batch_name: batch.batch_name,
        seats_remaining: maxStudents - currentEnrollments - 1,
        is_free_course: isFreeCourse
    });
};

// ✅ Get All Batches the Student is Enrolled In
const getEnrolledBatches = async (req, res) => {
    const { student_id } = req.student; // Decoded from JWT

    // Fetch student enrollments with batch details (approved, started, and completed batches)
    let { data: enrollments, error } = await supabase
        .from('enrollment')
        .select(`
            enrollment_id, created_at, student, status, end_date, is_permanent,
            batches!inner (
                batch_id, batch_name, created_at, duration, status, total_sessions,
                courses (
                    course_name, type, language, level, mode, program
                ),
                centers (center_id, center_name), 
                teachers!batches_teacher_fkey (teacher_id, users (name))
            )
        `)
        .eq('student', student_id)
        .in('batches.status', ['Approved', 'Started', 'Completed']);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    // Get current date
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check for expired enrollments and update status if needed
    // EXCLUDE permanent enrollments (final EMI completed - they never expire)
    for (let enrollment of enrollments) {
        if (enrollment.end_date && 
            enrollment.end_date < currentDate && 
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
};

module.exports = { getBatchesByCenter, enrollStudent, getEnrolledBatches };
