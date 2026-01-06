const supabase = require('../config/supabaseClient');
const { supabaseAdmin } = require('../config/supabaseClient');

/**
 * Get LSRW content for student (only visible ones)
 * GET /api/lsrw/student/:batchId
 */
const getStudentLSRW = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { module_type = 'listening' } = req.query;
        const studentId = req.student?.student_id;

        if (!batchId) {
            return res.status(400).json({ error: "Batch ID is required" });
        }

        // Get batch details to find course_id
        const { data: batch, error: batchError } = await supabase
            .from('batches')
            .select('course_id')
            .eq('batch_id', batchId)
            .single();

        if (batchError || !batch) {
            return res.status(404).json({ error: "Batch not found" });
        }

        const batchCourseId = batch.course_id;

        // Get LSRW content visible to students
        const { data: mappings, error: mappingError } = await supabase
            .from('lsrw_batch_mapping')
            .select('*')
            .eq('batch_id', batchId)
            .eq('student_visible', true)
            .order('created_at', { ascending: false });

        if (mappingError) {
            return res.status(500).json({ error: mappingError.message });
        }

        // Get content details for each mapping
        const contentIds = mappings.map(m => m.lsrw_content_id);
        if (contentIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // Filter content by both module_type AND course_id to ensure
        // only content for this batch's course is shown
        // For listening module, order by session_number; for others, order by created_at
        let query = supabase
            .from('lsrw_content')
            .select('*')
            .in('id', contentIds)
            .eq('module_type', module_type)
            .eq('course_id', batchCourseId);

        // Apply ordering
        if (module_type === 'listening') {
            query = query.order('session_number', { ascending: true }); // Session 1, 2, 3...
        } else {
            query = query.order('created_at', { ascending: false });
        }

        const { data: contents, error: contentError } = await query;

        if (contentError) {
            return res.status(500).json({ error: contentError.message });
        }

        // Filter mappings to only include those with matching course content
        const validMappings = mappings.filter(mapping => 
            contents.some(c => c.id === mapping.lsrw_content_id)
        );

        // Merge mappings with content and format response
        const data = validMappings.map(mapping => {
            const content = contents.find(c => c.id === mapping.lsrw_content_id);
            if (!content) return null;

            return {
                lsrw_id: content.id,
                title: content.title,
                instruction: content.instruction,
                audio_url: content.audio_url,
                video_file_path: content.video_file_path || null,
                external_media_url: content.external_media_url || null,
                media_type: content.media_type || null,
                session_number: content.session_number || null,
                questions: content.questions || [],
                max_marks: content.max_marks || 0,
                module_type: content.module_type,
                created_at: content.created_at
            };
        }).filter(item => item !== null);

        // If student_id provided, also get their submission status and attempt status
        if (studentId) {
            const contentIds = data.map(d => d.lsrw_id);
            const { data: submissions } = await supabase
                .from('lsrw_student_answers')
                .select('lsrw_content_id, score, submitted_at, answers, verified, verified_at')
                .eq('student_id', studentId)
                .in('lsrw_content_id', contentIds);

            // Add submission info and attempt status to each item
            const submissionsMap = new Map();
            submissions?.forEach(sub => {
                // Ensure verified is properly handled - check multiple sources
                const rawVerified = sub.verified;
                const hasVerifiedAt = sub.verified_at !== null && sub.verified_at !== undefined;
                const isVerified = rawVerified === true || 
                                  rawVerified === 'true' || 
                                  rawVerified === 1 || 
                                  rawVerified === '1' ||
                                  hasVerifiedAt;
                
                submissionsMap.set(sub.lsrw_content_id, {
                    score: sub.score,
                    submitted_at: sub.submitted_at,
                    answers: sub.answers,
                    verified: Boolean(isVerified), // Explicitly convert to boolean
                    verified_at: sub.verified_at
                });
            });

            data.forEach(item => {
                const submission = submissionsMap.get(item.lsrw_id);
                if (submission) {
                    item.attempted = true;
                    // Ensure verified is a boolean - check for true, 'true', or 1
                    // Also check if verified_at exists (indicates verification happened)
                    const isVerified = submission.verified === true || 
                                      submission.verified === 'true' || 
                                      submission.verified === 1 || 
                                      submission.verified === '1' ||
                                      (submission.verified_at !== null && submission.verified_at !== undefined);
                    item.verified = Boolean(isVerified);
                    // Show score only if verified by tutor, otherwise null
                    // Score should always be available if verified, even if it's 0
                    item.score = isVerified ? (submission.score !== null && submission.score !== undefined ? submission.score : 0) : null;
                    item.studentAnswers = submission.answers;
                    item.submission = {
                        score: isVerified ? (submission.score !== null && submission.score !== undefined ? submission.score : 0) : null,
                        submitted_at: submission.submitted_at,
                        verified: Boolean(isVerified), // Ensure boolean
                        verified_at: submission.verified_at
                    };
                    
                    // Debug logging
                    console.log(`[LSRW Backend] Lesson ${item.title}:`, {
                        rawVerified: submission.verified,
                        rawVerifiedType: typeof submission.verified,
                        verifiedAt: submission.verified_at,
                        isVerified: isVerified,
                        itemVerified: item.verified,
                        submissionVerified: item.submission.verified
                    });
                } else {
                    item.attempted = false;
                    item.verified = false;
                    item.score = null;
                    item.studentAnswers = null;
                    item.submission = null;
                }
            });
        } else {
            // If no student_id, mark all as not attempted
            data.forEach(item => {
                item.attempted = false;
                item.score = null;
                item.studentAnswers = null;
                item.submission = null;
            });
        }

        res.json({
            success: true,
            data: data || []
        });

    } catch (error) {
        console.error('Error fetching student LSRW content:', error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};

/**
 * Submit student answers
 * POST /api/lsrw/submit
 */
const submitStudentAnswers = async (req, res) => {
    try {
        const { student_id, batch_id, lsrw_id, answers } = req.body;
        const studentIdFromToken = req.student?.student_id;

        // Use student_id from token if not provided in body
        const finalStudentId = student_id || studentIdFromToken;

        if (!finalStudentId || !lsrw_id || !batch_id || !answers) {
            return res.status(400).json({ 
                success: false,
                error: "Missing required fields: student_id, batch_id, lsrw_id, and answers are required" 
            });
        }

        // Get LSRW content to calculate score
        const { data: content, error: contentError } = await supabase
            .from('lsrw_content')
            .select('questions, max_marks')
            .eq('id', lsrw_id)
            .single();

        if (contentError || !content) {
            return res.status(404).json({ 
                success: false,
                error: "LSRW content not found" 
            });
        }

        // Calculate score
        let score = 0;
        const questions = content.questions || [];
        
        questions.forEach((q, index) => {
            const questionNumber = q.questionNumber || `Q${index + 1}`;
            const questionKey = questionNumber; // e.g., "Q1"
            const studentAnswer = answers[questionKey] || answers[questionKey.toLowerCase()];
            const correctAnswer = (q.correctAnswer || '').toLowerCase().trim();
            
            if (studentAnswer && studentAnswer.toLowerCase().trim() === correctAnswer) {
                score++;
            }
        });

        // Check if student has already attempted this quiz
        const { data: existingSubmission } = await supabase
            .from('lsrw_student_answers')
            .select('id')
            .eq('student_id', finalStudentId)
            .eq('lsrw_content_id', lsrw_id)
            .eq('batch_id', batch_id)
            .single();

        if (existingSubmission) {
            return res.status(400).json({
                success: false,
                message: "You have already completed this quiz."
            });
        }

        // Calculate marks (if max_marks is set)
        const maxMarks = content.max_marks || questions.length;
        const calculatedMarks = maxMarks > 0 ? Math.round((score / questions.length) * maxMarks) : score;

        // Insert student answer (no upsert - only allow one attempt)
        const { data, error } = await supabase
            .from('lsrw_student_answers')
            .insert({
                student_id: finalStudentId,
                lsrw_content_id: lsrw_id,
                batch_id,
                answers,
                score: calculatedMarks,
                max_marks: maxMarks,
                submitted_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving submission:', error);
            return res.status(500).json({ 
                success: false,
                error: error.message 
            });
        }

        res.json({
            success: true,
            score: calculatedMarks,
            message: "Submitted successfully",
            data: {
                ...data,
                correctAnswers: score,
                totalQuestions: questions.length
            }
        });

    } catch (error) {
        console.error('Error submitting answers:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || "Internal server error" 
        });
    }
};

/**
 * Get student quiz review data
 * GET /api/lsrw/review/:lsrwId
 */
const getStudentReview = async (req, res) => {
    try {
        const { lsrwId } = req.params;
        const studentId = req.student?.student_id;
        const { batchId } = req.query;

        if (!studentId) {
            return res.status(401).json({ 
                success: false,
                error: "Student ID is required" 
            });
        }

        if (!lsrwId) {
            return res.status(400).json({ 
                success: false,
                error: "LSRW ID is required" 
            });
        }

        // Get student submission
        const query = supabase
            .from('lsrw_student_answers')
            .select('*')
            .eq('student_id', studentId)
            .eq('lsrw_content_id', lsrwId);

        if (batchId) {
            query.eq('batch_id', batchId);
        }

        const { data: submission, error: submissionError } = await query.single();
        
        // Only show score if verified
        if (submission && !submission.verified) {
            submission.score = null; // Hide score until verified
        }

        if (submissionError || !submission) {
            return res.status(404).json({ 
                success: false,
                error: "Quiz submission not found" 
            });
        }

        // Get LSRW content with questions
        const { data: content, error: contentError } = await supabase
            .from('lsrw_content')
            .select('*')
            .eq('id', lsrwId)
            .single();

        if (contentError || !content) {
            return res.status(404).json({ 
                success: false,
                error: "LSRW content not found" 
            });
        }

        res.json({
            success: true,
            data: {
                lsrw_id: content.id,
                title: content.title,
                instruction: content.instruction,
                audio_url: content.audio_url,
                video_file_path: content.video_file_path || null,
                external_media_url: content.external_media_url || null,
                media_type: content.media_type || null,
                session_number: content.session_number || null,
                questions: content.questions || [],
                max_marks: content.max_marks || 0,
                studentAnswers: submission.answers,
                score: submission.score,
                submitted_at: submission.submitted_at
            }
        });

    } catch (error) {
        console.error('Error fetching student review:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || "Internal server error" 
        });
    }
};

