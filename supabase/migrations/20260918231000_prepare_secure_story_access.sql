-- REVIEW ONLY — do not apply to production until approved.
-- STAGE prepare (after 20260918230000): add secure admin story RPCs + lock client set_user_context.
-- Does NOT revoke table grants or drop legacy admin_get_grade_stories(integer) or RLS policies.
-- Legacy site can keep calling admin_get_grade_stories(grade_num) until enforce migration.

-- ---------------------------------------------------------------------------
-- 1) Lock set_user_context from anon/authenticated/PUBLIC
-- Owner / SECURITY DEFINER callers (e.g. authenticate_user) retain ability.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.set_user_context(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_context(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.set_user_context(uuid, text) FROM authenticated;
-- Intentionally no GRANT EXECUTE to anon/authenticated.

-- ---------------------------------------------------------------------------
-- 2) Secure overload: admin_get_grade_stories(integer, text)
-- Keep legacy admin_get_grade_stories(integer) intact for old deploy compatibility.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_grade_stories(
  grade_num integer,
  admin_access_code text
)
RETURNS TABLE(
  id uuid,
  title_arabic text,
  content_arabic text,
  difficulty text,
  grade_level integer,
  created_at timestamp with time zone,
  author_teacher_id uuid,
  author_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  admin_id uuid;
BEGIN
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
    s.id,
    s.title_arabic,
    s.content_arabic,
    s.difficulty,
    s.grade_level,
    s.created_at,
    s.author_teacher_id,
    COALESCE(t.name, 'غير معروف')::text AS author_name
  FROM public.stories AS s
  LEFT JOIN public.teachers AS t ON t.id = s.author_teacher_id
  WHERE s.grade_level = grade_num
  ORDER BY s.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_grade_stories(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_grade_stories(integer, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_get_story
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_story(
  target_story_id uuid,
  admin_access_code text
)
RETURNS TABLE(
  id uuid,
  title_arabic text,
  content_arabic text,
  difficulty text,
  grade_level integer,
  created_at timestamp with time zone,
  author_teacher_id uuid,
  author_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  admin_id uuid;
BEGIN
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
    s.id,
    s.title_arabic,
    s.content_arabic,
    s.difficulty,
    s.grade_level,
    s.created_at,
    s.author_teacher_id,
    COALESCE(t.name, 'غير معروف')::text AS author_name
  FROM public.stories AS s
  LEFT JOIN public.teachers AS t ON t.id = s.author_teacher_id
  WHERE s.id = target_story_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_story(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_story(uuid, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_create_story
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_story(
  story_title text,
  story_content text,
  story_difficulty text,
  story_grade integer,
  admin_access_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  admin_id uuid;
  cleaned_title text;
  cleaned_content text;
  cleaned_difficulty text;
  author_id uuid;
  new_id uuid;
BEGIN
  SELECT a.id
  INTO admin_id
  FROM public.admins AS a
  WHERE a.access_code = btrim(admin_access_code)
    AND a.is_active = true;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  cleaned_title := btrim(COALESCE(story_title, ''));
  cleaned_content := btrim(COALESCE(story_content, ''));
  cleaned_difficulty := lower(btrim(COALESCE(story_difficulty, '')));

  IF cleaned_title = '' OR char_length(cleaned_title) > 200 THEN
    RAISE EXCEPTION 'Invalid input';
  END IF;

  IF cleaned_content = '' OR char_length(cleaned_content) < 1 THEN
    RAISE EXCEPTION 'Invalid input';
  END IF;

  IF cleaned_difficulty NOT IN ('easy', 'medium', 'hard') THEN
    RAISE EXCEPTION 'Invalid input';
  END IF;

  IF story_grade IS NULL OR story_grade < 1 OR story_grade > 12 THEN
    RAISE EXCEPTION 'Invalid input';
  END IF;

  SELECT t.id
  INTO author_id
  FROM public.teachers AS t
  WHERE t.assigned_grade = story_grade
    AND t.is_active = true
  ORDER BY t.created_at ASC
  LIMIT 1;

  INSERT INTO public.stories (
    title_arabic,
    content_arabic,
    difficulty,
    grade_level,
    author_teacher_id,
    is_active,
    total_reads,
    estimated_reading_minutes
  )
  VALUES (
    cleaned_title,
    cleaned_content,
    cleaned_difficulty,
    story_grade,
    author_id,
    true,
    0,
    GREATEST(1, CEIL(LENGTH(cleaned_content) / 1000.0)::INTEGER)
  )
  RETURNING public.stories.id INTO new_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', new_id,
    'message', 'تم إنشاء القصة بنجاح'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_create_story(text, text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_story(text, text, text, integer, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_update_story (title/content/difficulty only; no author/grade change)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_story(
  target_story_id uuid,
  story_title text,
  story_content text,
  story_difficulty text,
  admin_access_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  admin_id uuid;
  cleaned_title text;
  cleaned_content text;
  cleaned_difficulty text;
  updated_rows integer;
BEGIN
  SELECT a.id
  INTO admin_id
  FROM public.admins AS a
  WHERE a.access_code = btrim(admin_access_code)
    AND a.is_active = true;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  cleaned_title := btrim(COALESCE(story_title, ''));
  cleaned_content := btrim(COALESCE(story_content, ''));
  cleaned_difficulty := lower(btrim(COALESCE(story_difficulty, '')));

  IF cleaned_title = '' OR char_length(cleaned_title) > 200 THEN
    RAISE EXCEPTION 'Invalid input';
  END IF;

  IF cleaned_content = '' THEN
    RAISE EXCEPTION 'Invalid input';
  END IF;

  IF cleaned_difficulty NOT IN ('easy', 'medium', 'hard') THEN
    RAISE EXCEPTION 'Invalid input';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stories AS s WHERE s.id = target_story_id
  ) THEN
    RAISE EXCEPTION 'Not found';
  END IF;

  UPDATE public.stories AS s
  SET
    title_arabic = cleaned_title,
    content_arabic = cleaned_content,
    difficulty = cleaned_difficulty,
    estimated_reading_minutes = GREATEST(1, CEIL(LENGTH(cleaned_content) / 1000.0)::INTEGER),
    updated_at = now()
  WHERE s.id = target_story_id;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'Not found';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم تحديث القصة بنجاح'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_update_story(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_story(uuid, text, text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_delete_story
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_story(
  target_story_id uuid,
  admin_access_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  admin_id uuid;
  deleted_rows integer;
BEGIN
  SELECT a.id
  INTO admin_id
  FROM public.admins AS a
  WHERE a.access_code = btrim(admin_access_code)
    AND a.is_active = true;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.stories AS s
  WHERE s.id = target_story_id;

  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  IF deleted_rows <> 1 THEN
    RAISE EXCEPTION 'Not found';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم حذف القصة بنجاح'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_story(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_story(uuid, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Harden existing admin_get_analytics (same signature; compatible with current UI)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_analytics(admin_access_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  admin_id uuid;
  analytics_data json;
BEGIN
  SELECT a.id
  INTO admin_id
  FROM public.admins AS a
  WHERE a.access_code = btrim(admin_access_code)
    AND a.is_active = true;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'total_students', (SELECT COUNT(*) FROM public.students),
    'total_teachers', (SELECT COUNT(*) FROM public.teachers),
    'total_admins', (SELECT COUNT(*) FROM public.admins),
    'total_stories', (SELECT COUNT(*) FROM public.stories),
    'total_forms', (SELECT COUNT(*) FROM public.form_templates),
    'total_submissions', (SELECT COUNT(*) FROM public.student_submissions),
    'daily_activity', (SELECT COUNT(*) FROM public.activity_logs WHERE DATE(created_at) = CURRENT_DATE),
    'active_students', (SELECT COUNT(*) FROM public.students WHERE is_registered = true),
    'active_teachers', (SELECT COUNT(*) FROM public.teachers WHERE is_active = true),
    'graded_submissions', (SELECT COUNT(*) FROM public.student_submissions WHERE status = 'graded'),
    'pending_submissions', (SELECT COUNT(*) FROM public.student_submissions WHERE status = 'pending'),
    'total_classrooms', (SELECT COUNT(*) FROM public.classrooms WHERE is_active = true),
    'average_grade', (
      SELECT COALESCE(ROUND(AVG(grade)::numeric, 1), 0)
      FROM public.student_submissions
      WHERE grade IS NOT NULL
    ),
    'completion_rate', (
      SELECT CASE
        WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'graded')::numeric / COUNT(*)) * 100)
        ELSE 0
      END
      FROM public.student_submissions
    ),
    'top_performing_grade', (
      SELECT COALESCE(
        (
          SELECT c.grade
          FROM public.student_submissions AS ss
          JOIN public.students AS s ON ss.student_id = s.id
          JOIN public.classrooms AS c ON s.classroom_id = c.id
          WHERE ss.grade IS NOT NULL
          GROUP BY c.grade
          ORDER BY AVG(ss.grade) DESC
          LIMIT 1
        ),
        3
      )
    ),
    'students_login_data', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', s.id,
        'last_login_at', s.last_login_at
      )), '[]'::json)
      FROM public.students AS s
      WHERE s.last_login_at IS NOT NULL
    ),
    'teachers_login_data', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', t.id,
        'last_login_at', t.last_login_at
      )), '[]'::json)
      FROM public.teachers AS t
      WHERE t.last_login_at IS NOT NULL
    ),
    'admins_login_data', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', a.id,
        'last_login_at', a.last_login_at
      )), '[]'::json)
      FROM public.admins AS a
      WHERE a.last_login_at IS NOT NULL
    ),
    'recent_activity', (
      SELECT COALESCE(json_agg(activity_row ORDER BY activity_row->>'timestamp' DESC), '[]'::json)
      FROM (
        SELECT json_build_object(
          'type', al.action,
          'description', COALESCE(al.details->>'description', al.action),
          'timestamp', al.created_at,
          'user_type', al.user_type
        ) AS activity_row
        FROM public.activity_logs AS al
        ORDER BY al.created_at DESC
        LIMIT 20
      ) AS subq
    )
  ) INTO analytics_data;

  RETURN analytics_data;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_analytics(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_analytics(text) TO anon, authenticated;
