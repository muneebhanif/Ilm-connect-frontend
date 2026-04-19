-- Migration: Add teacher_courses table for teacher-uploaded course content
-- Run this against your Supabase database

CREATE TABLE IF NOT EXISTS public.teacher_courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  subject text NOT NULL,
  level text NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  thumbnail_url text,
  price numeric NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  total_lessons integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT teacher_courses_pkey PRIMARY KEY (id),
  CONSTRAINT teacher_courses_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Index for faster lookups by teacher
CREATE INDEX IF NOT EXISTS idx_teacher_courses_teacher_id ON public.teacher_courses(teacher_id);

-- Index for browsing published courses
CREATE INDEX IF NOT EXISTS idx_teacher_courses_status ON public.teacher_courses(status);

-- Row Level Security
ALTER TABLE public.teacher_courses ENABLE ROW LEVEL SECURITY;

-- Everyone can read published courses
CREATE POLICY "Anyone can view published courses"
  ON public.teacher_courses
  FOR SELECT
  USING (status = 'published' OR teacher_id = auth.uid());

-- Teachers can manage their own courses
CREATE POLICY "Teachers can insert own courses"
  ON public.teacher_courses
  FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own courses"
  ON public.teacher_courses
  FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own courses"
  ON public.teacher_courses
  FOR DELETE
  USING (teacher_id = auth.uid());
