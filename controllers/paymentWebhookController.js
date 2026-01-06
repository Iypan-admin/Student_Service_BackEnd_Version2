// controllers/paymentWebhookController.js
const crypto = require("crypto");
const Razorpay = require("razorpay");
const supabaseAdmin = require('../config/supabaseClient');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
});

exports.razorpayWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers["x-razorpay-signature"];
        const rawBody = req.body; // express.raw middleware must be used in route

        console.log("✅ Webhook hit:", signature);
        console.log(
            "✅ Raw body type:",
            rawBody && rawBody.constructor ? rawBody.constructor.name : typeof rawBody
        );
        console.log(
            "✅ Raw body preview:",
            rawBody?.toString ? rawBody.toString().slice(0, 2000) : rawBody
        );
        console.log(
            "✅ Supabase key starts with:",
            process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 5)
        );

        if (!secret || !signature) {
            console.error("❌ Missing webhook secret or signature header");
            return res.status(400).send("Bad Request");
        }

        // ✅ Verify Razorpay signature
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(rawBody)
            .digest("hex");

        if (signature !== expectedSignature) {
            console.error("❌ Invalid Razorpay signature");
            return res.status(400).send("Invalid signature");
        }

        const body = JSON.parse(rawBody.toString());
        const event = body.event;

        if (event !== "payment.captured") {
            console.log("ℹ️ Webhook event ignored:", event);
            return res.status(200).send("ignored");
        }

        const paymentEntity = body.payload?.payment?.entity;
        const paymentId = paymentEntity?.id;

        if (!paymentId) {
            console.error("❌ payment.captured webhook missing payment_id");
            return res.status(200).send("missing payment id");
        }

        try {
            const payment = await razorpay.payments.fetch(paymentId);

            const {
                registration_number,
                student_name,
                email,
                contact,
                course_name,
                course_duration,
                original_fees,
                discount_percentage,
                final_fees,
                payment_type,
                emi_duration,
                current_emi,
            } = payment.notes || {};

            const bank_rrn =
                payment.acquirer_data?.rrn ||
                payment.acquirer_data?.upi_transaction_id ||
                null;

            const record = {
                registration_number,
                student_name,
                email,
                contact,
                course_name,
                course_duration: Number(course_duration) || 0,
                original_fees: Number(original_fees) || 0,
                discount_percentage: Number(discount_percentage) || 0,
                final_fees: Number(final_fees) || 0,
                payment_type: payment_type || "full",
                emi_duration: payment_type === "emi" ? Number(emi_duration) : null,
                current_emi: payment_type === "emi" ? Number(current_emi) : null,
                enrollment_id: payment.notes?.enrollment_id || null,
                payment_id: payment.id,
                order_id: payment.order_id,
                bank_rrn,
                status: false, // pending admin verification
            };

            const { data: existing, error: existingError } = await supabaseAdmin
                .from("student_course_payment")
                .select("payment_id")
                .eq("payment_id", payment.id)
                .maybeSingle();

            if (existingError) {
                console.error("❌ Supabase lookup error (webhook):", existingError);
            }

            if (existing) {
                console.log("ℹ️ Payment already recorded, skipping insert:", {
                    payment_id: existing.payment_id,
                });
            } else {
                const { data, error } = await supabaseAdmin
                    .from("student_course_payment")
                    .insert([record])
                    .select();

                console.log("✅ DB insert data:", data);

                if (error) {
                    if (error.code === "23505") {
                        console.log("ℹ️ Duplicate payment ignored by unique constraint:", {
                            payment_id: record.payment_id,
                        });
                    } else {
                        console.error("❌ Supabase insert error (webhook):", error);
                    }
                } else {
                    console.log("✅ Payment recorded via webhook:", {
                        payment_id: payment.id,
                        order_id: payment.order_id,
                    });
                }
            }
        } catch (err) {
            console.error("❌ Razorpay webhook processing error:", err);
        }

        return res.status(200).send("ok");
    } catch (err) {
        console.error("❌ Webhook processing error:", err);
        return res.status(200).send("error");
    }
};
