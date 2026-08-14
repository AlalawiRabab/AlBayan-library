-- Pin object resolution for the remaining service-only SECURITY DEFINER helpers.
ALTER FUNCTION public.admin_get_classrooms()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.admin_get_grade_submissions(integer)
  SET search_path = public, pg_temp;
