const supabase = require('../config/supabaseClient');

// Get student's assessment marks for a batch
const getStudentAssessmentMarks = async (req, res) => {
    try {
        const { studentId, batchId } = req.params;
        const userId = req.student.student_id;

        // Use the studentId from params directly (like other controllers)
        // The auth middleware already verified the token is valid

        // Get assessment marks for the student in this batch
        const { data: marks, error: marksError } = await supabase
            .from('assessment_marks')
            .select('*')
            .eq('student_id', studentId)
            .eq('batch_id', batchId)
            .eq('status', 'submitted')
            .single();

        if (marksError && marksError.code !== 'PGRST116') {
            return res.status(500).json({ error: marksError.message });
        }

        if (!marks) {
            return res.status(404).json({ error: 'Assessment marks not found' });
        }

        res.status(200).json({
            success: true,
            data: marks
        });

    } catch (error) {
        console.error('Error fetching assessment marks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get student's certificates for a batch
const getStudentCertificates = async (req, res) => {
    try {
        const { studentId, batchId } = req.params;
        const userId = req.student.student_id;

        // Use the studentId from params directly (like other controllers)
        // The auth middleware already verified the token is valid

        // Get certificates for the student in this batch
        const { data: certificates, error: certificatesError } = await supabase
            .from('generated_certificates')
            .select('*')
            .eq('student_id', studentId)
            .eq('batch_id', batchId)
            .eq('status', 'completed')
            .order('generated_at', { ascending: false });

        if (certificatesError) {
            return res.status(500).json({ error: certificatesError.message });
        }

        res.status(200).json({
            success: true,
            data: certificates || []
        });

    } catch (error) {
        console.error('Error fetching certificates:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get certificate details
const getCertificateDetails = async (req, res) => {
    try {
        const { certificateId } = req.params;
        const userId = req.student.student_id;

        // Get certificate details
        const { data: certificate, error: certificateError } = await supabase
            .from('generated_certificates')
            .select('*')
            .eq('certificate_id', certificateId)
            .single();

        if (certificateError) {
            return res.status(500).json({ error: certificateError.message });
        }

        if (!certificate) {
            return res.status(404).json({ error: 'Certificate not found' });
        }

        res.status(200).json({
            success: true,
            data: certificate
        });

    } catch (error) {
        console.error('Error fetching certificate details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Download certificate
const downloadCertificate = async (req, res) => {
    try {
        const { certificateId } = req.params;
        const userId = req.student.student_id;

        console.log('Download certificate request:', { certificateId, userId });

        // Get certificate details
        const { data: certificate, error: certificateError } = await supabase
            .from('generated_certificates')
            .select('*')
            .eq('certificate_id', certificateId)
            .single();

        if (certificateError) {
            console.error('Certificate fetch error:', certificateError);
            return res.status(500).json({ error: certificateError.message });
        }

        if (!certificate) {
            console.log('Certificate not found for ID:', certificateId);
            return res.status(404).json({ error: 'Certificate not found' });
        }

        console.log('Certificate found:', certificate);

        // Get student details for registration number
        let studentDetails = null;
        try {
            // Try different possible column names for student name
            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('*')
                .eq('student_id', certificate.student_id)
                .single();
            
            if (!studentError && student) {
                studentDetails = student;
                console.log('Student details found:', studentDetails);
                
                // Log available columns to debug
                const availableColumns = Object.keys(studentDetails);
                console.log('Available student columns:', availableColumns);
            } else {
                console.log('Student not found or error:', studentError);
            }
        } catch (studentErr) {
            console.error('Error fetching student details:', studentErr);
        }

        // Check if certificate_url exists
        if (!certificate.certificate_url) {
            console.log('Certificate URL is missing');
            return res.status(404).json({ error: 'Certificate file not available' });
        }

        console.log('Attempting to download file from URL:', certificate.certificate_url);

        // Extract file path from URL if it's a full Supabase URL
        let filePath = certificate.certificate_url;
        if (certificate.certificate_url.includes('supabase.co/storage/v1/object/public/')) {
            // Extract the path after the public bucket name
            const urlParts = certificate.certificate_url.split('public/');
            if (urlParts.length > 1) {
                filePath = urlParts[1].split('?')[0]; // Remove query parameters
                console.log('Extracted file path:', filePath);
            }
        }

        console.log('Final file path for download:', filePath);

        // First, try to check if file exists in storage
        try {
            // Extract just the filename from the path for listing
            const pathParts = filePath.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const folderPath = pathParts.slice(0, -1).join('/');
            
            console.log('Checking file existence - folder:', folderPath, 'filename:', fileName);
            
            const { data: fileList, error: listError } = await supabase.storage
                .from('completion-certificates')
                .list(folderPath, { limit: 100, search: fileName });
            
            if (listError) {
                console.error('Error checking file existence:', listError);
            } else {
                console.log('File list result:', fileList);
            }
        } catch (listErr) {
            console.error('Exception checking file existence:', listErr);
        }

        // Try to get certificate file from Supabase storage
        const { data: fileData, error: fileError } = await supabase.storage
            .from('completion-certificates')
            .download(filePath);

        if (fileError) {
            console.error('File download error:', fileError);
            console.error('Original error details:', fileError.originalError);
            
            // Try to get more info about the error
            if (fileError.originalError) {
                console.error('Error status:', fileError.originalError.status);
                console.error('Error statusText:', fileError.originalError.statusText);
                console.error('Error URL:', fileError.originalError.url);
            }
            
            // Fallback: try to fetch from the public URL directly
            console.log('Attempting fallback download from public URL...');
            try {
                const https = require('https');
                const fs = require('fs');
                
                const response = await fetch(certificate.certificate_url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const buffer = await response.arrayBuffer();
                const fileBuffer = Buffer.from(buffer);
                
                console.log('Fallback download successful, size:', fileBuffer.length);
                
                // Extract the exact filename from the certificate URL
                const urlParts = certificate.certificate_url.split('/');
                const actualFileName = urlParts[urlParts.length - 1].split('?')[0]; // Get exact filename without query params
                
                // Use the exact same filename as in Supabase storage
                console.log('Using exact storage filename:', actualFileName);
                
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${actualFileName}"`);
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                res.setHeader('Last-Modified', new Date(0));
                res.setHeader('ETag', `"${Date.now()}"`);
                res.send(fileBuffer);
                return;
                
            } catch (fetchError) {
                console.error('Fallback download also failed:', fetchError);
            }
            
            return res.status(500).json({ 
                error: 'Certificate file not found in storage',
                details: fileError.message,
                filePath: filePath
            });
        }

        console.log('File downloaded successfully, size:', fileData?.size);

        // Extract the exact filename from the certificate URL
        const urlParts = certificate.certificate_url.split('/');
        const actualFileName = urlParts[urlParts.length - 1].split('?')[0]; // Get exact filename without query params
        
        // Use the exact same filename as in Supabase storage
        console.log('Using exact storage filename:', actualFileName);

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${actualFileName}"`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Last-Modified', new Date(0));
        res.setHeader('ETag', `"${Date.now()}"`);

        // Send the file
        res.send(fileData);

    } catch (error) {
        console.error('Error downloading certificate:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get all batches for a student
const getStudentBatches = async (req, res) => {
    try {
        const { studentId } = req.params;
        const userId = req.student.student_id;

        // Use the studentId from params directly (like other controllers)
        // The auth middleware already verified the token is valid

        // Get all batches for the student
        const { data: batches, error: batchesError } = await supabase
            .from('enrollment')
            .select('batch_id')
            .eq('student_id', studentId);

        if (batchesError) {
            return res.status(500).json({ error: batchesError.message });
        }

        res.status(200).json({
            success: true,
            data: batches || []
        });

    } catch (error) {
        console.error('Error fetching student batches:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getStudentAssessmentMarks,
    getStudentCertificates,
    getCertificateDetails,
    downloadCertificate,
    getStudentBatches
};
