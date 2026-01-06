// controllers/razorpayController.js
const Razorpay = require("razorpay");
const crypto = require("crypto");
require("dotenv").config();
const supabaseAdmin = require("../config/supabaseClient");

// Initialize Razorpay client
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
});

// ---------------- CREATE ORDER ----------------
const createOrder = async (req, res) => {
    try {
        const {
            final_fees,
            registration_number,
            student_name,
            email,
            contact,
            course_name,
            course_duration,
            original_fees,
            discount_percentage,
            payment_type,
            emi_duration,
            current_emi,
            enrollment_id
        } = req.body;

        if (!final_fees) {
            return res.status(400).json({ success: false, message: "Final fees is required" });
        }

        const options = {
            amount: Math.round(final_fees * 100), // in paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
            notes: {
                enrollment_id,
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
            }
        };

        const order = await razorpay.orders.create(options);

        console.log("✅ Razorpay order created:", order.id);

        return res.status(200).json({
            success: true,
            order,
            key: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error("❌ Razorpay order error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Order creation failed",
        });
    }
};

// ---------------- VERIFY PAYMENT ----------------
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // ✅ Verify Signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            console.error("❌ Invalid signature");
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        console.log("✅ Payment verified successfully");

        // ✅ Fetch Order (for notes)
        const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
        const notes = orderDetails.notes || {};
        console.log("🟢 Notes from Razorpay order:", notes);

        // ✅ Fetch Payment (for bank_rrn)
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        console.log("🟢 Razorpay payment details:", paymentDetails);

        const {
            enrollment_id,
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
            current_emi
        } = notes;

        console.log("🟢 enrollment_id type:", typeof enrollment_id, "value:", enrollment_id);

        // ✅ Bank RRN fallback for Wallet / UPI
        const bank_rrn =
            paymentDetails.acquirer_data?.rrn ||
            paymentDetails.acquirer_data?.upi_transaction_id ||
            null;

        // ✅ Insert into Supabase (only student_course_payment)
        const { data: existing, error: lookupError } = await supabaseAdmin
            .from("student_course_payment")
            .select("*")
            .eq("payment_id", razorpay_payment_id)
            .maybeSingle();

        if (lookupError) {
            console.error("❌ Supabase lookup error:", lookupError);
        }

        let paymentRecord = existing ? [existing] : null;

        if (!existing) {
            const { data, error } = await supabaseAdmin
                .from("student_course_payment")
                .insert([{
                    enrollment_id,
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
                    payment_id: razorpay_payment_id,
                    order_id: razorpay_order_id,
                    bank_rrn,
                    status: false, // ✅ boolean false
                }])
                .select();

            if (error) {
                if (error.code === "23505") {
                    console.log("ℹ️ Duplicate payment detected during verify, continuing:", {
                        payment_id: razorpay_payment_id,
                    });
                        const { data: existingAfter, error: fetchError } = await supabaseAdmin
                            .from("student_course_payment")
                            .select("*")
                            .eq("payment_id", razorpay_payment_id)
                            .maybeSingle();
                        if (fetchError) {
                            console.error("❌ Supabase fetch error after duplicate:", fetchError);
                        } else if (existingAfter) {
                            paymentRecord = [existingAfter];
                        }
                } else {
                    console.error("❌ Supabase insert error:", error.message, error.details);
                    return res.status(500).json({ success: false, message: "DB insert failed" });
                }
            } else {
                console.log("✅ Payment stored in DB via verify:", data);
                    paymentRecord = data;
            }
        } else {
            console.log("ℹ️ Payment already stored, skipping insert:", {
                payment_id: razorpay_payment_id,
            });
        }

        return res.json({
            success: true,
            message: "Payment verified & stored",
            payment: paymentRecord
        });
    } catch (error) {
        console.error("❌ Verify Payment Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

module.exports = { createOrder, verifyPayment };
