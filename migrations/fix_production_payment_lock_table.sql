-- ============================================
-- Migration: Fix Production student_payment_lock Table
-- Purpose: Update production table to match code expectations
-- Date: 2025-01-XX
-- ============================================

-- Step 1: Drop old unique constraint on register_number alone (if exists)
-- This allows per-batch locking (same student can lock different batches)
-- IMPORTANT: This is the main fix - the old constraint prevents per-batch locking
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'student_payment_lock_register_number_key'
    ) THEN
        ALTER TABLE public.student_payment_lock 
        DROP CONSTRAINT student_payment_lock_register_number_key;
        RAISE NOTICE 'Dropped old unique constraint on register_number';
    ELSE
        RAISE NOTICE 'Old unique constraint on register_number does not exist';
    END IF;
END $$;

-- Step 2: Ensure batch_id column exists (should already exist, but safe to add)
ALTER TABLE public.student_payment_lock 
ADD COLUMN IF NOT EXISTS batch_id UUID NULL;

-- Step 3: Add foreign key constraint for batch_id (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_payment_lock_batch'
    ) THEN
        ALTER TABLE public.student_payment_lock
        ADD CONSTRAINT fk_payment_lock_batch
        FOREIGN KEY (batch_id) 
        REFERENCES public.batches(batch_id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Step 4: Ensure unique constraint on (register_number, batch_id) exists
-- This allows same student to have different locks for different batches
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'student_payment_lock_unique_per_batch'
    ) THEN
        ALTER TABLE public.student_payment_lock
        ADD CONSTRAINT student_payment_lock_unique_per_batch 
        UNIQUE (register_number, batch_id);
    END IF;
END $$;

-- Step 5: Rename locked_at to created_at (if locked_at exists and created_at doesn't)
-- The code doesn't explicitly use this column, but it's good practice to have created_at
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'student_payment_lock' 
        AND column_name = 'locked_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'student_payment_lock' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.student_payment_lock 
        RENAME COLUMN locked_at TO created_at;
        RAISE NOTICE 'Renamed locked_at to created_at';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'student_payment_lock' 
        AND column_name = 'locked_at'
    ) THEN
        -- Both columns exist, drop locked_at
        ALTER TABLE public.student_payment_lock 
        DROP COLUMN locked_at;
        RAISE NOTICE 'Dropped locked_at column (created_at already exists)';
    ELSE
        RAISE NOTICE 'locked_at column does not exist, skipping rename';
    END IF;
END $$;

-- Step 6: Add created_at column if it doesn't exist (backup in case rename didn't work)
ALTER TABLE public.student_payment_lock 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 7: Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_payment_lock_batch 
ON public.student_payment_lock(batch_id);

CREATE INDEX IF NOT EXISTS idx_payment_lock_register 
ON public.student_payment_lock(register_number);

CREATE INDEX IF NOT EXISTS idx_payment_lock_created_at 
ON public.student_payment_lock(created_at DESC);

-- Step 8: Update existing rows to have created_at if NULL
UPDATE public.student_payment_lock 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- Step 9: Add comments for documentation
COMMENT ON COLUMN public.student_payment_lock.batch_id IS 
'Batch ID for per-batch payment locking. NULL for legacy global locks.';

COMMENT ON COLUMN public.student_payment_lock.created_at IS 
'Timestamp when the payment lock was created.';

COMMENT ON CONSTRAINT student_payment_lock_unique_per_batch ON public.student_payment_lock IS 
'Ensures one payment lock per student per batch. Allows different lock types for different batches.';

-- ============================================
-- Verification Queries
-- ============================================

-- Check table structure
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
-- AND table_name = 'student_payment_lock'
-- ORDER BY ordinal_position;

-- Check constraints
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_schema = 'public' 
-- AND table_name = 'student_payment_lock';

-- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public' 
-- AND tablename = 'student_payment_lock';

-- ============================================
-- Migration Complete
-- ============================================

-- Expected Final Table Structure:
-- id: UUID (primary key)
-- register_number: TEXT (not null)
-- payment_type: TEXT (not null, check: 'full' or 'emi')
-- batch_id: UUID (nullable, foreign key to batches)
-- created_at: TIMESTAMP WITH TIME ZONE (default NOW())
-- 
-- Constraints:
-- - PRIMARY KEY (id)
-- - UNIQUE (register_number, batch_id)
-- - FOREIGN KEY (batch_id) REFERENCES batches(batch_id) ON DELETE CASCADE
-- - CHECK (payment_type IN ('full', 'emi'))
--
-- Indexes:
-- - idx_payment_lock_batch (on batch_id)
-- - idx_payment_lock_register (on register_number)
-- - idx_payment_lock_created_at (on created_at DESC)

