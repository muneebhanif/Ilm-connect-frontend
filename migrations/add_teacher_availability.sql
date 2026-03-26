-- Migration: Add availability to teachers table
-- Date: 2025-11-22

ALTER TABLE public.teachers 
ADD COLUMN IF NOT EXISTS availability jsonb DEFAULT '{}'::jsonb;
