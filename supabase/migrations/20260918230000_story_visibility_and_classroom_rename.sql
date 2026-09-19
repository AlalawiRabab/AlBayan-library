-- REVIEW ONLY — do not apply to production until approved.
-- 1) Scope student story visibility to author teacher's active classrooms (+ public null-author stories).
-- 2) Harden teacher_create_story to require an active classroom matching story grade.
-- 3) teacher_get_active_classrooms for create-story UI sync.
-- 4) admin_update_classroom_name (display name only).

-- ---------------------------------------------------------------------------
-- teacher_get_active_classrooms
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.teacher_get_active_classrooms(teacher_access_code text)
RETURNS TABLE(
  classroom_id uuid,
  classroom_name text,
  grade integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  teacher_record RECORD;
BEGIN
  SELECT t.*
  INTO teacher_record
  FROM public.teachers AS t
  WHERE t.access_code = btrim(teacher_access_code)
    AND t.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    c.id AS classroom_id,
    c.name AS classroom_name,
    c.grade
  FROM public.classrooms AS c
  WHERE c.teacher_id = teacher_record.id
    AND c.is_active = true
  ORDER BY c.grade ASC, c.name ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.teacher_get_active_classrooms(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_get_active_classrooms(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- teacher_create_story — require active classroom for requested grade
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.teacher_create_story(
  story_title text,
  story_content text,
  story_difficulty text,
  story_grade integer,
  teacher_access_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  teacher_record RECORD;
  new_story RECORD;
  has_permission boolean;
BEGIN
  SELECT t.*
  INTO teacher_record
  FROM public.teachers AS t
  WHERE t.access_code = teacher_access_code
    AND t.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'رمز المعلمة غير صحيح';
  END IF;

  SELECT public.check_teacher_permission(teacher_record.id, 'content_create_stories')
  INTO has_permission;
  IF NOT has_permission THEN
    RAISE EXCEPTION 'ليس لديك صلاحية لإنشاء القصص';
  END IF;

  IF story_grade IS NULL THEN
    RAISE EXCEPTION 'الصف غير مرتبط بفصل نشط للمعلمة';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classrooms AS c
    WHERE c.teacher_id = teacher_record.id
      AND c.is_active = true
      AND c.grade = story_grade
  ) THEN
    RAISE EXCEPTION 'الصف غير مرتبط بفصل نشط للمعلمة';
  END IF;

  -- No set_user_context: auth is access_code + classroom check above (DEFINER DML).

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
    story_title,
    story_content,
    story_difficulty,
    story_grade,
    teacher_record.id,
    true,
    0,
    CEIL(LENGTH(story_content) / 1000.0)::INTEGER
  )
  RETURNING * INTO new_story;

  RETURN row_to_json(new_story);
END;
$function$;

REVOKE ALL ON FUNCTION public.teacher_create_story(text, text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_create_story(text, text, text, integer, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- student_get_story_status — author classroom + grade; keep null-author public
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_get_story_status(
  student_access_code text,
  classroom_id_param uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  story_id uuid,
  story_title text,
  story_content text,
  story_difficulty text,
  story_grade_level integer,
  submission_status text,
  submitted_at timestamp with time zone,
  grade integer,
  feedback text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  student_id_var uuid;
  classroom_grade integer;
  classroom_teacher_id uuid;
BEGIN
  SELECT s.id
  INTO student_id_var
  FROM public.students AS s
  WHERE s.access_code = TRIM(student_access_code)
    AND (s.is_registered = true OR s.name IS NOT NULL);

  IF student_id_var IS NULL THEN
    RAISE EXCEPTION 'Student not found or not registered';
  END IF;

  IF classroom_id_param IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.student_classrooms AS sc
      WHERE sc.student_id = student_id_var
        AND sc.classroom_id = classroom_id_param
    ) THEN
      RAISE EXCEPTION 'Student is not in this classroom';
    END IF;

    SELECT c.grade, c.teacher_id
    INTO classroom_grade, classroom_teacher_id
    FROM public.classrooms AS c
    LEFT JOIN public.teachers AS t ON t.id = c.teacher_id
    WHERE c.id = classroom_id_param
      AND c.is_active = true
      AND (c.teacher_id IS NULL OR t.is_active = true);

    IF classroom_grade IS NULL THEN
      RAISE EXCEPTION 'Classroom not found or inactive';
    END IF;
  ELSE
    SELECT c.grade, c.teacher_id
    INTO classroom_grade, classroom_teacher_id
    FROM public.student_classrooms AS sc
    JOIN public.classrooms AS c ON c.id = sc.classroom_id
    LEFT JOIN public.teachers AS t ON t.id = c.teacher_id
    WHERE sc.student_id = student_id_var
      AND c.is_active = true
      AND (c.teacher_id IS NULL OR t.is_active = true)
    ORDER BY c.grade ASC
    LIMIT 1;

    IF classroom_grade IS NULL THEN
      RAISE EXCEPTION 'Student has no active classroom';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    st.id AS story_id,
    st.title_arabic AS story_title,
    st.content_arabic AS story_content,
    st.difficulty AS story_difficulty,
    st.grade_level AS story_grade_level,
    COALESCE(ss.status, 'not_submitted')::text AS submission_status,
    ss.submitted_at,
    ss.grade,
    ss.feedback_arabic AS feedback
  FROM public.stories AS st
  LEFT JOIN public.student_submissions AS ss
    ON st.id = ss.story_id AND ss.student_id = student_id_var
  WHERE st.grade_level = classroom_grade
    AND (st.is_active = true OR st.is_active IS NULL)
    AND (
      st.author_teacher_id IS NULL
      OR (
        classroom_teacher_id IS NOT NULL
        AND st.author_teacher_id = classroom_teacher_id
        AND EXISTS (
          SELECT 1
          FROM public.teachers AS ta
          WHERE ta.id = st.author_teacher_id
            AND ta.is_active = true
        )
      )
    )
  ORDER BY st.difficulty ASC, st.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.student_get_story_status(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_get_story_status(text, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- student_get_single_story — same visibility rules
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_get_single_story(
  student_access_code text,
  story_uuid uuid
)
RETURNS TABLE(
  id uuid,
  title_arabic text,
  content_arabic text,
  difficulty text,
  grade_level integer,
  estimated_reading_minutes integer,
  thumbnail_url text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  student_id_var uuid;
  story_result RECORD;
BEGIN
  SELECT s.id
  INTO student_id_var
  FROM public.students AS s
  WHERE s.access_code = TRIM(student_access_code)
    AND (s.is_registered = true OR s.name IS NOT NULL);

  IF student_id_var IS NULL THEN
    RAISE EXCEPTION 'Student not found or not registered';
  END IF;

  SELECT
    st.id,
    st.title_arabic,
    st.content_arabic,
    st.difficulty,
    st.grade_level,
    st.estimated_reading_minutes,
    st.thumbnail_url,
    st.created_at
  INTO story_result
  FROM public.stories AS st
  WHERE st.id = story_uuid
    AND st.is_active = true
    AND (
      st.author_teacher_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.teachers AS ta
        WHERE ta.id = st.author_teacher_id
          AND ta.is_active = true
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.student_classrooms AS sc
      JOIN public.classrooms AS c ON c.id = sc.classroom_id
      LEFT JOIN public.teachers AS t ON t.id = c.teacher_id
      WHERE sc.student_id = student_id_var
        AND c.is_active = true
        AND (c.teacher_id IS NULL OR t.is_active = true)
        AND c.grade = st.grade_level
        AND (
          st.author_teacher_id IS NULL
          OR st.author_teacher_id = c.teacher_id
        )
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Story not found or not accessible for your class(es)';
  END IF;

  RETURN QUERY
  SELECT
    story_result.id,
    story_result.title_arabic,
    story_result.content_arabic,
    story_result.difficulty,
    story_result.grade_level,
    story_result.estimated_reading_minutes,
    story_result.thumbnail_url,
    story_result.created_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.student_get_single_story(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_get_single_story(text, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- student_get_stories — align with membership + author rules (legacy path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_get_stories(student_access_code text)
RETURNS TABLE(
  id uuid,
  title_arabic text,
  content_arabic text,
  difficulty text,
  grade_level integer,
  estimated_reading_minutes integer,
  thumbnail_url text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  student_id_var uuid;
BEGIN
  SELECT s.id
  INTO student_id_var
  FROM public.students AS s
  WHERE s.access_code = TRIM(student_access_code)
    AND (s.is_registered = true OR s.name IS NOT NULL);

  IF student_id_var IS NULL THEN
    RAISE EXCEPTION 'Student not found or not registered';
  END IF;

  RETURN QUERY
  SELECT
    st.id,
    st.title_arabic,
    st.content_arabic,
    st.difficulty,
    st.grade_level,
    st.estimated_reading_minutes,
    st.thumbnail_url,
    st.created_at
  FROM public.stories AS st
  WHERE (st.is_active = true OR st.is_active IS NULL)
    AND (
      st.author_teacher_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.teachers AS ta
        WHERE ta.id = st.author_teacher_id
          AND ta.is_active = true
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.student_classrooms AS sc
      JOIN public.classrooms AS c ON c.id = sc.classroom_id
      LEFT JOIN public.teachers AS t ON t.id = c.teacher_id
      WHERE sc.student_id = student_id_var
        AND c.is_active = true
        AND (c.teacher_id IS NULL OR t.is_active = true)
        AND c.grade = st.grade_level
        AND (
          st.author_teacher_id IS NULL
          OR st.author_teacher_id = c.teacher_id
        )
    )
  ORDER BY st.difficulty ASC, st.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.student_get_stories(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_get_stories(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_update_classroom_name — display name only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_classroom_name(
  target_classroom_id uuid,
  new_classroom_name text,
  admin_access_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  admin_id uuid;
  cleaned_name text;
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

  cleaned_name := btrim(regexp_replace(COALESCE(new_classroom_name, ''), '\s+', ' ', 'g'));

  IF cleaned_name = '' THEN
    RAISE EXCEPTION 'Invalid name';
  END IF;

  IF char_length(cleaned_name) < 2 OR char_length(cleaned_name) > 100 THEN
    RAISE EXCEPTION 'Invalid name';
  END IF;

  IF position('<' IN cleaned_name) > 0 OR position('>' IN cleaned_name) > 0 THEN
    RAISE EXCEPTION 'Invalid name';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classrooms AS c
    WHERE c.id = target_classroom_id
  ) THEN
    RAISE EXCEPTION 'Not found';
  END IF;

  UPDATE public.classrooms AS c
  SET
    name = cleaned_name,
    updated_at = now()
  WHERE c.id = target_classroom_id;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'Not found';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم تعديل اسم الصف بنجاح'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_update_classroom_name(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_classroom_name(uuid, text, text) TO anon, authenticated;
