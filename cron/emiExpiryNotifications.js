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

          console.log(`🔍 Checking for EMI payments due soon...`);

          // 1️⃣ Get all EMI payments with next_emi_due_date
          const { data: payments, error: paymentFetchError } = await supabase
            .from("student_course_payment")
            .select(`
              payment_id,
              enrollment_id,
              payment_type,
              next_emi_due_date,
              current_emi,
              emi_duration,
              enrollment:enrollment!student_course_payment_enrollment_id_fkey(
                student,
                batch:batches!enrollment_batch_fkey(
                  batch_name,
                  course:courses!batches_course_id_fkey(course_name)
                )
              )
            `)
            .eq("payment_type", "emi")
            .not("next_emi_due_date", "is", null)
            .eq("status", true); // Only approved payments

          if (paymentFetchError) {
            console.error("❌ Error fetching EMI payments:", paymentFetchError);
            return;
          }

          if (!payments || payments.length === 0) {
            console.log("ℹ️ No EMI payments with due dates found.");
            return;
          }

          // 2️⃣ Loop through each payment
          for (const payment of payments) {
            if (!payment.next_emi_due_date || !payment.enrollment) continue;

            const dueDate = new Date(payment.next_emi_due_date);
            dueDate.setUTCHours(0, 0, 0, 0); // reset time in UTC
            const diffDays = Math.ceil(
              (dueDate - today) / (1000 * 60 * 60 * 24)
            );

            // Only notify if 1, 2, or 3 days remaining
            if (![1, 2, 3].includes(diffDays)) continue;

            // Check if this is the final EMI
            const isFinalEMI = payment.current_emi >= payment.emi_duration;
            if (isFinalEMI) continue; // Skip final EMI - no need for due date notifications

            const studentId = payment.enrollment.student;
            const batchName = payment.enrollment.batch?.batch_name || "your course";
            const courseName = payment.enrollment.batch?.course?.course_name || "course";

            // Format due date in short format (e.g., "Feb 15, 2024")
            const dueDateShort = dueDate.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            });

            // Create styled notification message based on days remaining
            let message = "";
            if (diffDays === 3) {
              message = `⏰ EMI Payment Reminder - 3 Days Left\n\nCourse: ${courseName}\nBatch: ${batchName}\n\nDue Date: ${dueDateShort}\n\nPlease make your payment on or before the due date.`;
            } else if (diffDays === 2) {
              message = `⚠️ EMI Payment Reminder - 2 Days Left\n\nCourse: ${courseName}\nBatch: ${batchName}\n\nDue Date: ${dueDateShort}\n\nPlease make your payment soon to avoid disruption.`;
            } else if (diffDays === 1) {
              message = `🚨 Final Reminder - Payment Due Tomorrow!\n\nCourse: ${courseName}\nBatch: ${batchName}\n\nDue Date: ${dueDateShort}\n\nPlease make your payment immediately.`;
            }

            // Check if notification already sent today for this specific day count
            const startOfDay = today.toISOString();
            const endOfDay = new Date(today);
            endOfDay.setUTCHours(23, 59, 59, 999);

            const { data: existingNotif, error: notifCheckError } =
              await supabase
                .from("notifications")
                .select("*")
                .eq("student", studentId)
                .eq("message", message)
                .gte("created_at", startOfDay)
                .lte("created_at", endOfDay.toISOString());

            if (notifCheckError) {
              console.error(
                "❌ Error checking existing notifications:",
                notifCheckError
              );
              continue;
            }

            if (existingNotif && existingNotif.length > 0) {
              console.log(`⏭️ Notification already sent today for student ${studentId} (${diffDays} days remaining)`);
              continue; // skip if already sent today
            }

            // 3️⃣ Insert notification
            const { error: notifError } = await supabase
              .from("notifications")
              .insert({
                student: studentId,
                message,
                is_read: false
              });

            if (notifError) {
              console.error(
                `❌ Failed to insert notification for student ${studentId}:`,
                notifError
              );
            } else {
              console.log(
                `🔔 Notification sent to student ${studentId} (${diffDays} days until due date: ${dueDateStr})`
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