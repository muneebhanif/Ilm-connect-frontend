-- Cleanup confirmed-unused schema objects.
-- Safe removals based on current codebase usage audit:
-- 1. profiles.is_admin duplicates profiles.role = 'admin' and is not referenced by app/backend code.
-- 2. todos table is not referenced anywhere in the app/backend code.

BEGIN;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS is_admin;

DROP TABLE IF EXISTS public.todos;

COMMIT;
