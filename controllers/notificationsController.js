// file: controllers/notificationsController.js
const supabase = require("../config/supabaseClient");

/**
 * GET /api/notifications
 * Fetch unread notifications for the logged-in student
 */
const getNotifications = async (req, res) => {
    try {
        // Ensure authMiddleware has set req.student
        if (!req.student || !req.student.student_id) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const studentId = req.student.student_id;

        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("student", studentId)
            .eq("is_read", false) // fetch only unread notifications
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Supabase fetch error:", error);
            return res.status(500).json({ success: false, data: [], error: error.message });
        }

        res.json({ success: true, data: data || [] });
    } catch (err) {
        console.error("❌ Error fetching notifications:", err);
        res.status(500).json({ success: false, data: [], error: err.message });
    }
};

/**
 * PATCH /api/notifications/:id
 * Mark a notification as read
 */
const markAsRead = async (req, res) => {
    try {
        if (!req.student || !req.student.student_id) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const studentId = req.student.student_id;
        const { id } = req.params;

        const { data, error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", id)
            .eq("student", studentId);

        if (error) {
            console.error("Supabase update error:", error);
            return res.status(500).json({ success: false, error: error.message });
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error("❌ Error marking notification as read:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = { getNotifications, markAsRead };
