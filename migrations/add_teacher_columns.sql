-- Migration: Add missing columns to teachers table
-- Date: 2025-11-22
-- Description: Adds gender, languages, rating, and created_at columns to teachers table

-- Add missing columns to teachers table
ALTER TABLE public.teachers 
ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('Male', 'Female', 'male', 'female')),
ADD COLUMN IF NOT EXISTS languages text[],
ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- Update existing rows to have default values
UPDATE public.teachers 
SET rating = 0 
WHERE rating IS NULL;

UPDATE public.teachers 
SET created_at = timezone('utc'::text, now()) 
WHERE created_at IS NULL;

-- Make created_at NOT NULL after setting default values
ALTER TABLE public.teachers 
ALTER COLUMN created_at SET NOT NULL;
