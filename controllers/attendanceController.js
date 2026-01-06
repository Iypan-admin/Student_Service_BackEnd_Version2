const supabase = require('../config/supabaseClient');

/**
 * Get student's attendance for all enrolled batches
 */
const getStudentAttendance = async (req, res) => {
    try {
        const { student_id } = req.student; // From JWT token

        if (!student_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Student ID is required' 
            });
        }

        console.log('🔍 Getting attendance for student:', student_id);

        // 1. Get all enrolled batches for the student
        const { data: enrollments, error: enrollmentError } = await supabase
            .from('enrollment')
            .select(`
                batch,
                batches!inner(
                    batch_id,
                    batch_name,
                    status,
                    start_date,
                    end_date
                )
            `)
            .eq('student', student_id)
            .eq('status', true);

        if (enrollmentError) {
            console.error('Error fetching enrollments:', enrollmentError);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to fetch enrolled batches' 
            });
        }

        console.log('🔍 Enrolled batches:', enrollments);

        if (enrollments.length === 0) {
            return res.json({ 
                success: true, 
                data: { 
                    batches: [],
                    message: 'No enrolled batches found' 
                } 
            });
        }

        // 2. Get attendance sessions for all enrolled batches
        const batchIds = enrollments.map(e => e.batch);
        const { data: sessions, error: sessionsError } = await supabase
            .from('attendance_sessions')
            .select(`
                id,
                batch_id,
                session_date,
                notes,
                created_at
            `)
            .in('batch_id', batchIds)
            .order('session_date', { ascending: false });

        if (sessionsError) {
            console.error('Error fetching sessions:', sessionsError);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to fetch attendance sessions' 
            });
        }

        console.log('🔍 Attendance sessions:', sessions);

        // 3. Get attendance records for the student
        const sessionIds = sessions.map(s => s.id);
        const { data: records, error: recordsError } = await supabase
            .from('attendance_records')
            .select(`
                id,
                session_id,
                student_id,
                status,
                marked_at
            `)
            .eq('student_id', student_id)
            .in('session_id', sessionIds);

        if (recordsError) {
            console.error('Error fetching records:', recordsError);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to fetch attendance records' 
            });
        }

        console.log('🔍 Attendance records:', records);

        // 4. Group data by batch
        const batchAttendanceData = enrollments.map(enrollment => {
            const batch = enrollment.batches;
            const batchSessions = sessions.filter(s => s.batch_id === batch.batch_id);
            
            // Calculate attendance summary for this batch
            const batchRecords = records.filter(r => 
                batchSessions.some(s => s.id === r.session_id)
            );

            const totalSessions = batchSessions.length;
            const presentCount = batchRecords.filter(r => r.status === 'present').length;
            const absentCount = batchRecords.filter(r => r.status === 'absent').length;
            const lateCount = batchRecords.filter(r => r.status === 'late').length;
            const excusedCount = batchRecords.filter(r => r.status === 'excused').length;
            
            const attendancePercentage = totalSessions > 0 
                ? Math.round((presentCount / totalSessions) * 100) 
                : 0;

            // Create detailed session records
            const sessionDetails = batchSessions.map(session => {
                const record = batchRecords.find(r => r.session_id === session.id);
                return {
                    session_id: session.id,
                    session_date: session.session_date,
                    status: record ? record.status : 'not_marked',
                    marked_at: record ? record.marked_at : null,
                    notes: session.notes
                };
            });

            return {
                batch_id: batch.batch_id,
                batch_name: batch.batch_name,
                batch_status: batch.status,
                start_date: batch.start_date,
                end_date: batch.end_date,
                total_sessions: totalSessions,
                present_count: presentCount,
                absent_count: absentCount,
                late_count: lateCount,
                excused_count: excusedCount,
                attendance_percentage: attendancePercentage,
                sessions: sessionDetails
            };
        });

        res.json({ 
            success: true, 
            data: { 
                batches: batchAttendanceData 
            } 
        });

    } catch (error) {
        console.error('Server error in getStudentAttendance:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
};

/**
 * Get student's attendance for a specific batch
 */
const getStudentBatchAttendance = async (req, res) => {
    try {
        const { student_id } = req.student; // From JWT token
        const { batchId } = req.params;

        if (!student_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Student ID is required' 
            });
        }

        if (!batchId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Batch ID is required' 
            });
        }

        console.log('🔍 Getting attendance for student:', student_id, 'batch:', batchId);

        // 1. Verify student is enrolled in this batch
        const { data: enrollment, error: enrollmentError } = await supabase
            .from('enrollment')
            .select(`
                batch,
                batches!inner(
                    batch_id,
                    batch_name,
                    status,
                    start_date,
                    end_date
                )
            `)
            .eq('student', student_id)
            .eq('batch', batchId)
            .eq('status', true)
            .single();

        if (enrollmentError || !enrollment) {
            return res.status(404).json({ 
                success: false, 
                error: 'Batch not found or student not enrolled' 
            });
        }

        // 2. Get attendance sessions for this batch
        const { data: sessions, error: sessionsError } = await supabase
            .from('attendance_sessions')
            .select(`
                id,
                session_date,
                notes,
                created_at
            `)
            .eq('batch_id', batchId)
            .order('session_date', { ascending: false });

        if (sessionsError) {
            console.error('Error fetching sessions:', sessionsError);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to fetch attendance sessions' 
            });
        }

        console.log('🔍 Sessions found for batch:', batchId, 'Count:', sessions?.length || 0);
        console.log('🔍 Sessions data:', sessions);

        // 3. Get attendance records for the student
        const sessionIds = sessions.map(s => s.id);
        console.log('🔍 Session IDs for records query:', sessionIds);
        
        const { data: records, error: recordsError } = await supabase
            .from('attendance_records')
            .select(`
                id,
                session_id,
                status,
                marked_at
            `)
            .eq('student_id', student_id)
            .in('session_id', sessionIds);

        if (recordsError) {
            console.error('Error fetching records:', recordsError);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to fetch attendance records' 
            });
        }

        console.log('🔍 Records found for student:', student_id, 'Count:', records?.length || 0);
        console.log('🔍 Records data:', records);

        // 4. Calculate summary
        const totalSessions = sessions.length;
        const presentCount = records.filter(r => r.status === 'present').length;
        const absentCount = records.filter(r => r.status === 'absent').length;
        const lateCount = records.filter(r => r.status === 'late').length;
        const excusedCount = records.filter(r => r.status === 'excused').length;
        
        const attendancePercentage = totalSessions > 0 
            ? Math.round((presentCount / totalSessions) * 100) 
            : 0;

        console.log('🔍 Calculated summary:', {
            totalSessions,
            presentCount,
            absentCount,
            lateCount,
            excusedCount,
            attendancePercentage
        });

        // 5. Create detailed session records
        const sessionDetails = sessions.map(session => {
            const record = records.find(r => r.session_id === session.id);
            return {
                session_id: session.id,
                session_date: session.session_date,
                status: record ? record.status : 'not_marked',
                marked_at: record ? record.marked_at : null,
                notes: session.notes
            };
        });

        res.json({ 
            success: true, 
            data: { 
                batch: enrollment.batches,
                summary: {
                    total_sessions: totalSessions,
                    present_count: presentCount,
                    absent_count: absentCount,
                    late_count: lateCount,
                    excused_count: excusedCount,
                    attendance_percentage: attendancePercentage
                },
                sessions: sessionDetails
            } 
        });

    } catch (error) {
        console.error('Server error in getStudentBatchAttendance:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
};

module.exports = {
    getStudentAttendance,
    getStudentBatchAttendance
};
