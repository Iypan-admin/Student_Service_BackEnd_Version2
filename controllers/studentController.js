const supabase = require('../config/supabaseClient');
const { supabaseAdmin } = require('../config/supabaseClient');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const { get } = require('../routes/batchRoutes');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const path = require('path');

// Register Student
const registerStudent = async (req, res) => {
    const { registration_number, name, state, center, email, password, phone, is_referred, referred_by_center } = req.body;

    if (!name || !state || !center || !email || !password || !phone) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate referral data if is_referred is true
    if (is_referred && !referred_by_center) {
        return res.status(400).json({ error: 'Referring center is required when is_referred is true' });
    }


    const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare student data
    const studentData = {
        name,
        state,
        center,
        email,
        password: hashedPassword,
        phone,
        status: false, // Default status is false
        is_referred: is_referred || false,
        referred_by_center: is_referred ? referred_by_center : null
    };

    const { data, error } = await supabase
        .from('students')
        .insert([studentData])
        .select(); // Fetch the inserted row details

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    const student = data[0];

    // Create notification for Academic Coordinators when student registers (status = false means pending approval)
    try {
        // Get all academic coordinators using supabaseAdmin (needed for cross-table access)
        const { data: academicCoordinators, error: coordError } = await supabaseAdmin
            .from('academic_coordinator')
            .select('user_id');

        if (!coordError && academicCoordinators && academicCoordinators.length > 0) {
            // Create notification for each academic coordinator
            const notifications = academicCoordinators.map(coord => ({
                academic_coordinator_id: coord.user_id,
                message: `${name} registered, waiting for your approval`,
                type: 'STUDENT_REGISTERED',
                related_id: student.student_id,
                is_read: false
            }));

            // Insert notifications into academic_notifications table using supabaseAdmin
            const { error: notifError } = await supabaseAdmin
                .from('academic_notifications')
                .insert(notifications);

            if (notifError) {
                console.error('Error creating academic notifications:', notifError);
                // Don't fail the registration if notification creation fails
            } else {
                console.log(`✅ Notifications sent to ${academicCoordinators.length} academic coordinator(s) for student ${name}`);
            }
        }
    } catch (notifErr) {
        console.error('Error in notification creation:', notifErr);
        // Don't fail the registration if notification creation fails
    }

    res.status(201).json({ message: 'Registration successful', student: student });
};

// Login Student
const loginStudent = async (req, res) => {
    const { registration_number, password } = req.body;

    if (!registration_number || !password) {
        return res.status(400).json({ error: 'Registration number and password are required' });
    }

    const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .eq('registration_number', registration_number)
        .limit(1);

    if (error || students.length === 0) {
        return res.status(400).json({ error: 'Invalid credentials' });
    }

    const student = students[0];

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (!student.status) {
        return res.status(403).json({ error: 'Your profile needs to be approved' });
    }

    const token = generateToken(student.student_id, student.center, student.state);
    res.json({ message: 'Login successful', token });
};

const getStudentDetails = async (req, res) => {
    const { student_id } = req.body;

    if (!student_id) {
        return res.status(400).json({ error: 'Student ID is required' });
    }

    // Fetch student details with full state and center information
    const { data, error } = await supabase
        .from('students')
        .select(`
            student_id, created_at, registration_number, name, email, password, phone, status,
            is_referred, referred_by_center, profile_picture,
            state:states (*),
            center:centers!students_center_fkey (*),
            referring_center:centers!students_referred_by_center_fkey (*)
        `)
        .eq('student_id', student_id)
        .single();

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.json({ student: data });
};



// Update Student Details
const updateStudent = async (req, res) => {
    const { name, state, center, email, phone } = req.body;
    const student_id = req.student.student_id;

    const { data, error } = await supabase
        .from('students')
        .update({ name, state, center, email, phone })
        .eq('student_id', student_id);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Profile updated successfully' });
};

