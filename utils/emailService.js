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

module.exports = { sendPaymentReceipt };
