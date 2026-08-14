-- Grade labels are public portal metadata, but changes must come from the
-- protected admin Edge Function rather than the browser's anonymous key.
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.grades FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.grades TO anon, authenticated;
GRANT ALL ON TABLE public.grades TO service_role;

CREATE POLICY "Grades are publicly readable"
ON public.grades
FOR SELECT
TO anon, authenticated
USING (true);
