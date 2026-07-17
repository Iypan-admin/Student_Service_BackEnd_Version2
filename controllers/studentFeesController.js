const supabase = require('../config/supabaseClient');

const getStudentCourseFees = async (req, res) => {
    const { registrationNumber } = req.params;

    try {
        // Step 1: Get student_id
        const { data: studentData, error: studentError } = await supabase
            .from('students')
            .select('student_id')
            .eq('registration_number', registrationNumber)
            .single();

        if (studentError || !studentData) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const studentId = studentData.student_id;

        // Step 2: Get enrollment -> batch -> course details (including program)
        const { data: feeData, error: feeError } = await supabase
            .from('enrollment')
            .select(`
                batch (
                    batch_id,
                    course_id,
                    course:course_id (
                        course_name,
                        duration,
                        program
                    )
                )
            `)
            .eq('student', studentId)
            .single();

        if (feeError || !feeData) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }

        const course = feeData.batch.course;
        const courseName = course.course_name;
        const duration = course.duration;
        const program = course.program;

        // Step 3: Get total_fees from course_fees table
        const { data: courseFee, error: courseFeeError } = await supabase
            .from('course_fees')
            .select('total_fees')
            .eq('course_name', courseName)
            .single();

        if (courseFeeError || !courseFee) {
            return res.status(404).json({ error: 'Course fees not found' });
        }

        const totalFees = courseFee.total_fees;

        // Step 4: Check if the student has an elite card
        const { data: cardData, error: cardError } = await supabase
            .from('student_elite_cards')
            .select('card_type')
            .eq('register_number', registrationNumber)
            .single();

        let discountPercentage = 0;

        if (cardData && cardData.card_type) {
            const cardType = cardData.card_type;

            // Step 5: Get discount from elite_discounts table based on program
            const { data: discountData, error: discountError } = await supabase
                .from('elite_discounts')
                .select('edupass_discount, scholarpass_discount, infinitypass_discount')
                .eq('program', program)
                .single();

            if (discountData) {
                if (cardType === 'Elite EduPass') {
                    discountPercentage = discountData.edupass_discount;
                } else if (cardType === 'Elite ScholarPass') {
                    discountPercentage = discountData.scholarpass_discount;
                } else if (cardType === 'Infinite Pass') {
                    discountPercentage = discountData.infinitypass_discount;
                }
            }
        }

        // Step 6: Calculate final fees
        const discountAmount = (totalFees * discountPercentage) / 100;
        const finalFees = Math.round(totalFees - discountAmount);

        // Step 7: Respond
        return res.status(200).json({
            registration_number: registrationNumber,
            course_name: courseName,
            total_fees: totalFees,
            discount_percentage: discountPercentage,
            final_fees: finalFees,
            duration: duration
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// ✅ Get Student Course Fees by Specific Enrollment (for multiple enrollments)
const getStudentCourseFeesByEnrollment = async (req, res) => {
    const { registrationNumber, enrollmentId } = req.params;

    try {
        // Step 1: Get student_id
        const { data: studentData, error: studentError } = await supabase
            .from('students')
            .select('student_id')
            .eq('registration_number', registrationNumber)
            .single();

        if (studentError || !studentData) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const studentId = studentData.student_id;

        // Step 2: Get SPECIFIC enrollment by enrollmentId
        const { data: feeData, error: feeError } = await supabase
            .from('enrollment')
            .select(`
                enrollment_id,
                batch (
                    batch_id,
                    course_id,
                    course:course_id (
                        course_name,
                        duration,
                        program
                    )
                )
            `)
            .eq('student', studentId)
            .eq('enrollment_id', enrollmentId)
            .single();

        if (feeError || !feeData) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }

        const course = feeData.batch.course;
        const courseName = course.course_name;
        const duration = course.duration;
        const program = course.program;

        // Step 3: Get total_fees from course_fees table
        const { data: courseFee, error: courseFeeError } = await supabase
            .from('course_fees')
            .select('total_fees')
            .eq('course_name', courseName)
            .single();

        if (courseFeeError || !courseFee) {
            return res.status(404).json({ error: 'Course fees not found' });
        }

        const totalFees = courseFee.total_fees;

        // Step 4: Check if the student has an elite card
        const { data: cardData, error: cardError } = await supabase
            .from('student_elite_cards')
            .select('card_type')
            .eq('register_number', registrationNumber)
            .single();

        let discountPercentage = 0;

        if (cardData && cardData.card_type) {
            const cardType = cardData.card_type;

            // Step 5: Get discount from elite_discounts table based on program
            const { data: discountData, error: discountError } = await supabase
                .from('elite_discounts')
                .select('edupass_discount, scholarpass_discount, infinitypass_discount')
                .eq('program', program)
                .single();

            if (discountData) {
                if (cardType === 'Elite EduPass') {
                    discountPercentage = discountData.edupass_discount;
                } else if (cardType === 'Elite ScholarPass') {
                    discountPercentage = discountData.scholarpass_discount;
                } else if (cardType === 'Infinite Pass') {
                    discountPercentage = discountData.infinitypass_discount;
                }
            }
        }

        // Step 6: Calculate final fees
        const discountAmount = (totalFees * discountPercentage) / 100;
        const finalFees = Math.round(totalFees - discountAmount);

        // Step 7: Respond
        return res.status(200).json({
            registration_number: registrationNumber,
            enrollment_id: enrollmentId,
            course_name: courseName,
            total_fees: totalFees,
            discount_percentage: discountPercentage,
            final_fees: finalFees,
            duration: duration
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getStudentCourseFees,
    getStudentCourseFeesByEnrollment,
};
