const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
    },
});

const sendPaymentReceipt = async (to, studentName, amount, paymentId, courseName, paymentType, currentEmi) => {
    try {
        let emiRow = '';
        if (paymentType && paymentType.toLowerCase() === 'emi' && currentEmi) {
            emiRow = `
            <tr>
                <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #eee;">Current EMI Month:</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">Month ${currentEmi}</td>
            </tr>`;
        }

        const mailOptions = {
            from: `"ISML TEAM" <${process.env.MAIL_USER}>`,
            to: to,
            subject: `Payment Receipt - ${paymentId}`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #4CAF50;">Payment Successful!</h2>
                    <p style="color: #555;">Dear ${studentName},</p>
                    <p style="color: #555;">Thank you for your payment. Here are the details of your transaction:</p>
                </div>
                
                <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #eee;">Transaction ID:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee;">${paymentId}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #eee;">Course:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee;">${courseName}</td>
                        </tr>
                         <tr>
                            <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #eee;">Payment Type:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; text-transform: capitalize;">${paymentType}</td>
                        </tr>
                        ${emiRow}
                        <tr>
                            <td style="padding: 10px; font-weight: bold; font-size: 1.1em; color: #333;">Amount Paid:</td>
                            <td style="padding: 10px; font-weight: bold; font-size: 1.1em; color: #2e7d32;">₹${amount}</td>
                        </tr>
                    </table>
                </div>

                <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.9em;">
                    <p>This is an automated receipt. If you have any questions, please contact support.</p>
                    <p>&copy; ${new Date().getFullYear()} ISML ERP. All rights reserved.</p>
                </div>
            </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("✅ Email Receipt sent:", info.messageId);
        return true;
    } catch (error) {
        console.error("❌ Error sending email:", error);
        return false;
    }
};

const sendNewStudentRegistrationAlert = async (to, studentName, studentEmail, studentPhone) => {
    try {
        const recipient = to || 'hr.isml.ipeducen@gmail.com';
        const mailOptions = {
            from: `"ISML ERP System" <${process.env.MAIL_USER}>`,
            to: recipient,
            subject: `Action Required: New Student Registered - ${studentName}`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff;">
                <div style="background-color: #1a237e; color: #ffffff; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h2 style="margin: 0; font-size: 20px;">ISML Portal - New Student Registration</h2>
                </div>
                <div style="padding: 20px; color: #333;">
                    <p style="font-size: 15px;">Dear Academic Manager,</p>
                    <p style="font-size: 14px; color: #555;">A new student has registered on the ISML portal and is waiting for your review and approval.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #1a237e; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1a237e; font-size: 16px;">Student Registration Details</h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555; width: 35%;">Student Name:</td>
                                <td style="padding: 8px 0; color: #111;">${studentName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Email Address:</td>
                                <td style="padding: 8px 0; color: #111;">${studentEmail}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Phone Number:</td>
                                <td style="padding: 8px 0; color: #111;">${studentPhone || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Status:</td>
                                <td style="padding: 8px 0;"><span style="background-color: #fff3cd; color: #856404; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 12px;">Pending Approval</span></td>
                            </tr>
                        </table>
                    </div>

                    <p style="text-align: center; margin-top: 25px;">
                        <a href="https://adminportal.iypan.com" style="background-color: #1a237e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Admin Portal to Approve</a>
                    </p>
                </div>
                <div style="text-align: center; color: #888; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
                    This is an automated notification from ISML ERP System.
                </div>
            </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Registration alert email sent to Academic Manager (${recipient}):`, info.messageId);
        return true;
    } catch (error) {
        console.error("❌ Error sending registration alert email to Academic Manager:", error);
        return false;
    }
};

module.exports = { sendPaymentReceipt, sendNewStudentRegistrationAlert };
