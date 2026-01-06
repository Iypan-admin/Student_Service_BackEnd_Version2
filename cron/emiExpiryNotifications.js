// file: cron/emiExpiryNotifications.js
const supabase = require("../config/supabaseClient");
const cron = require("node-cron");

// ⚡ For testing, run every minute
cron.schedule("0 0 * * *", async () => {
    // cron.schedule(
    //   "* * * * *",
    //   async () => {
        try {
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0); // reset time in UTC for comparison

          console.log(`🔍 Checking for enrollments expiring soon...`);

          // 1️⃣ Get all active enrollments with batch info
          // EXCLUDE permanent enrollments (final EMI completed or full payment) - no expiry notifications needed
          const { data: enrollments, error } = await supabase
            .from("enrollment")
            .select(
              `
                enrollment_id,
                student,
                end_date,
                is_permanent,
                batch (
                  batch_name
                )
            `
            )
            .eq("status", true)
            .neq("is_permanent", true); // Exclude permanent enrollments

          if (error) {
            console.error("❌ Error fetching enrollments:", error);
            return;
          }

          if (!enrollments || enrollments.length === 0) {
            console.log("ℹ️ No active enrollments found.");
            return;
          }

          // 2️⃣ Loop through each enrollment
          for (const enr of enrollments) {
            if (!enr.end_date) continue;

            const endDate = new Date(enr.end_date);
            endDate.setUTCHours(0, 0, 0, 0); // reset time in UTC
            const diffDays = Math.ceil(
              (endDate - today) / (1000 * 60 * 60 * 24)
            );

            // Only notify if 1, 2, or 3 days remaining
            if (![1, 2, 3].includes(diffDays)) continue;

            // Check last payment
            const { data: payment, error: paymentError } = await supabase
              .from("student_course_payment")
              .select("payment_type")
              .eq("enrollment_id", enr.enrollment_id)
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            if (paymentError) {
              console.error(
                `❌ Error fetching payment for enrollment ${enr.enrollment_id}:`,
                paymentError
              );
              continue;
            }

            // Only notify EMI payments
            if (payment?.payment_type !== "emi") continue;

            // Check if notification already sent today
            const startOfDay = today.toISOString();
            const endOfDay = new Date(today);
            endOfDay.setUTCHours(23, 59, 59, 999);

            const { data: existingNotif, error: notifCheckError } =
              await supabase
                .from("notifications")
                .select("*")
                .eq("student", enr.student)
                .eq(
                  "message",
                  `Your course "${enr.batch.batch_name}" will expire on ${enr.end_date}. Please make a payment to renew.`
                )
                .gte("created_at", startOfDay)
                .lte("created_at", endOfDay.toISOString()); // <-- convert to ISO UTC

            if (notifCheckError) {
              console.error(
                "❌ Error checking existing notifications:",
                notifCheckError
              );
              continue;
            }

            if (existingNotif && existingNotif.length > 0) continue; // skip if already sent today

            // 3️⃣ Insert notification
            const message = `Your course "${enr.batch.batch_name}" will expire on ${enr.end_date}. Please make a payment to renew.`;

            const { error: notifError } = await supabase
              .from("notifications")
              .insert({
                student: enr.student,
                message,
              });

            if (notifError) {
              console.error(
                `❌ Failed to insert notification for student ${enr.student}:`,
                notifError
              );
            } else {
              console.log(
                `🔔 Notification sent to student ${enr.student} (expires in ${diffDays} days)`
              );
            }
          }
        } catch (err) {
          console.error("❌ Cron job error:", err);
        }
      },
      {
        timezone: "Asia/Kolkata",
      }
    );

console.log("🕒 EMI expiry notification cron job started (daily 12.00 AM IST)");