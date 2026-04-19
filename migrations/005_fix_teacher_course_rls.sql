-- Fix teacher course RLS policies for dashboard create/update/select flows
-- Run this migration in Supabase after 004_teacher_courses.sql

ALTER TABLE public.teacher_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_course_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published courses" ON public.teacher_courses;
DROP POLICY IF EXISTS "Teachers can insert own courses" ON public.teacher_courses;
DROP POLICY IF EXISTS "Teachers can update own courses" ON public.teacher_courses;
DROP POLICY IF EXISTS "Teachers can delete own courses" ON public.teacher_courses;
DROP POLICY IF EXISTS "Teachers can view own courses" ON public.teacher_courses;

CREATE POLICY "Anyone can view published courses"
  ON public.teacher_courses
  FOR SELECT
  USING (
    status = 'published' OR teacher_id = auth.uid()
  );

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

DROP POLICY IF EXISTS "Teachers can view own lessons" ON public.teacher_course_lessons;
DROP POLICY IF EXISTS "Teachers can insert own lessons" ON public.teacher_course_lessons;
DROP POLICY IF EXISTS "Teachers can update own lessons" ON public.teacher_course_lessons;
DROP POLICY IF EXISTS "Teachers can delete own lessons" ON public.teacher_course_lessons;

CREATE POLICY "Teachers can view own lessons"
  ON public.teacher_course_lessons
  FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own lessons"
  ON public.teacher_course_lessons
  FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own lessons"
  ON public.teacher_course_lessons
  FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own lessons"
  ON public.teacher_course_lessons
  FOR DELETE
  USING (teacher_id = auth.uid());
