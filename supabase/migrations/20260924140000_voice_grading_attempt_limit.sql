-- REVIEW ONLY — do not apply until approved.
-- Target project (later): aiigbtezdnfnfslrnxgs
-- Voice AI grading attempt limit: hard cap of 2 per (student_id, story_id).
-- Ledger stores UUIDs + attempt_number + timestamps only
-- (no names, access codes, transcripts, audio URLs).

BEGIN;

-- Abort if any prior ledger objects exist (any signature). Prevents silent replace/merge.
DO $$
BEGIN
  IF to_regclass('public.voice_grading_attempt_ledger') IS NOT NULL THEN
    RAISE EXCEPTION 'PRECHECK ABORT: public.voice_grading_attempt_ledger already exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'reserve_voice_grading_attempt',
        'get_voice_grading_attempt_status'
      )
  ) THEN
    RAISE EXCEPTION 'PRECHECK ABORT: voice grading attempt function(s) already exist in public';
  END IF;
END $$;

CREATE TABLE public.voice_grading_attempt_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  submission_key uuid NOT NULL,
  attempt_number smallint NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_grading_attempt_ledger_submission_key_key UNIQUE (submission_key),
  CONSTRAINT voice_grading_attempt_ledger_attempt_number_check
    CHECK (attempt_number IN (1, 2)),
  CONSTRAINT voice_grading_attempt_ledger_student_story_attempt_key
    UNIQUE (student_id, story_id, attempt_number)
);

-- No secondary (student_id, story_id, reserved_at) index: COUNT/lookup by
-- (student_id, story_id) is already covered by UNIQUE (student_id, story_id, attempt_number).

COMMENT ON TABLE public.voice_grading_attempt_ledger IS
  'Atomic ledger of AI voice-grading attempt reservations. Max 2 per student+story enforced by CHECK/UNIQUE. Counted even if Groq fails. Teacher grades and unanalyzed legacy audio are not recorded here.';

ALTER TABLE public.voice_grading_attempt_ledger ENABLE ROW LEVEL SECURITY;

-- No client policies. No direct table grants (including service_role):
-- access is only via SECURITY DEFINER RPCs.
REVOKE ALL ON TABLE public.voice_grading_attempt_ledger
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.get_voice_grading_attempt_status(
  p_student_id uuid,
  p_story_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  used integer;
  max_attempts constant integer := 2;
BEGIN
  IF p_student_id IS NULL OR p_story_id IS NULL THEN
    RAISE EXCEPTION 'Invalid student or story';
  END IF;

  SELECT count(*)::integer INTO used
  FROM public.voice_grading_attempt_ledger
  WHERE student_id = p_student_id
    AND story_id = p_story_id;

  RETURN jsonb_build_object(
    'attempts_used', used,
    'attempts_remaining', GREATEST(max_attempts - used, 0),
    'max_attempts', max_attempts,
    'limit_reached', used >= max_attempts
  );
END;
$function$;

CREATE FUNCTION public.reserve_voice_grading_attempt(
  p_student_id uuid,
  p_story_id uuid,
  p_submission_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  max_attempts constant integer := 2;
  used integer;
  next_attempt smallint;
  existing_student uuid;
  existing_story uuid;
  existing_attempt smallint;
BEGIN
  IF p_student_id IS NULL OR p_story_id IS NULL OR p_submission_key IS NULL THEN
    RAISE EXCEPTION 'Invalid reserve arguments';
  END IF;

  -- Serialize concurrent reserves for the same student+story (transaction-scoped).
  PERFORM pg_advisory_xact_lock(
    hashtext('voice_grading_attempt:' || p_student_id::text),
    hashtext(p_story_id::text)
  );

  SELECT student_id, story_id, attempt_number
  INTO existing_student, existing_story, existing_attempt
  FROM public.voice_grading_attempt_ledger
  WHERE submission_key = p_submission_key;

  IF existing_student IS NOT NULL THEN
    IF existing_student IS DISTINCT FROM p_student_id
       OR existing_story IS DISTINCT FROM p_story_id THEN
      -- Generic rejection — do not reveal UUIDs or ownership details.
      RAISE EXCEPTION 'Voice grading attempt is not authorized';
    END IF;

    -- Idempotent retry for the same student+story+key: no new reserve, no Groq.
    RETURN jsonb_build_object(
      'allowed', true,
      'should_call_groq', false
    );
  END IF;

  SELECT count(*)::integer INTO used
  FROM public.voice_grading_attempt_ledger
  WHERE student_id = p_student_id
    AND story_id = p_story_id;

  IF used >= max_attempts THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'should_call_groq', false
    );
  END IF;

  next_attempt := (used + 1)::smallint;

  INSERT INTO public.voice_grading_attempt_ledger (
    student_id,
    story_id,
    submission_key,
    attempt_number
  ) VALUES (
    p_student_id,
    p_story_id,
    p_submission_key,
    next_attempt
  );

  RETURN jsonb_build_object(
    'allowed', true,
    'should_call_groq', true
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT student_id, story_id
    INTO existing_student, existing_story
    FROM public.voice_grading_attempt_ledger
    WHERE submission_key = p_submission_key;

    IF existing_student IS NOT NULL THEN
      IF existing_student IS DISTINCT FROM p_student_id
         OR existing_story IS DISTINCT FROM p_story_id THEN
        RAISE EXCEPTION 'Voice grading attempt is not authorized';
      END IF;
      RETURN jsonb_build_object(
        'allowed', true,
        'should_call_groq', false
      );
    END IF;

    -- Concurrent race on UNIQUE(student_id, story_id, attempt_number).
    RETURN jsonb_build_object(
      'allowed', false,
      'should_call_groq', false
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_voice_grading_attempt_status(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_voice_grading_attempt_status(uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.reserve_voice_grading_attempt(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_voice_grading_attempt(uuid, uuid, uuid)
  TO service_role;

COMMIT;
