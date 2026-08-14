-- Keep AI scores provisional, make submission retries idempotent, and remove
-- browser access to privileged submission functions.

ALTER TABLE public.student_submissions
  ADD COLUMN IF NOT EXISTS submission_key uuid,
  ADD COLUMN IF NOT EXISTS auto_grading_metadata jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS student_submissions_submission_key_key
  ON public.student_submissions (submission_key)
  WHERE submission_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.auto_grading_rate_limits (
  scope text NOT NULL,
  identifier_hash text NOT NULL,
  window_started_at timestamp with time zone NOT NULL,
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, identifier_hash, window_started_at)
);

ALTER TABLE public.auto_grading_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.auto_grading_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auto_grading_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_auto_grading_quota(
  identifier_hash_value text,
  scope_name_value text,
  window_seconds_value integer,
  max_requests_value integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  bucket_start timestamp with time zone;
  resulting_count integer;
BEGIN
  IF identifier_hash_value IS NULL OR length(identifier_hash_value) <> 64 THEN
    RAISE EXCEPTION 'Invalid rate-limit identifier';
  END IF;

  IF scope_name_value IS NULL OR length(scope_name_value) > 80 THEN
    RAISE EXCEPTION 'Invalid rate-limit scope';
  END IF;

  IF window_seconds_value < 10 OR window_seconds_value > 86400 THEN
    RAISE EXCEPTION 'Invalid rate-limit window';
  END IF;

  IF max_requests_value < 1 OR max_requests_value > 1000 THEN
    RAISE EXCEPTION 'Invalid rate limit';
  END IF;

  bucket_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / window_seconds_value) * window_seconds_value
  );

  INSERT INTO public.auto_grading_rate_limits AS limits (
    scope,
    identifier_hash,
    window_started_at,
    request_count,
    updated_at
  )
  VALUES (
    scope_name_value,
    identifier_hash_value,
    bucket_start,
    1,
    now()
  )
  ON CONFLICT (scope, identifier_hash, window_started_at)
  DO UPDATE
    SET request_count = limits.request_count + 1,
        updated_at = now()
    WHERE limits.request_count < max_requests_value
  RETURNING request_count INTO resulting_count;

  DELETE FROM public.auto_grading_rate_limits
  WHERE window_started_at < now() - interval '2 days';

  RETURN resulting_count IS NOT NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_auto_grading_quota(
  text, text, integer, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auto_grading_quota(
  text, text, integer, integer
) TO service_role;

-- All submissions now pass through the server-only Edge Function. The legacy
-- RPC remains for compatibility with administrative tooling, but browsers can
-- no longer execute it directly.
REVOKE ALL ON FUNCTION public.student_submit_form(
  text, uuid, uuid, jsonb, text, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_submit_form(
  text, uuid, uuid, jsonb, text, integer, text
) TO service_role;

DROP FUNCTION IF EXISTS public.server_submit_auto_graded_form(
  text, uuid, uuid, jsonb, integer, text, text, text
);

-- Undo the previous promotion of legacy browser-provided auto grades. The AI
-- suggestions remain available in auto_graded/auto_feedback for teacher review.
CREATE TEMP TABLE reverted_auto_grade_students ON COMMIT DROP AS
SELECT DISTINCT student_id
FROM public.student_submissions
WHERE auto_graded IS NOT NULL
  AND grade = auto_graded
  AND graded_by IS NULL
  AND graded_at = submitted_at;

UPDATE public.student_submissions
SET
  grade = NULL,
  feedback_arabic = NULL,
  graded_at = NULL,
  status = 'pending'
WHERE auto_graded IS NOT NULL
  AND grade = auto_graded
  AND graded_by IS NULL
  AND graded_at = submitted_at;

UPDATE public.students AS student
SET
  stories_read = (
    SELECT count(*)::integer
    FROM public.student_submissions AS submission
    WHERE submission.student_id = student.id
      AND submission.status IN ('graded', 'reviewed')
  ),
  forms_submitted = (
    SELECT count(*)::integer
    FROM public.student_submissions AS submission
    WHERE submission.student_id = student.id
  ),
  updated_at = now()
WHERE student.id IN (SELECT student_id FROM reverted_auto_grade_students);
