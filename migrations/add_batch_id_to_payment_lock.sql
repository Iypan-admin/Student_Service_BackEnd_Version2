-- ============================================
-- Migration: Add batch_id to student_payment_lock
-- Purpose: Enable per-batch payment locking instead of per-student
-- Date: 2025-10-15
-- ============================================

-- Step 1: Add batch_id column (nullable for backward compatibility)
ALTER TABLE student_payment_lock 
ADD COLUMN IF NOT EXISTS batch_id UUID;

-- Step 2: Add foreign key constraint to batches table
ALTER TABLE student_payment_lock
ADD CONSTRAINT fk_payment_lock_batch
FOREIGN KEY (batch_id) 
REFERENCES batches(batch_id) 
ON DELETE CASCADE;

-- Step 3: Drop old unique constraint (if exists)
-- Note: Adjust constraint name if different in your database
ALTER TABLE student_payment_lock 
DROP CONSTRAINT IF EXISTS student_payment_lock_register_number_key;

ALTER TABLE student_payment_lock 
DROP CONSTRAINT IF EXISTS student_payment_lock_pkey;

-- Step 4: Add new unique constraint for (register_number, batch_id)
-- This allows:
-- - Same student to lock different payment types for different batches
-- - Only one lock per student per batch
ALTER TABLE student_payment_lock
ADD CONSTRAINT student_payment_lock_unique_per_batch 
UNIQUE (register_number, batch_id);

-- Step 5: Create index for performance
CREATE INDEX IF NOT EXISTS idx_payment_lock_batch 
ON student_payment_lock(batch_id);

CREATE INDEX IF NOT EXISTS idx_payment_lock_register 
ON student_payment_lock(register_number);

-- Step 6: Add comments for documentation
COMMENT ON COLUMN student_payment_lock.batch_id IS 
'Batch ID for per-batch payment locking. NULL for legacy global locks.';

COMMENT ON CONSTRAINT student_payment_lock_unique_per_batch ON student_payment_lock IS 
'Ensures one payment lock per student per batch. Allows different lock types for different batches.';

-- ============================================
-- Migration Complete
-- ============================================

-- Verification Query:
-- SELECT * FROM student_payment_lock ORDER BY register_number, batch_id;

-- Example Data After Migration:
-- | register_number | batch_id  | payment_type |
-- |-----------------|-----------|--------------|
-- | REG123          | batch_001 | full         | ← Batch A locked to full
-- | REG123          | batch_002 | emi          | ← Batch B locked to emi
-- | REG123          | batch_003 | NULL         | ← Batch C not locked yet (no record)
-- | REG123          | NULL      | full         | ← Legacy global lock (if any)
























