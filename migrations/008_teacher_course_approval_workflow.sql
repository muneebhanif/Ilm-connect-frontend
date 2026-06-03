-- Add an explicit admin approval state for teacher-uploaded courses.
-- Teachers submit courses as pending_review; admins publish approved courses.

ALTER TABLE public.teacher_courses
  DROP CONSTRAINT IF EXISTS teacher_courses_status_check;

ALTER TABLE public.teacher_courses
  ADD CONSTRAINT teacher_courses_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text,
    'pending_review'::text,
    'published'::text,
    'archived'::text
  ]));

CREATE INDEX IF NOT EXISTS idx_teacher_courses_pending_review
  ON public.teacher_courses(created_at DESC)
  WHERE status = 'pending_review';

DROP POLICY IF EXISTS "Anyone can view published courses" ON public.teacher_courses;
DROP POLICY IF EXISTS "Teachers can update own courses" ON public.teacher_courses;
DROP POLICY IF EXISTS "Teachers and admins can update courses" ON public.teacher_courses;

CREATE POLICY "Anyone can view published courses"
  ON public.teacher_courses
  FOR SELECT
  USING (
    status = 'published'
    OR teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Teachers and admins can update courses"
  ON public.teacher_courses
  FOR UPDATE
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
