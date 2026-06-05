-- Allow authenticated users to read their own profile when the row matches
-- either auth.uid() or the auth email. This keeps manual admin profile rows
-- usable even if they were created by email before the exact auth id was copied.

DROP POLICY IF EXISTS profiles_select_own_id_or_email ON profiles;

CREATE POLICY profiles_select_own_id_or_email ON profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
