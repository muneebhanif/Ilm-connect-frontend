-- Migration: Add progress tracking fields to students table
-- This enables dynamic progress tracking for each child

-- Add progress tracking columns to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS surahs_memorized INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tajweed_mastery INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_classes_attended INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_stars_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_class_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS learning_goals TEXT[];

-- Create student_achievements table for badges and achievements
CREATE TABLE IF NOT EXISTS public.student_achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  achievement_type TEXT NOT NULL, -- 'badge', 'milestone', 'certificate'
  achievement_name TEXT NOT NULL,
  achievement_icon TEXT,
  achievement_description TEXT,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create student_progress_history table for tracking progress over time
CREATE TABLE IF NOT EXISTS public.student_progress_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  progress_type TEXT NOT NULL, -- 'surah', 'tajweed', 'attendance'
  progress_value INTEGER NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recorded_by UUID REFERENCES public.profiles(id), -- teacher who recorded it
  notes TEXT
);

-- Create student_surah_progress for detailed Quran memorization tracking
CREATE TABLE IF NOT EXISTS public.student_surah_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  surah_number INTEGER NOT NULL CHECK (surah_number >= 1 AND surah_number <= 114),
  surah_name TEXT NOT NULL,
  memorization_status TEXT CHECK (memorization_status IN ('not_started', 'in_progress', 'memorized', 'revised')) DEFAULT 'not_started',
  tajweed_score INTEGER CHECK (tajweed_score >= 0 AND tajweed_score <= 100),
  last_reviewed TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  UNIQUE(student_id, surah_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_achievements_student ON student_achievements(student_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_history_student ON student_progress_history(student_id);
CREATE INDEX IF NOT EXISTS idx_student_surah_progress_student ON student_surah_progress(student_id);

-- RLS Policies
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_surah_progress ENABLE ROW LEVEL SECURITY;

-- Allow parents to view their children's achievements
CREATE POLICY "Parents can view their children's achievements" ON public.student_achievements
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM public.students WHERE parent_id = auth.uid()
    )
  );

-- Allow teachers to insert achievements for students they teach
CREATE POLICY "Teachers can add achievements" ON public.student_achievements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'
    )
  );

-- Similar policies for progress history
CREATE POLICY "Parents can view children's progress" ON public.student_progress_history
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM public.students WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can add progress" ON public.student_progress_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'
    )
  );

-- Surah progress policies
CREATE POLICY "Parents can view children's surah progress" ON public.student_surah_progress
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM public.students WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can manage surah progress" ON public.student_surah_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'
    )
  );
