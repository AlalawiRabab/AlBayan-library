-- These legacy SECURITY DEFINER helpers return administrator-only data.
-- The browser now reaches them through the authenticated Edge Function gateway.
REVOKE ALL ON FUNCTION public.admin_get_classrooms() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_classrooms() TO service_role;

REVOKE ALL ON FUNCTION public.admin_get_grade_submissions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_grade_submissions(integer) TO service_role;
