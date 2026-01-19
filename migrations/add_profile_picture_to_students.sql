-- Migration: Add profile_picture column to students table
-- Purpose: Store student profile picture URL
-- Date: January 2025

-- Add profile_picture column to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Add comment for documentation
COMMENT ON COLUMN students.profile_picture IS 'URL of the student profile picture stored in Supabase storage (user-profiles bucket)';

