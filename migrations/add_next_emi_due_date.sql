-- Migration: Add next_emi_due_date column to student_course_payment table
-- Purpose: Store the due date for the next EMI installment
-- Date: December 2024

-- Add next_emi_due_date column to student_course_payment table
ALTER TABLE student_course_payment 
ADD COLUMN IF NOT EXISTS next_emi_due_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN student_course_payment.next_emi_due_date IS 'Due date for the next EMI installment (only for EMI payments)';

-- Create index for performance on EMI due date queries
CREATE INDEX IF NOT EXISTS idx_student_course_payment_next_emi_due_date 
ON student_course_payment(next_emi_due_date) 
WHERE next_emi_due_date IS NOT NULL;











