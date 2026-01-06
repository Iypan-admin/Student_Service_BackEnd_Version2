-- Migration: Update max_students field in batches table
-- Purpose: Ensure max_students field is properly configured for dynamic seat calculation
-- Date: December 2024
-- Note: max_students column already exists with DEFAULT 10

-- Update comment to explain the field
COMMENT ON COLUMN public.batches.max_students IS 'Maximum number of students allowed in this batch (default: 10)';

-- Optional: Update existing batches that have NULL max_students
-- This ensures all batches have a valid seat limit
UPDATE public.batches 
SET max_students = 10 
WHERE max_students IS NULL;

-- Add check constraint to ensure max_students is positive (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_max_students_positive'
  ) THEN
    ALTER TABLE public.batches 
    ADD CONSTRAINT check_max_students_positive 
    CHECK (max_students > 0);
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_batches_max_students 
ON public.batches(max_students);

CREATE INDEX IF NOT EXISTS idx_batches_center 
ON public.batches(center);

-- Create index on enrollment table for faster counting
CREATE INDEX IF NOT EXISTS idx_enrollment_batch 
ON public.enrollment(batch);

CREATE INDEX IF NOT EXISTS idx_enrollment_student_batch 
ON public.enrollment(student, batch);

-- Optional: Create a view for easy seat availability checking
CREATE OR REPLACE VIEW public.batch_seat_availability AS
SELECT 
  b.batch_id,
  b.batch_name,
  b.max_students,
  COALESCE(COUNT(e.enrollment_id), 0) AS enrolled_students,
  b.max_students - COALESCE(COUNT(e.enrollment_id), 0) AS available_seats,
  CASE 
    WHEN COALESCE(COUNT(e.enrollment_id), 0) >= b.max_students THEN true 
    ELSE false 
  END AS is_full
FROM public.batches b
LEFT JOIN public.enrollment e ON b.batch_id = e.batch
GROUP BY b.batch_id, b.batch_name, b.max_students;

-- Add comment to the view
COMMENT ON VIEW public.batch_seat_availability IS 
'Real-time view of seat availability for all batches. Shows enrolled count, available seats, and full status.';

COMMIT;