/**
 * Get Student Speaking Materials (Student View)
 * GET /api/speaking/student/:batch_id
 */
const getStudentSpeaking = async (req, res) => {
    try {
        const { batch_id } = req.params;
        const studentId = req.student?.student_id;

        // Get batch details
        const { data: batch, error: batchError } = await supabase
            .from('batches')
            .select('course_id')
            .eq('batch_id', batch_id)
            .single();

        if (batchError || !batch) {
            return res.status(404).json({ error: "Batch not found" });
        }

        // Get speaking materials visible to students
        const { data: mappings, error: mappingError } = await supabase
            .from('speaking_batch_map')
            .select('*')
            .eq('batch_id', batch_id)
            .eq('student_visible', true)
            .order('created_at', { ascending: false });

        if (mappingError) {
            return res.status(500).json({ error: mappingError.message });
        }

        // Get material details
        const materialIds = mappings.map(m => m.speaking_material_id);
        if (materialIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const { data: materials, error: materialError } = await supabase
            .from('speaking_materials')
            .select('*')
            .in('id', materialIds)
            .eq('course_id', batch.course_id);

        if (materialError) {
            return res.status(500).json({ error: materialError.message });
        }

        // Merge mappings with materials and sort by session_number
        const data = mappings.map(mapping => {
            const material = materials.find(m => m.id === mapping.speaking_material_id);
            if (!material) return null;
            
            return {
                speaking_material_id: material.id,
                title: material.title,
                instruction: material.instruction,
                content_text: material.content_text,
                max_marks: material.max_marks || 0,
                session_number: material.session_number || null,
                created_at: material.created_at,
                mapping_id: mapping.id
            };
        }).filter(item => item !== null)
        .sort((a, b) => {
            const aSession = a.session_number || 9999;
            const bSession = b.session_number || 9999;
            return aSession - bSession;
        });

        // Get student's attempts if student_id provided
        if (studentId) {
            const materialIds = data.map(m => m.speaking_material_id);
            const { data: attempts } = await supabase
                .from('speaking_attempts')
                .select('*')
                .eq('student_id', studentId)
                .in('speaking_material_id', materialIds)
                .order('created_at', { ascending: false });

            // Get feedback for attempts
            const attemptIds = attempts?.map(a => a.id) || [];
            let feedbackMap = new Map();
            
            if (attemptIds.length > 0) {
                const { data: feedbacks } = await supabase
                    .from('speaking_feedback')
                    .select('*')
                    .in('attempt_id', attemptIds);
                
                feedbacks?.forEach(feedback => {
                    feedbackMap.set(feedback.attempt_id, feedback);
                });
            }

            // Group attempts by material_id (prefer submitted over draft)
            const attemptsMap = new Map();
            attempts?.forEach(attempt => {
                const key = attempt.speaking_material_id;
                const existing = attemptsMap.get(key);
                if (!existing || attempt.status === 'submitted') {
                    attemptsMap.set(key, {
                        ...attempt,
                        feedback: feedbackMap.get(attempt.id) || null
                    });
                }
            });

            // Add attempt info to each material
            data.forEach(material => {
                const attempt = attemptsMap.get(material.speaking_material_id);
                material.attempt = attempt || null;
                material.attempted = !!attempt;
                material.submitted = attempt?.status === 'submitted';
            });
        } else {
            data.forEach(material => {
                material.attempt = null;
                material.attempted = false;
                material.submitted = false;
            });
        }

        res.json({
            success: true,
            data: data || []
        });

    } catch (error) {
        console.error('Error fetching student speaking materials:', error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};

/**
 * Save Student Speaking Attempt (Draft or Submit)
 * POST /api/speaking/attempt
 */
const saveSpeakingAttempt = async (req, res) => {
    try {
        const { speaking_material_id, batch_id, audio_url, status = 'draft' } = req.body;
        const studentId = req.student?.student_id;

        if (!studentId) {
            return res.status(401).json({ error: "Student authentication required" });
        }

        if (!speaking_material_id || !batch_id || !audio_url) {
            return res.status(400).json({ error: "speaking_material_id, batch_id, and audio_url are required" });
        }

        if (status !== 'draft' && status !== 'submitted') {
            return res.status(400).json({ error: "Status must be 'draft' or 'submitted'" });
        }

        // Check if material is visible to students
        const { data: mapping, error: mappingError } = await supabase
            .from('speaking_batch_map')
            .select('*')
            .eq('speaking_material_id', speaking_material_id)
            .eq('batch_id', batch_id)
            .eq('student_visible', true)
            .single();

        if (mappingError || !mapping) {
            return res.status(403).json({ error: "This material is not available for students yet" });
        }

        // If submitting, check if there's already a submitted attempt
        if (status === 'submitted') {
            const { data: existingSubmitted } = await supabase
                .from('speaking_attempts')
                .select('id')
                .eq('student_id', studentId)
                .eq('speaking_material_id', speaking_material_id)
                .eq('batch_id', batch_id)
                .eq('status', 'submitted')
                .single();

            if (existingSubmitted) {
                return res.status(400).json({ error: "You have already submitted this attempt. Re-submission is not allowed." });
            }

            // Delete any existing draft attempts
            await supabase
                .from('speaking_attempts')
                .delete()
                .eq('student_id', studentId)
                .eq('speaking_material_id', speaking_material_id)
                .eq('batch_id', batch_id)
                .eq('status', 'draft');
        } else {
            // For draft, delete existing draft and create new one (re-record)
            await supabase
                .from('speaking_attempts')
                .delete()
                .eq('student_id', studentId)
                .eq('speaking_material_id', speaking_material_id)
                .eq('batch_id', batch_id)
                .eq('status', 'draft');
        }

        // Insert new attempt
        const attemptData = {
            student_id: studentId,
            speaking_material_id,
            batch_id,
            audio_url,
            status,
            submitted_at: status === 'submitted' ? new Date().toISOString() : null
        };

        const { data: attempt, error: insertError } = await supabase
            .from('speaking_attempts')
            .insert([attemptData])
            .select()
            .single();

        if (insertError) {
            console.error('Error saving attempt:', insertError);
            return res.status(500).json({ error: insertError.message });
        }

        res.status(201).json({
            success: true,
            message: status === 'submitted' ? "Speaking attempt submitted successfully" : "Draft saved successfully",
            data: attempt
        });

    } catch (error) {
        console.error('Error saving speaking attempt:', error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};

/**
 * Upload Speaking Audio File
 * POST /api/speaking/upload-audio
 */
const uploadSpeakingAudio = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No audio file provided" });
        }

        const studentId = req.student?.student_id;
        if (!studentId) {
            return res.status(401).json({ error: "Student authentication required" });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        
        // Determine file extension and content type
        // The bucket supports: audio/mpeg, audio/mp3, audio/wav
        // For webm files, we'll use audio/mpeg content type since webm is not in the allowed list
        let fileExt = '.webm';
        let contentType = 'audio/mpeg'; // Use mpeg as it's in the allowed list
        
        if (req.file.mimetype === 'audio/mpeg' || req.file.mimetype === 'audio/mp3') {
            fileExt = '.mp3';
            contentType = 'audio/mpeg';
        } else if (req.file.mimetype === 'audio/wav' || req.file.mimetype === 'audio/wave') {
            fileExt = '.wav';
            contentType = 'audio/wav';
        } else if (req.file.mimetype === 'audio/webm' || req.file.mimetype === 'audio/ogg') {
            // For webm/ogg files, use audio/mpeg content type (already allowed in bucket)
            // Keep .webm extension for file identification
            fileExt = '.webm';
            contentType = 'audio/mpeg';
        }
        
        const fileName = `speaking_${studentId}_${timestamp}_${randomString}${fileExt}`;
        const filePath = `speaking_attempts/${studentId}/${fileName}`;

        // Upload to Supabase storage with audio/mpeg content type (already allowed in bucket)
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('lsrw')
            .upload(filePath, req.file.buffer, {
                contentType: contentType,
                upsert: false
            });

        if (uploadError) {
            console.error('Audio upload error:', uploadError);
            return res.status(500).json({ 
                error: `Failed to upload audio: ${uploadError.message}`,
                hint: 'Please ensure the storage bucket is configured correctly.'
            });
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
            .from('lsrw')
            .getPublicUrl(filePath);

        res.json({
            success: true,
            audio_url: urlData.publicUrl
        });

    } catch (error) {
        console.error('Error uploading audio:', error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};

/**
 * Get Student Reading Materials (Student View)
 * GET /api/reading/student/:batch_id
 */
const getStudentReading = async (req, res) => {
    try {
        const { batch_id } = req.params;
        const studentId = req.student?.student_id;

        // Get batch details
        const { data: batch, error: batchError } = await supabase
            .from('batches')
            .select('course_id')
            .eq('batch_id', batch_id)
            .single();

        if (batchError || !batch) {
            return res.status(404).json({ error: "Batch not found" });
        }

        // Get reading materials visible to students
        const { data: mappings, error: mappingError } = await supabase
            .from('reading_batch_map')
            .select('*')
            .eq('batch_id', batch_id)
            .eq('student_visible', true)
            .order('created_at', { ascending: false });

        if (mappingError) {
            return res.status(500).json({ error: mappingError.message });
        }

        // Get material details (exclude file_url - student should not see it)
        const materialIds = mappings.map(m => m.reading_material_id);
        if (materialIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const { data: materials, error: materialError } = await supabase
            .from('reading_materials')
            .select('id, title, instruction, content_text, questions, max_marks, session_number, created_at')
            .in('id', materialIds)
            .eq('course_id', batch.course_id);

        if (materialError) {
            return res.status(500).json({ error: materialError.message });
        }

        // Merge mappings with materials and include session_number at top level (similar to speaking)
        const mergedData = mappings.map(mapping => {
            const material = materials.find(m => m.id === mapping.reading_material_id);
            if (!material) return null;
            
            return {
                ...mapping,
                reading_material: material || null,
                session_number: material?.session_number || null  // Add at top level for consistency
            };
        }).filter(item => item !== null && item.reading_material !== null);

        // Sort by session_number (ascending)
        const data = mergedData.sort((a, b) => {
            const sessionA = a.reading_material?.session_number || 999999;
            const sessionB = b.reading_material?.session_number || 999999;
            return sessionA - sessionB;
        });

        // Get student's attempts if student_id provided
        if (studentId) {
            const materialIds = data.map(m => m.reading_material_id);
            const { data: attempts } = await supabase
                .from('reading_attempts')
                .select('*')
                .eq('student_id', studentId)
                .in('reading_material_id', materialIds)
                .order('created_at', { ascending: false });

            // Get feedback for attempts
            const attemptIds = attempts?.map(a => a.id) || [];
            let feedbackMap = new Map();
            if (attemptIds.length > 0) {
                const { data: feedbacks } = await supabase
                    .from('reading_feedback')
                    .select('*')
                    .in('attempt_id', attemptIds);
                
                feedbacks?.forEach(feedback => {
                    feedbackMap.set(feedback.attempt_id, feedback);
                });
            }

            // Group attempts by material_id (prefer submitted over draft), including verified status
            const attemptsMap = new Map();
            attempts?.forEach(attempt => {
                const key = attempt.reading_material_id;
                const existing = attemptsMap.get(key);
                if (!existing || attempt.submitted_at) {
                    attemptsMap.set(key, {
                        ...attempt,
                        feedback: feedbackMap.get(attempt.id) || null,
                        verified: attempt.verified || false,
                        verified_at: attempt.verified_at || null
                    });
                }
            });

            // Add attempt info to each material
            data.forEach(material => {
                const attempt = attemptsMap.get(material.reading_material_id);
                material.attempt = attempt || null;
                material.attempted = !!attempt;
                material.submitted = !!attempt?.submitted_at;
            });
        } else {
            data.forEach(material => {
                material.attempt = null;
                material.attempted = false;
                material.submitted = false;
            });
        }

        res.json({
            success: true,
            data: data || []
        });

    } catch (error) {
        console.error('Error fetching student reading materials:', error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};

/**
 * Submit Student Reading Quiz (Student)
 * POST /api/reading/attempt
 */
const submitReadingAttempt = async (req, res) => {
    try {
        const { reading_material_id, batch_id, answers } = req.body;
        const studentId = req.student?.student_id;

        if (!studentId) {
            return res.status(401).json({ error: "Student authentication required" });
        }

        if (!reading_material_id || !batch_id || !answers) {
            return res.status(400).json({ error: "reading_material_id, batch_id, and answers are required" });
        }

        // Validate answers format
        if (typeof answers !== 'object') {
            return res.status(400).json({ error: "Answers must be an object" });
        }

        // Get reading material to validate questions and calculate score
        const { data: material, error: materialError } = await supabase
            .from('reading_materials')
            .select('questions')
            .eq('id', reading_material_id)
            .single();

        if (materialError || !material) {
            return res.status(404).json({ error: "Reading material not found" });
        }

        const questions = material.questions || [];
        if (!Array.isArray(questions)) {
            return res.status(400).json({ error: "Invalid reading material: questions must be an array" });
        }
        
        if (questions.length === 0) {
            return res.status(400).json({ error: "This reading material has no questions" });
        }
        
        // Validate that answers match the number of questions
        const answerKeys = Object.keys(answers);
        if (answerKeys.length !== questions.length) {
            return res.status(400).json({ error: `Answers must contain responses for all ${questions.length} question(s)` });
        }

        // Calculate score
        let score = 0;
        const maxScore = questions.length;
        questions.forEach((q, index) => {
            const questionKey = `question${index + 1}`;
            const studentAnswer = answers[questionKey]?.toUpperCase();
            const correctAnswer = q.correct_answer?.toUpperCase();
            if (studentAnswer === correctAnswer) {
                score++;
            }
        });

        // Check if attempt already exists
        const { data: existingAttempt } = await supabase
            .from('reading_attempts')
            .select('id, submitted_at')
            .eq('reading_material_id', reading_material_id)
            .eq('student_id', studentId)
            .single();

        if (existingAttempt && existingAttempt.submitted_at) {
            return res.status(400).json({ error: "You have already submitted this reading quiz. Only one attempt is allowed." });
        }

        // Insert or update attempt
        let attempt;
        if (existingAttempt) {
            // Update existing attempt
            const { data, error } = await supabase
                .from('reading_attempts')
                .update({
                    answers,
                    score,
                    max_score: maxScore,
                    submitted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingAttempt.id)
                .select()
                .single();

            if (error) {
                return res.status(500).json({ error: error.message });
            }
            attempt = data;
        } else {
            // Create new attempt
            const { data, error } = await supabase
                .from('reading_attempts')
                .insert([{
                    reading_material_id,
                    student_id: studentId,
                    batch_id,
                    answers,
                    score,
                    max_score: maxScore,
                    submitted_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) {
                return res.status(500).json({ error: error.message });
            }
            attempt = data;
        }

        res.status(201).json({
            success: true,
            message: "Reading quiz submitted successfully",
            data: attempt
        });

    } catch (error) {
        console.error('Error submitting reading attempt:', error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};

/**
 * Get Student Writing Tasks (Student View)
 * GET /api/writing/student/:batch_id
 */
const getStudentWriting = async (req, res) => {
    try {
        const { batch_id } = req.params;
        const studentId = req.student?.student_id;

        // Get batch details
        const { data: batch, error: batchError } = await supabase
            .from('batches')
            .select('course_id')
            .eq('batch_id', batch_id)
            .single();

        if (batchError || !batch) {
            return res.status(404).json({ error: "Batch not found" });
        }

        // Get writing tasks visible to students
        const { data: mappings, error: mappingError } = await supabase
            .from('writing_batch_map')
            .select('*')
            .eq('batch_id', batch_id)
            .eq('student_visible', true)
            .order('created_at', { ascending: false });

        if (mappingError) {
            return res.status(500).json({ error: mappingError.message });
        }

        // Get task details
        const taskIds = mappings.map(m => m.writing_task_id);
        if (taskIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const { data: tasks, error: taskError } = await supabase
            .from('writing_tasks')
            .select('*')
            .in('id', taskIds)
            .eq('course_id', batch.course_id);

        if (taskError) {
            return res.status(500).json({ error: taskError.message });
        }

        // Merge mappings with tasks and sort by session_number
        const data = mappings.map(mapping => {
            const task = tasks.find(t => t.id === mapping.writing_task_id);
            if (!task) return null;
            
            return {
                writing_task_id: task.id,
                title: task.title,
                instruction: task.instruction,
                content_type: task.content_type,
                content_text: task.content_text,
                file_url: task.file_url,
                file_type: task.file_type,
                session_number: task.session_number,
                max_marks: task.max_marks,
                created_at: task.created_at,
                mapping_id: mapping.id
            };
        }).filter(item => item !== null)
        .sort((a, b) => {
            const aSession = a.session_number || 9999;
            const bSession = b.session_number || 9999;
            return aSession - bSession;
        });

        // Get student's submissions if student_id provided
        if (studentId) {
            const taskIds = data.map(t => t.writing_task_id);
            const { data: submissions } = await supabase
                .from('writing_submissions')
                .select('*')
                .eq('student_id', studentId)
                .in('writing_task_id', taskIds)
                .order('submitted_at', { ascending: false });

            // Get feedback for submissions
            const submissionIds = submissions?.map(s => s.id) || [];
            let feedbackMap = new Map();
            
            if (submissionIds.length > 0) {
                const { data: feedbacks } = await supabase
                    .from('writing_feedback')
                    .select('*')
                    .in('submission_id', submissionIds);
                
                feedbacks?.forEach(feedback => {
                    feedbackMap.set(feedback.submission_id, feedback);
                });
            }

            // Group submissions by task_id
            const submissionsMap = new Map();
            submissions?.forEach(submission => {
                submissionsMap.set(submission.writing_task_id, {
                    ...submission,
                    feedback: feedbackMap.get(submission.id) || null
                });
            });

            // Add submission info to each task
            data.forEach(task => {
                const submission = submissionsMap.get(task.writing_task_id);
                task.submission = submission || null;
                task.submitted = !!submission;
            });
        } else {
            data.forEach(task => {
                task.submission = null;
                task.submitted = false;
            });
        }

        res.json({
            success: true,
            data: data || []
        });

    } catch (error) {
        console.error('Error fetching student writing tasks:', error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};

/**
 * Upload Writing Submission Image
 * POST /api/writing/upload-image
 */
const uploadWritingImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: "No image file provided" 
            });
        }

        const studentId = req.student?.student_id;
        if (!studentId) {
            return res.status(401).json({ 
                success: false,
                error: "Student authentication required" 
            });
        }

        // Validate file buffer exists
        if (!req.file.buffer) {
            return res.status(400).json({ 
                success: false,
                error: "File buffer is missing" 
            });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        
        // Determine file extension and content type
        let fileExt = '.jpg';
        let contentType = 'image/jpeg';
        
        if (req.file.mimetype === 'image/png') {
            fileExt = '.png';
            contentType = 'image/png';
        } else if (req.file.mimetype === 'image/jpeg' || req.file.mimetype === 'image/jpg') {
            fileExt = '.jpg';
            contentType = 'image/jpeg';
        }
        
        const fileName = `writing_${studentId}_${timestamp}_${randomString}${fileExt}`;
        const filePath = `writing_submissions/${studentId}/${fileName}`;

        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('lsrw')
            .upload(filePath, req.file.buffer, {
                contentType: contentType,
                upsert: false
            });

        if (uploadError) {
            console.error('Image upload error:', uploadError);
            return res.status(500).json({ 
                success: false,
                error: `Failed to upload image: ${uploadError.message}`,
                hint: 'Please ensure the storage bucket is configured correctly.'
            });
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
            .from('lsrw')
            .getPublicUrl(filePath);

        if (!urlData || !urlData.publicUrl) {
            console.error('Failed to get public URL for uploaded image');
            return res.status(500).json({ 
                success: false,
                error: "Failed to generate image URL"
            });
        }

        res.json({
            success: true,
            image_url: urlData.publicUrl
        });

    } catch (error) {
        console.error('Error uploading writing image:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || "Internal server error" 
        });
    }
};

/**
 * Submit Writing Task
 * POST /api/writing/submit
 */
const submitWritingTask = async (req, res) => {
    try {
        const { writing_task_id, batch_id, submission_image_url } = req.body;
        const studentId = req.student?.student_id;

        if (!studentId) {
            return res.status(401).json({ error: "Student authentication required" });
        }

        if (!writing_task_id || !batch_id || !submission_image_url) {
            return res.status(400).json({ error: "writing_task_id, batch_id, and submission_image_url are required" });
        }

        // Check if task is visible to students
        const { data: mapping, error: mappingError } = await supabase
            .from('writing_batch_map')
            .select('*')
            .eq('writing_task_id', writing_task_id)
            .eq('batch_id', batch_id)
            .eq('student_visible', true)
            .single();

        if (mappingError || !mapping) {
            return res.status(403).json({ error: "This writing task is not available for students yet" });
        }

        // Check if student has already submitted
        const { data: existingSubmission } = await supabase
            .from('writing_submissions')
            .select('id, submission_image_url')
            .eq('student_id', studentId)
            .eq('writing_task_id', writing_task_id)
            .eq('batch_id', batch_id)
            .single();

        let submissionData;

        if (existingSubmission) {
            // Update existing submission
            const { data: updated, error: updateError } = await supabase
                .from('writing_submissions')
                .update({
                    submission_image_url: submission_image_url,
                    submitted_at: new Date().toISOString()
                })
                .eq('id', existingSubmission.id)
                .select()
                .single();

            if (updateError) {
                return res.status(500).json({ error: updateError.message });
            }

            submissionData = updated;
        } else {
            // Create new submission
            const { data: inserted, error: insertError } = await supabase
                .from('writing_submissions')
                .insert({
                    student_id: studentId,
                    writing_task_id: writing_task_id,
                    batch_id: batch_id,
                    submission_image_url: submission_image_url,
                    submitted_at: new Date().toISOString()
                })
                .select()
                .single();

            if (insertError) {
                return res.status(500).json({ error: insertError.message });
            }

            submissionData = inserted;
        }

        res.json({
            success: true,
            message: "Writing task submitted successfully",
            data: submissionData
        });

    } catch (error) {
        console.error('Error submitting writing task:', error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
};

module.exports = {
    getStudentLSRW,
    submitStudentAnswers,
    getStudentReview,
    getStudentSpeaking,
    saveSpeakingAttempt,
    uploadSpeakingAudio,
    getStudentReading,
    submitReadingAttempt,
    getStudentWriting,
    uploadWritingImage,
    submitWritingTask
};

