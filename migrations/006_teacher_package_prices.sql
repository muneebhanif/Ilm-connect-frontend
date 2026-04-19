-- Add teacher-configurable package prices for booking bundles
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS weekly_package_price numeric;

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS monthly_package_price numeric;

UPDATE public.teachers
SET weekly_package_price = COALESCE(weekly_package_price, 0)
WHERE weekly_package_price IS NULL;

UPDATE public.teachers
SET monthly_package_price = COALESCE(monthly_package_price, 0)
WHERE monthly_package_price IS NULL;

ALTER TABLE public.teachers
  ALTER COLUMN weekly_package_price SET DEFAULT 0,
  ALTER COLUMN weekly_package_price SET NOT NULL,
  ALTER COLUMN monthly_package_price SET DEFAULT 0,
  ALTER COLUMN monthly_package_price SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teachers'
      AND column_name = 'weekly_package_price'
  ) THEN
    RAISE EXCEPTION 'weekly_package_price column was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teachers_weekly_package_price_nonnegative'
  ) THEN
    ALTER TABLE public.teachers
      ADD CONSTRAINT teachers_weekly_package_price_nonnegative
      CHECK (weekly_package_price >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teachers'
      AND column_name = 'monthly_package_price'
  ) THEN
    RAISE EXCEPTION 'monthly_package_price column was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teachers_monthly_package_price_nonnegative'
  ) THEN
    ALTER TABLE public.teachers
      ADD CONSTRAINT teachers_monthly_package_price_nonnegative
      CHECK (monthly_package_price >= 0);
  END IF;
END $$;
