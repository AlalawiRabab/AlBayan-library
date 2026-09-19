/** Client-side validation for admin classroom-name edits. Server must re-validate. */

const HTML_OR_SCRIPT = /[<>]|javascript:|on\w+\s*=|<script/i

export function normalizeClassroomName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

export function validateClassroomName(
  raw: string
): { ok: true; name: string } | { ok: false; error: string } {
  const name = normalizeClassroomName(raw)
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

/**
 * Pure visibility rule for authored vs public stories (mirrors RPC intent).
 * Public/legacy: authorTeacherId is null/undefined.
 * Authored: must match classroomTeacherId.
 */
export function isStoryVisibleToClassroom(params: {
  storyGradeLevel: number
  classroomGrade: number
  authorTeacherId: string | null | undefined
  classroomTeacherId: string | null | undefined
  storyActive?: boolean | null
  authorActive?: boolean | null
}): boolean {
  const {
    storyGradeLevel,
    classroomGrade,
    authorTeacherId,
    classroomTeacherId,
    storyActive = true,
    authorActive = true,
  } = params

  if (storyActive === false) return false
  if (storyGradeLevel !== classroomGrade) return false

  if (authorTeacherId == null || authorTeacherId === '') {
    return true
  }

  if (authorActive === false) return false
  if (classroomTeacherId == null || classroomTeacherId === '') return false
  return authorTeacherId === classroomTeacherId
}