// Upload Student Profile Picture
const uploadProfilePicture = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const student_id = req.student.student_id;
        const fileBuffer = req.file.buffer;
        const fileExt = path.extname(req.file.originalname);
        const fileName = `${Date.now()}${fileExt}`;
        const filePath = `${student_id}/${fileName}`;

        // Upload to Supabase storage (bucket: user-profiles - same as admin portal)
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('user-profiles')
            .upload(filePath, fileBuffer, { upsert: true });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return res.status(500).json({ error: 'Failed to upload profile picture to storage' });
        }

        // Get public URL
        const { data: urlData, error: urlError } = supabaseAdmin.storage
            .from('user-profiles')
            .getPublicUrl(filePath);

        if (urlError) {
            console.error('Get public URL error:', urlError);
            return res.status(500).json({ error: 'Failed to get profile picture URL' });
        }

        const publicUrl = urlData.publicUrl;

        // Update student's profile_picture in database
        const { error: updateError } = await supabase
            .from('students')
            .update({ profile_picture: publicUrl })
            .eq('student_id', student_id);

        if (updateError) {
            console.error('Database update error:', updateError);
            return res.status(500).json({ error: 'Failed to update profile picture in database' });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Profile picture uploaded successfully',
            data: publicUrl 
        });
    } catch (error) {
        console.error('Upload profile picture error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete Student Profile Picture
const deleteProfilePicture = async (req, res) => {
    try {
        const student_id = req.student.student_id;

        // Get current profile picture URL from database
        const { data: studentData, error: fetchError } = await supabase
            .from('students')
            .select('profile_picture')
            .eq('student_id', student_id)
            .single();

        if (fetchError) {
            console.error('Error fetching student data:', fetchError);
            return res.status(500).json({ error: 'Failed to fetch student data' });
        }

        // If profile picture exists, delete from storage
        if (studentData?.profile_picture) {
            try {
                // Extract file path from URL
                // URL format: https://[project].supabase.co/storage/v1/object/public/user-profiles/[student_id]/[filename]
                const urlParts = studentData.profile_picture.split('/user-profiles/');
                if (urlParts.length > 1) {
                    const filePath = urlParts[1];
                    
                    // Delete from Supabase storage
                    const { error: deleteError } = await supabaseAdmin.storage
                        .from('user-profiles')
                        .remove([filePath]);

                    if (deleteError) {
                        console.error('Storage delete error:', deleteError);
                        // Continue to remove from database even if storage delete fails
                    }
                }
            } catch (storageError) {
                console.error('Error deleting from storage:', storageError);
                // Continue to remove from database even if storage delete fails
            }
        }

        // Remove profile_picture from database
        const { error: updateError } = await supabase
            .from('students')
            .update({ profile_picture: null })
            .eq('student_id', student_id);

        if (updateError) {
            console.error('Database update error:', updateError);
            return res.status(500).json({ error: 'Failed to delete profile picture from database' });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Profile picture deleted successfully'
        });
    } catch (error) {
        console.error('Delete profile picture error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete Student
const deleteStudent = async (req, res) => {
    const student_id = req.student.student_id;

    const { error } = await supabase
        .from('students')
        .delete()
        .eq('student_id', student_id);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Student deleted successfully' });
};

// Get List of States
const getStates = async (req, res) => {
    const { data, error } = await supabase.from('states').select('*');

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.json(data);
};

// Get Centers Based on Selected State
const getCentersByState = async (req, res) => {
    const { state_id } = req.query; // Get state ID from query params

    if (!state_id) {
        return res.status(400).json({ error: 'State ID is required' });
    }

    const { data, error } = await supabase
        .from('centers')
        .select('*')
        .eq('state', state_id); // Fetch centers based on state

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.json(data);
};

// Get All Centers (for referral dropdown)
const getAllCenters = async (req, res) => {
    const { data, error } = await supabase
        .from('centers')
        .select('*')
        .order('center_name', { ascending: true });

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.json(data);
};

// Generate Reset Token Helper
const generateResetToken = () => {
    // Generate a 6-digit number between 100000 and 999999
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Forgot Password Handler
const forgotPassword = async (req, res) => {
    const { registration_number } = req.body;

    if (!registration_number) {
        return res.status(400).json({ error: 'Registration number is required' });
    }

    try {
        const { data: students, error } = await supabase
            .from('students')
            .select('student_id, email')
            .eq('registration_number', registration_number)
            .limit(1);

        if (error || students.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const student = students[0];
        const resetToken = generateResetToken();
        const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Update student with reset token
        const { error: updateError } = await supabase
            .from('students')
            .update({
                reset_token: resetToken,
                reset_token_expires: resetTokenExpires.toISOString()
            })
            .eq('student_id', student.student_id);

        if (updateError) throw updateError;

        // Send email with token only (no URL needed)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            to: student.email,
            subject: 'Password Reset Code',
            html: `
                <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
                <div style="max-width: 600px; margin: auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 30px;">
                    <h2 style="color: #333;">🔐 Forgot Your Password?</h2>
                    <p style="font-size: 16px; color: #555;">Don't worry! Use the code below to reset your password. This code is valid for the next <strong>15 minutes</strong>.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; font-weight: bold; background-color: #f0f0f0; padding: 10px 20px; border-radius: 8px; display: inline-block; letter-spacing: 3px;">
                            ${resetToken}
                        </span>
                    </div>
                    <p style="font-size: 14px; color: #888;">If you didn't request this, you can safely ignore this email.</p>
                    <hr style="margin: 40px 0; border: none; border-top: 1px solid #eee;" />
                    <p style="font-size: 12px; color: #aaa;">This message was sent by the Student Portal Support Team.</p>
                </div>
            </div>
            `
        });

        res.json({
            message: 'Password reset code sent to your email',
            email: student.email.replace(/(.{2})(.*)(?=@)/, (_, start, rest) => start + '*'.repeat(rest.length))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
};

// Reset Password Handler
const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Reset code and new password are required' });
    }

    try {
        const { data: students, error } = await supabase
            .from('students')
            .select('student_id, reset_token_expires')
            .eq('reset_token', token)
            .limit(1);

        if (error || students.length === 0) {
            return res.status(400).json({ error: 'Invalid reset code' });
        }

        const student = students[0];

        if (new Date(student.reset_token_expires) < new Date()) {
            return res.status(400).json({ error: 'Reset code has expired' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const { error: updateError } = await supabase
            .from('students')
            .update({
                password: hashedPassword,
                reset_token: null,
                reset_token_expires: null
            })
            .eq('student_id', student.student_id);

        if (updateError) throw updateError;

        res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

module.exports = {
    registerStudent,
    loginStudent,
    getStudentDetails,
    updateStudent,
    deleteStudent,
    getStates,
    getCentersByState,
    getAllCenters,
    forgotPassword,
    resetPassword,
    uploadProfilePicture,
    deleteProfilePicture
};
