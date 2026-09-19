-- REVIEW ONLY — do not apply to production until approved.
-- Admin-safe classroom listing for /admin/grades (display + rename).
-- Does not create classrooms or mutate teacher/student/story links.
-- Requires admin_access_code verified inside SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.admin_list_classrooms(admin_access_code text)
RETURNS TABLE(
  classroom_id uuid,
  classroom_name text,
  grade integer,
  teacher_name text,
  students_count bigint,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  admin_id uuid;
BEGIN
  IF admin_access_code IS NULL OR btrim(admin_access_code) = '' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT a.id
  INTO admin_id
  FROM public.admins AS a
  WHERE a.access_code = btrim(admin_access_code)
    AND a.is_active = true;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    c.id AS classroom_id,
    c.name AS classroom_name,
    c.grade,
    t.name AS teacher_name,
    (
      SELECT COUNT(*)::bigint
      FROM public.student_classrooms AS sc
      WHERE sc.classroom_id = c.id
    ) AS students_count,
    c.is_active,
    c.created_at
  FROM public.classrooms AS c
  LEFT JOIN public.teachers AS t ON t.id = c.teacher_id
  ORDER BY c.grade ASC NULLS LAST, c.name ASC, c.created_at ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_classrooms(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_classrooms(text) TO anon, authenticated;
