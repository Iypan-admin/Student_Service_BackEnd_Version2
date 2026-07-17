const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const studentRoutes = require('./routes/studentRoutes');
const batchRoutes = require('./routes/batchRoutes');
const classRoutes = require('./routes/classRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const studentFeesRoute = require('./routes/studentFeesRoute');
const paymentLockRoutes = require('./routes/paymentLockRoutes');
const notificationsRouter = require("./routes/notifications");
const razorpayRoutes = require("./routes/razorpayRoutes");
const webhookPaymentRoutes = require("./routes/webhookpaymentRoutes");
const attendanceRoutes = require('./routes/attendanceRoutes');
const eventRoutes = require('./routes/eventRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const lsrwRoutes = require('./routes/lsrwRoutes');
const speakingRoutes = require('./routes/speakingRoutes');
const readingRoutes = require('./routes/readingRoutes');
const writingRoutes = require('./routes/writingRoutes');
const studentCertificateRoutes = require('./routes/studentCertificateRoutes');

dotenv.config();

const app = express();

// CORS configuration with environment variables
const corsOptions = {
    origin: process.env.CORS_ORIGINS 
        ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
        : '*', // Default to allow all origins if not set
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// ✅ Razorpay webhook needs raw body
app.use("/api/razorpay", webhookPaymentRoutes);

// ✅ JSON parser for all other routes
app.use(express.json());

// ✅ Student, Batch, Class, Payment APIs
app.use('/api/students', studentRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/classes', classRoutes);
app.use('/api', studentFeesRoute);
app.use('/api/payment-lock', paymentLockRoutes);
app.use("/api/notifications", notificationsRouter);
app.use("/api/payments", paymentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/lsrw', lsrwRoutes);
app.use('/api/speaking', speakingRoutes);
app.use('/api/reading', readingRoutes);
app.use('/api/writing', writingRoutes);
app.use('/api/student/certificates', studentCertificateRoutes);

// ✅ Razorpay APIs
app.use("/api/razorpay", razorpayRoutes);

// 🔔 Load EMI expiry notification cron job
require("./cron/emiExpiryNotifications");

// Serve frontend static files (dist folder)
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - serve index.html for any non-API route
app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
        return res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    }
    next();
});

// 404 handler (API routes only reached here)
app.use((req, res) => {
    res.status(404).json({ success: false, message: "API endpoint not found" });
});

// Global error handler (optional)
app.use((err, req, res, next) => {
    console.error("Global error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
});

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
