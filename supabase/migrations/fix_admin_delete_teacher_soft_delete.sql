-- Fix admin_delete_teacher: use soft delete (set is_active = false) instead of hard delete
-- to avoid 409 from foreign key constraints (classrooms, students, stories, etc. reference teachers).

CREATE OR REPLACE FUNCTION public.admin_delete_teacher(teacher_id uuid, admin_access_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  admin_id uuid;
  teacher_name text;
BEGIN
  -- Verify admin
  SELECT id INTO admin_id FROM admins WHERE access_code = TRIM(admin_access_code) AND is_active = true;
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive admin access code';
  END IF;

  -- Get teacher name for response
  SELECT name INTO teacher_name FROM teachers WHERE id = teacher_id;
  IF teacher_name IS NULL THEN
    RAISE EXCEPTION 'Teacher not found';
  END IF;

  -- Soft delete: deactivate so they cannot log in; keep row for referential integrity
  UPDATE teachers
  SET is_active = false, updated_at = now()
  WHERE id = teacher_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Teacher not found';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم حذف المعلم بنجاح (تم إلغاء تفعيل الحساب)',
    'teacher_id', teacher_id,
    'teacher_name', teacher_name
  );
END;
$function$;
