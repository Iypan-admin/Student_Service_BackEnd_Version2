-- ============================================
-- QUICK FIX: Production student_payment_lock Table
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop the old unique constraint that prevents per-batch locking
-- This is the MAIN issue causing 500 errors
ALTER TABLE public.student_payment_lock 
DROP CONSTRAINT IF EXISTS student_payment_lock_register_number_key;

-- Step 2: Ensure batch_id column exists
ALTER TABLE public.student_payment_lock 
ADD COLUMN IF NOT EXISTS batch_id UUID NULL;

-- Step 3: Add foreign key (if not exists)
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

-- Step 5: Rename locked_at to created_at (optional, but recommended)
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
    END IF;
END $$;

-- Step 6: Add created_at if it doesn't exist
ALTER TABLE public.student_payment_lock 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 7: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_lock_batch 
ON public.student_payment_lock(batch_id);

CREATE INDEX IF NOT EXISTS idx_payment_lock_register 
ON public.student_payment_lock(register_number);

-- Done! The table should now work with the code.



