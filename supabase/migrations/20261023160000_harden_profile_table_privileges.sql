-- Keep profile table privileges least-privilege even when default table
-- privileges on a project grant broad access to newly created tables.
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
