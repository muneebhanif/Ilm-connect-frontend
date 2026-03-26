-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.class_sessions(id),
  CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.class_sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  course_id uuid NOT NULL,
  session_date timestamp with time zone NOT NULL,
  duration_minutes integer,
  status text DEFAULT 'upcoming'::text CHECK (status = ANY (ARRAY['upcoming'::text, 'completed'::text, 'cancelled'::text])),
  channel_name text,
  meeting_url text,
  live_status text DEFAULT 'scheduled'::text CHECK (live_status = ANY (ARRAY['scheduled'::text, 'live'::text, 'ended'::text])),
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  CONSTRAINT class_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT class_sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  last_message_at timestamp with time zone DEFAULT now(),
  last_message_preview text,
  unread_count_parent integer DEFAULT 0,
  unread_count_teacher integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id),
  CONSTRAINT conversations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  instructor_id uuid NOT NULL,
  price numeric NOT NULL,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.enrollments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  enrolled_date timestamp with time zone DEFAULT timezone('utc'::text, now()),
  payment_status text DEFAULT 'pending'::text CHECK (payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text])),
  CONSTRAINT enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id),
  CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.parents (
  id uuid NOT NULL,
  phone_number text,
  timezone text,
  location text,
  CONSTRAINT parents_pkey PRIMARY KEY (id),
  CONSTRAINT parents_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  enrollment_id uuid NOT NULL,
  amount numeric NOT NULL,
  method text NOT NULL CHECK (method = ANY (ARRAY['card'::text, 'easypaisa'::text, 'jazzcash'::text, 'bank'::text])),
  transaction_id text UNIQUE,
  status text DEFAULT 'successful'::text CHECK (status = ANY (ARRAY['successful'::text, 'failed'::text, 'refunded'::text])),
  paid_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'parent'::text CHECK (role = ANY (ARRAY['parent'::text, 'teacher'::text, 'admin'::text])),
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  session_id uuid,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id),
  CONSTRAINT reviews_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.profiles(id),
  CONSTRAINT reviews_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.class_sessions(id)
);
CREATE TABLE public.student_achievements (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  achievement_type text NOT NULL,
  achievement_name text NOT NULL,
  achievement_icon text,
  achievement_description text,
  earned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_achievements_pkey PRIMARY KEY (id),
  CONSTRAINT student_achievements_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  parent_id uuid NOT NULL,
  name text NOT NULL,
  age integer,
  gender text CHECK (gender = ANY (ARRAY['male'::text, 'female'::text])),
  learning_level text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  subjects_interested ARRAY,
  surahs_memorized integer DEFAULT 0,
  tajweed_mastery integer DEFAULT 0,
  total_classes_attended integer DEFAULT 0,
  total_stars_earned integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_class_date timestamp with time zone,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id)
);
CREATE TABLE public.teachers (
  id uuid NOT NULL,
  bio text,
  hourly_rate numeric,
  subjects ARRAY,
  verification_status text DEFAULT 'pending'::text CHECK (verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])),
  intro_video_url text,
  gender text CHECK (gender = ANY (ARRAY['Male'::text, 'Female'::text, 'male'::text, 'female'::text])),
  languages ARRAY,
  rating numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  availability jsonb DEFAULT '{}'::jsonb,
  phone_number text,
  documents jsonb DEFAULT '[]'::jsonb,
  timezone text,
  CONSTRAINT teachers_pkey PRIMARY KEY (id),
  CONSTRAINT teachers_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id)
);