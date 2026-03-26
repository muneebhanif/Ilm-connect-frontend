-- Migration: Add subjects_interested to students table
-- Date: 2025-11-22

ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS subjects_interested text[];
