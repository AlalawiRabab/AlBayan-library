-- REVIEW ONLY — do not apply to production until approved.
-- STAGE enforce (after 20260918231000_prepare_secure_story_access):
-- Final lock-down only. Apply only when the new app (RPC-only for stories) is live.

-- ---------------------------------------------------------------------------
-- Drop legacy unauthenticated overload (breaks old admin_get_grade_stories(grade_num) callers)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_get_grade_stories(integer);

-- ---------------------------------------------------------------------------
-- Defense-in-depth RLS (primary protection is table REVOKE below)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS student_view_active_stories_simple ON public.stories;

CREATE POLICY student_view_stories_via_classroom
ON public.stories
FOR SELECT
TO public
USING (
  is_student()
  AND (is_active = true OR is_active IS NULL)
  AND EXISTS (
    SELECT 1
    FROM public.student_classrooms AS sc
    JOIN public.classrooms AS c ON c.id = sc.classroom_id
    LEFT JOIN public.teachers AS t ON t.id = c.teacher_id
    WHERE sc.student_id = get_current_user_id()
      AND c.is_active = true
      AND (c.teacher_id IS NULL OR t.is_active = true)
      AND c.grade = stories.grade_level
      AND (
        stories.author_teacher_id IS NULL
        OR stories.author_teacher_id = c.teacher_id
      )
  )
);

-- ---------------------------------------------------------------------------
-- Revoke direct table access from clients (owner / service_role unchanged)
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.stories FROM PUBLIC;
REVOKE ALL ON TABLE public.stories FROM anon;
REVOKE ALL ON TABLE public.stories FROM authenticated;

REVOKE ALL ON TABLE public.classrooms FROM PUBLIC;
REVOKE ALL ON TABLE public.classrooms FROM anon;
REVOKE ALL ON TABLE public.classrooms FROM authenticated;

REVOKE ALL ON TABLE public.student_classrooms FROM PUBLIC;
REVOKE ALL ON TABLE public.student_classrooms FROM anon;
REVOKE ALL ON TABLE public.student_classrooms FROM authenticated;
