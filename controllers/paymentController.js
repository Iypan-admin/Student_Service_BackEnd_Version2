const supabase = require("../config/supabaseClient");
const crypto = require("crypto");


// ✅ Process a New Payment (Manual Entry by Student)
const makePayment = async (req, res) => {
    const { enrollment_id, amount, payment_type, current_emi } = req.body;
    const student = req.student; // contains registration_number, name, email, contact

    if (!enrollment_id || !amount || !payment_type) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    try {
        // 🔹 Insert into student_course_payment
        const { data, error } = await supabase
            .from("student_course_payment")
            .insert([
                {
                    registration_number: student.registration_number,
                    student_name: student.name,
                    email: student.email,
                    contact: student.contact,
                    course_name: req.body.course_name || "Unknown Course",
                    course_duration: req.body.course_duration || 0,
                    original_fees: req.body.original_fees || amount,
                    discount_percentage: req.body.discount_percentage || 0,
                    final_fees: amount,
                    payment_type: payment_type, // "full" or "emi"
                    emi_duration: payment_type === "emi" ? req.body.emi_duration : null,
                    current_emi: payment_type === "emi" ? current_emi : null,
                    payment_id: "manual-" + new Date().getTime(), // unique placeholder ID
                    order_id: "manual-" + new Date().getTime(),
                    status: false, // admin approval pending
                    enrollment_id: enrollment_id,
                },
            ])
            .select();

        if (error) throw error;

        res.status(201).json({ success: true, message: "Payment recorded", data });
    } catch (err) {
        res.status(500).json({ error: "Payment failed", details: err.message });
    }
};


const getTransactions = async (req, res) => {
    const student_id = req.student.student_id;

    try {
        // 🔹 Fetch registration_number from student table using student_id
        const { data: studentData, error: studentErr } = await supabase
            .from("students")
            .select("registration_number")
            .eq("student_id", student_id)
            .single();

        if (studentErr || !studentData) throw new Error("Student not found");

        const registration_number = studentData.registration_number;

        const { data, error } = await supabase
            .from("student_course_payment")
            .select("*")
            .eq("registration_number", registration_number)
            .order("created_at", { ascending: false });

        if (error) throw error;

        res.json({ transactions: data });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch transactions", details: err.message });
    }
};


// ✅ Razorpay Webhook (Auto Insert on Payment Success)
const razorpayWebhook = async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    try {
        // 1️⃣ Verify Razorpay signature
        const shasum = crypto.createHmac("sha256", secret);
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest("hex");

        if (digest !== req.headers["x-razorpay-signature"]) {
            console.error("❌ Invalid Razorpay signature");
            // ✅ Still respond 200 to prevent webhook disable
            return res.status(200).json({ error: "Invalid signature" });
        }

        // ✅ Acknowledge Razorpay immediately
        res.status(200).json({ message: "Webhook received" });

        const payload = req.body;
        const transaction_id = payload.payload.payment.entity.id;
        const enrollment_id = payload.payload.payment.entity.notes.enrollment_id;

        if (!enrollment_id) {
            console.error("❌ Missing enrollment_id in Razorpay notes.");
            return; // already sent 200 OK
        }

        // 🔹 Insert DB in background
        process.nextTick(async () => {
            try {
                // Find last duration
                const { data: lastPayment } = await supabase
                    .from("transactions")
                    .select("duration")
                    .eq("enrollment_id", enrollment_id)
                    .order("duration", { ascending: false })
                    .limit(1);

                let nextDuration = 1;
                if (lastPayment && lastPayment.length > 0) {
                    nextDuration = lastPayment[0].duration + 1;
                }

                // Insert transaction
                const { data, error } = await supabase
                    .from("transactions")
                    .insert([
                        {
                            enrollment_id,
                            transaction_id,
                            duration: nextDuration,
                            status: false,
                        },
                    ])
                    .select();

                if (error) console.error("❌ Supabase insert error:", error);
                else console.log("✅ Payment recorded via Razorpay");
            } catch (err) {
                console.error("❌ Background DB error:", err);
            }
        });
    } catch (err) {
        console.error("❌ Webhook processing error:", err);
        // ✅ Still respond 200 to Razorpay
        res.status(200).json({ error: "Webhook error logged" });
    }
};

module.exports = { makePayment, getTransactions, razorpayWebhook };
