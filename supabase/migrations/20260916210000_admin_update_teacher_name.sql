-- REVIEW ONLY — do not apply to production until approved.
-- Dedicated admin RPC: update public.teachers.name only.
-- Auth model (platform status quo): anon/authenticated client + plaintext admin access_code
-- comparison inside SECURITY DEFINER RPC. This is NOT JWT-based admin identity.
-- No brute-force / rate-limit protection is added here (none exists on sibling admin_* RPCs).

CREATE OR REPLACE FUNCTION public.admin_update_teacher_name(
  target_teacher_id uuid,
  new_teacher_name text,
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
  -- Same verification pattern as existing admin_delete_teacher / admin_update_teacher:
  -- compare provided access code to public.admins.access_code (stored as plaintext text).
  SELECT a.id
  INTO admin_id
  FROM public.admins AS a
  WHERE a.access_code = btrim(admin_access_code)
    AND a.is_active = true;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  cleaned_name := btrim(regexp_replace(COALESCE(new_teacher_name, ''), '\s+', ' ', 'g'));

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
    FROM public.teachers AS t
    WHERE t.id = target_teacher_id
  ) THEN
    RAISE EXCEPTION 'Not found';
  END IF;

  UPDATE public.teachers AS t
  SET
    name = cleaned_name,
    updated_at = now()
  WHERE t.id = target_teacher_id;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'Not found';
  END IF;

  -- Generic success payload: no access codes, no admin row, no extra PII beyond confirmation message.
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم تعديل اسم المعلمة بنجاح'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_update_teacher_name(uuid, text, text) FROM PUBLIC;
-- Platform uses anon key + access_code RPCs (not end-user JWT admin claims).
-- Keep EXECUTE aligned with existing admin_* teacher management RPCs.
GRANT EXECUTE ON FUNCTION public.admin_update_teacher_name(uuid, text, text) TO anon, authenticated;
