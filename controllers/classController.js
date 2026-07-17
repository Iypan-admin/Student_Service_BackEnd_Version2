const supabase = require("../config/supabaseClient");

// Helper function to get all batch IDs in a merge group
const getMergedBatchIds = async (batch_id) => {
    try {
        // Check if batch is part of a merge group
        const { data: mergeMember, error: memberError } = await supabase
            .from('batch_merge_members')
            .select('merge_group_id')
            .eq('batch_id', batch_id)
            .single();

        if (memberError || !mergeMember) {
            // Not part of any merge group
            return [batch_id];
        }

        // Get all batch IDs in this merge group
        const { data: allMembers, error: membersError } = await supabase
            .from('batch_merge_members')
            .select('batch_id')
            .eq('merge_group_id', mergeMember.merge_group_id);

        if (membersError || !allMembers) {
            return [batch_id];
        }

        return allMembers.map(member => member.batch_id);
    } catch (error) {
        console.error('Error getting merged batch IDs:', error);
        return [batch_id];
    }
};

// Fetch notes by batch_id (including merged batches)
const getNotesByBatch = async (req, res) => {
    const { batch_id } = req.params;

    try {
        // Get all batch IDs in merge group
        const mergedBatchIds = await getMergedBatchIds(batch_id);

        // Fetch notes from all merged batches
        const { data, error } = await supabase
            .from("notes")
            .select("*")
            .in("batch_id", mergedBatchIds)
            .order("created_at", { ascending: false });

        if (error) {
            return res.status(500).json({ error: "Error fetching notes", details: error.message });
        }

        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: "Error fetching notes", details: error.message });
    }
};

// Fetch GMeets by batch_id (including merged batches) with student attendance
const getGMeetsByBatch = async (req, res) => {
    const { batch_id } = req.params;
    const { student_id } = req.student || {}; // Get student_id from token

    try {
        // Get all batch IDs in merge group
        const mergedBatchIds = await getMergedBatchIds(batch_id);

        // Fetch schedules from all merged batches
        const { data, error } = await supabase
            .from("gmeets")
            .select("*")
            .in("batch_id", mergedBatchIds)
            .order("date", { ascending: true })
            .order("time", { ascending: true });

        if (error) {
            return res.status(500).json({ error: "Error fetching GMeets", details: error.message });
        }

        // Calculate status for each gmeet based on date and time
        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dataWithStatus = (data || []).map(gmeet => {
            let status = 'Scheduled'; // Default status
            
            // If gmeet already has a status field from database, use it (if it's 'Completed' or 'Cancelled')
            if (gmeet.status === 'Completed' || gmeet.status === 'Cancelled') {
                return gmeet;
            }
            
            // Calculate status based on date and time
            if (gmeet.date) {
                const meetDate = new Date(gmeet.date);
                meetDate.setHours(0, 0, 0, 0);
                
                // If date is in the past, it's completed
                if (meetDate < today) {
                    status = 'Completed';
                } 
                // If date is today, check if time has passed
                else if (meetDate.getTime() === today.getTime() && gmeet.time) {
                    try {
                        const [hours, minutes] = gmeet.time.split(':').map(Number);
                        const meetDateTime = new Date(meetDate);
                        meetDateTime.setHours(hours, minutes || 0, 0, 0);
                        
                        if (meetDateTime <= now) {
                            status = 'Completed';
                        }
                    } catch (timeError) {
                        console.error('Error parsing time:', timeError);
                    }
                }
            }
            
            return {
                ...gmeet,
                status: status
            };
        });

        // If student_id is available, fetch student's attendance
        if (student_id && dataWithStatus && dataWithStatus.length > 0) {
            try {
                // Get all attendance_sessions for merged batch IDs
                const { data: attendanceSessions, error: sessionsError } = await supabase
                    .from('attendance_sessions')
                    .select('id, batch_id, session_date')
                    .in('batch_id', mergedBatchIds);

                if (!sessionsError && attendanceSessions && attendanceSessions.length > 0) {
                    const sessionIds = attendanceSessions.map(s => s.id);
                    
                    // Get attendance records for this student
                    const { data: attendanceRecords, error: recordsError } = await supabase
                        .from('attendance_records')
                        .select('id, session_id, status')
                        .eq('student_id', student_id)
                        .in('session_id', sessionIds);

                    if (!recordsError && attendanceRecords) {
                        // Create maps for quick lookup
                        const sessionMap = {};
                        attendanceSessions.forEach(session => {
                            const dateKey = session.session_date; // YYYY-MM-DD format
                            if (!sessionMap[dateKey]) {
                                sessionMap[dateKey] = [];
                            }
                            sessionMap[dateKey].push(session);
                        });

                        const recordsMap = {};
                        attendanceRecords.forEach(record => {
                            recordsMap[record.session_id] = record;
                        });

                        // Attach student's attendance to each gmeet
                        const gmeetsWithAttendance = dataWithStatus.map(gmeet => {
                            if (gmeet.date && sessionMap[gmeet.date]) {
                                // Find matching session for this batch
                                const matchedSession = sessionMap[gmeet.date].find(
                                    s => mergedBatchIds.includes(s.batch_id)
                                );

                                if (matchedSession && recordsMap[matchedSession.id]) {
                                    const record = recordsMap[matchedSession.id];
                                    return {
                                        ...gmeet,
                                        myAttendance: {
                                            marked: true,
                                            status: record.status // 'present', 'absent', 'late', 'excused'
                                        }
                                    };
                                }
                            }
                            // No attendance record found for this gmeet
                            return {
                                ...gmeet,
                                myAttendance: {
                                    marked: false
                                }
                            };
                        });

                        return res.status(200).json(gmeetsWithAttendance);
                    }
                }
            } catch (attendanceError) {
                console.error('Error fetching attendance for student:', attendanceError);
                // If error, return gmeets without attendance data
            }
        }

        // Return gmeets with calculated status if student_id not available or error occurred
        return res.status(200).json(dataWithStatus);
    } catch (error) {
        return res.status(500).json({ error: "Error fetching GMeets", details: error.message });
    }
};

module.exports = { getNotesByBatch, getGMeetsByBatch };