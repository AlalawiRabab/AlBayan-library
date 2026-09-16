/** Client-side validation for admin teacher-name edits. Server must re-validate. */

const HTML_OR_SCRIPT = /[<>]|javascript:|on\w+\s*=|<script/i

export function normalizeTeacherName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

export function validateTeacherName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = normalizeTeacherName(raw)
  if (!name) {
    return { ok: false, error: 'الاسم لا يمكن أن يكون فارغًا' }
  }
  if (name.length < 2 || name.length > 100) {
    return { ok: false, error: 'يجب أن يكون الاسم بين 2 و100 محرفًا' }
  }
  if (HTML_OR_SCRIPT.test(name)) {
    return { ok: false, error: 'الاسم يحتوي على محتوى غير مسموح' }
  }
  return { ok: true, name }
}
