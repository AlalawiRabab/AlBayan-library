import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'

// Temporary dual-accept: legacy production hash + newly rotated Vercel secret hash.
// Remove the legacy entry after all callers migrate.
const EXPECTED_SECRET_HASHES = [
  'e4eba8cbed3078244cf9b2171cb8b9829a2d056a94cd2781ca0006d80d85d29d',
  '305c7641887c0f0733c41d4fd5914bc98864017d022ab5356ec13b929a6ff1dc'
] as const
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_BODY_LENGTH = 100_000
const MAX_ANSWER_LENGTH = 8_000
const MAX_TOTAL_ANSWER_LENGTH = 40_000
const AUDIO_EXTENSIONS = new Set(['webm', 'mp3', 'mp4', 'aac', 'ogg'])
const AUDIO_CONTENT_TYPES = new Set([
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/aac',
  'audio/ogg',
  'video/mp4',
  'application/octet-stream'
])

type JsonRecord = Record<string, unknown>
type ServiceClient = ReturnType<typeof createClient<any>>
type Question = {
  id: string
  text_arabic: string
  type: string
  required: boolean
  options?: string[]
}

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
}

function respond(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

function matchesExpectedSecretHash(suppliedHash: string) {
  let matched = false
  for (const expected of EXPECTED_SECRET_HASHES) {
    // Evaluate every candidate to avoid short-circuit timing hints.
    matched = constantTimeEqual(suppliedHash, expected) || matched
  }
  return matched
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function requiredString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) return null
  return normalized
}

function parseQuestions(value: unknown): Question[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null

  const questions: Question[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const question = item as JsonRecord
    const id = requiredString(question.id, 200)
    const text = requiredString(question.text_arabic, 4_000)
    const type = requiredString(question.type, 80)
    if (!id || !text || !type) return null

    const options = Array.isArray(question.options)
      ? question.options.filter((option): option is string => typeof option === 'string').map(option => option.trim())
      : undefined

    questions.push({
      id,
      text_arabic: text,
      type,
      required: question.required === true,
      options
    })
  }

  return questions
}

function normalizeAnswers(value: unknown, questions: Question[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as JsonRecord
  const answers: Record<string, string> = {}
  let totalLength = 0

  for (const question of questions) {
    const rawAnswer = source[question.id]
    const answer = typeof rawAnswer === 'string' ? rawAnswer.trim() : ''
    totalLength += answer.length

    if (answer.length > MAX_ANSWER_LENGTH || totalLength > MAX_TOTAL_ANSWER_LENGTH) return null
    if (question.required && !answer) return null
    if (question.type === 'multiple_choice' && answer && question.options?.length && !question.options.includes(answer)) {
      return null
    }

    answers[question.id] = answer
  }

  return answers
}

function validateAudioUrl(value: unknown, supabaseUrl: string) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > 4_000) return undefined

  try {
    const audioUrl = new URL(value)
    const projectUrl = new URL(supabaseUrl)
    const expectedPrefix = '/storage/v1/object/public/student-recordings/voice-recordings/'
    if (audioUrl.protocol !== 'https:' || audioUrl.host !== projectUrl.host || !audioUrl.pathname.startsWith(expectedPrefix)) {
      return undefined
    }
    return audioUrl.toString()
  } catch {
    return undefined
  }
}

function isStudentRecordingUrl(
  value: string,
  supabaseUrl: string,
  studentId: string,
  studentAccessCode: string,
  storyId: string
) {
  try {
    const audioUrl = new URL(value)
    const projectUrl = new URL(supabaseUrl)
    const expectedPrefix = '/storage/v1/object/public/student-recordings/voice-recordings/'
    if (audioUrl.protocol !== 'https:' || audioUrl.host !== projectUrl.host || !audioUrl.pathname.startsWith(expectedPrefix)) {
      return false
    }

    const objectPath = decodeURIComponent(audioUrl.pathname.slice(expectedPrefix.length))
    const modernPrefix = `${studentId}/${storyId}/`
    if (objectPath.startsWith(modernPrefix)) {
      const filename = objectPath.slice(modernPrefix.length)
      return /^[0-9a-f-]{36}\.(webm|mp3|mp4|aac|ogg)$/i.test(filename)
    }

    const legacyPrefix = `${studentAccessCode}_${storyId}_`
    return !objectPath.includes('/') && objectPath.startsWith(legacyPrefix) && /^\d+\.(webm|mp3|mp4|aac|ogg)$/i.test(objectPath.slice(legacyPrefix.length))
  } catch {
    return false
  }
}

function recordingObjectPath(value: unknown, supabaseUrl: string) {
  const trustedUrl = validateAudioUrl(value, supabaseUrl)
  if (!trustedUrl) return null
  try {
    const url = new URL(trustedUrl)
    const prefix = '/storage/v1/object/public/student-recordings/'
    return decodeURIComponent(url.pathname.slice(prefix.length))
  } catch {
    return null
  }
}

async function signSubmissionRecordings(
  supabase: ServiceClient,
  submissions: JsonRecord[],
  supabaseUrl: string
) {
  const paths = Array.from(new Set(
    submissions
      .map(submission => recordingObjectPath(submission.audio_url, supabaseUrl))
      .filter((path): path is string => Boolean(path))
  ))
  if (paths.length === 0) {
    return submissions.map(submission => ({ ...submission, audio_url: null }))
  }

  const { data: signedUrls, error } = await supabase.storage
    .from('student-recordings')
    .createSignedUrls(paths, 3_600)
  if (error) throw error

  const signedUrlByPath = new Map<string, string>()
  for (const item of signedUrls || []) {
    if (item.path && item.signedUrl) signedUrlByPath.set(item.path, item.signedUrl)
  }

  return submissions.map(submission => {
    const path = recordingObjectPath(submission.audio_url, supabaseUrl)
    return { ...submission, audio_url: path ? signedUrlByPath.get(path) ?? null : null }
  })
}

async function consumeQuota(
  supabase: ServiceClient,
  scope: 'student' | 'teacher' | 'student_audio',
  identifier: string
) {
  const identifierHash = await sha256(`${scope}:${identifier}`)
  const limits = scope === 'student'
    ? [{ suffix: 'minute', window: 60, max: 5 }, { suffix: 'day', window: 86_400, max: 30 }]
    : scope === 'student_audio'
      ? [{ suffix: 'minute', window: 60, max: 10 }, { suffix: 'day', window: 86_400, max: 50 }]
      : [{ suffix: 'minute', window: 60, max: 10 }, { suffix: 'day', window: 86_400, max: 200 }]

  for (const limit of limits) {
    const { data, error } = await supabase.rpc('consume_auto_grading_quota', {
      identifier_hash_value: identifierHash,
      scope_name_value: `${scope}_${limit.suffix}`,
      window_seconds_value: limit.window,
      max_requests_value: limit.max
    })
    if (error) throw error
    if (data !== true) return false
  }

  return true
}

async function loadStudentContext(
  supabase: ServiceClient,
  body: JsonRecord,
  supabaseUrl: string
) {
  const studentAccessCode = requiredString(body.studentAccessCode, 64)
  const storyId = requiredString(body.storyId, 36)
  const formTemplateId = requiredString(body.formTemplateId, 36)
  const idempotencyKey = requiredString(body.idempotencyKey, 36)

  if (!studentAccessCode || !storyId || !formTemplateId || !idempotencyKey) return null
  if (!UUID_PATTERN.test(storyId) || !UUID_PATTERN.test(formTemplateId) || !UUID_PATTERN.test(idempotencyKey)) return null

  const audioUrl = validateAudioUrl(body.audioUrl, supabaseUrl)
  if (audioUrl === undefined) return null

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, name, is_registered')
    .eq('access_code', studentAccessCode)
    .maybeSingle()

  if (studentError) throw studentError
  if (!student || (student.is_registered !== true && !student.name)) return null
  if (audioUrl && !isStudentRecordingUrl(audioUrl, supabaseUrl, student.id, studentAccessCode, storyId)) return null

  const [{ data: story, error: storyError }, { data: form, error: formError }] = await Promise.all([
    supabase
      .from('stories')
      .select('id, title_arabic, content_arabic, difficulty, grade_level, is_active')
      .eq('id', storyId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('form_templates')
      .select('id, story_id, questions, is_active')
      .eq('id', formTemplateId)
      .eq('story_id', storyId)
      .eq('is_active', true)
      .maybeSingle()
  ])

  if (storyError) throw storyError
  if (formError) throw formError
  if (!story || !form) return null

  const { data: memberships, error: membershipError } = await supabase
    .from('student_classrooms')
    .select('classroom_id')
    .eq('student_id', student.id)

  if (membershipError) throw membershipError
  const classroomIds = (memberships || []).map(row => row.classroom_id)
  if (classroomIds.length === 0) return null

  const { data: classrooms, error: classroomError } = await supabase
    .from('classrooms')
    .select('id, teacher_id')
    .in('id', classroomIds)
    .eq('grade', story.grade_level)
    .eq('is_active', true)

  if (classroomError) throw classroomError
  if (!classrooms?.length) return null

  const teacherIds = classrooms.map(row => row.teacher_id).filter((id): id is string => typeof id === 'string')
  let activeTeacherIds = new Set<string>()
  if (teacherIds.length > 0) {
    const { data: teachers, error: teacherError } = await supabase
      .from('teachers')
      .select('id')
      .in('id', teacherIds)
      .eq('is_active', true)
    if (teacherError) throw teacherError
    activeTeacherIds = new Set((teachers || []).map(teacher => teacher.id))
  }

  const hasAccessibleClassroom = classrooms.some(row => !row.teacher_id || activeTeacherIds.has(row.teacher_id))
  if (!hasAccessibleClassroom) return null

  const questions = parseQuestions(form.questions)
  if (!questions) return null
  const answers = normalizeAnswers(body.answers, questions)
  if (!answers) return null

  return {
    studentAccessCode,
    student,
    story,
    form,
    questions,
    answers,
    audioUrl,
    idempotencyKey
  }
}

async function findSubmissionByKey(
  supabase: ServiceClient,
  idempotencyKey: string
) {
  const { data, error } = await supabase
    .from('student_submissions')
    .select('id, student_id, story_id, form_template_id, submitted_at, status, grade, feedback_arabic, auto_graded, auto_feedback')
    .eq('submission_key', idempotencyKey)
    .maybeSingle()
  if (error) throw error
  return data
}

Deno.serve(async request => {
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed' })

  const suppliedSecret = request.headers.get('x-auto-grading-secret') || ''
  const suppliedHash = suppliedSecret ? await sha256(suppliedSecret) : ''
  if (!suppliedHash || !matchesExpectedSecretHash(suppliedHash)) {
    return respond(401, { error: 'Unauthorized' })
  }

  const contentLength = Number(request.headers.get('content-length') || '0')
  if (contentLength > MAX_BODY_LENGTH) return respond(413, { error: 'Request too large' })

  const rawBody = await request.text()
  if (rawBody.length > MAX_BODY_LENGTH) return respond(413, { error: 'Request too large' })

  let body: JsonRecord
  try {
    body = JSON.parse(rawBody) as JsonRecord
  } catch {
    return respond(400, { error: 'Invalid JSON' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) return respond(503, { error: 'Service unavailable' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  try {
    switch (body.action) {
      case 'prepare_audio_upload': {
        const studentAccessCode = requiredString(body.studentAccessCode, 64)
        const storyId = requiredString(body.storyId, 36)
        const extension = requiredString(body.extension, 8)?.toLowerCase()
        const contentType = requiredString(body.contentType, 80)?.toLowerCase()
        if (
          !studentAccessCode || !storyId || !UUID_PATTERN.test(storyId) ||
          !extension || !AUDIO_EXTENSIONS.has(extension) ||
          !contentType || !AUDIO_CONTENT_TYPES.has(contentType)
        ) {
          return respond(400, { error: 'Invalid audio upload request' })
        }

        const [{ data: student, error: studentError }, { data: story, error: storyError }] = await Promise.all([
          supabase
            .from('students')
            .select('id, name, is_registered')
            .eq('access_code', studentAccessCode)
            .maybeSingle(),
          supabase
            .from('stories')
            .select('id, grade_level, is_active')
            .eq('id', storyId)
            .eq('is_active', true)
            .maybeSingle()
        ])
        if (studentError || storyError) throw studentError || storyError
        if (!student || !story || (student.is_registered !== true && !student.name)) {
          return respond(403, { error: 'Audio upload is not authorized' })
        }

        const { data: memberships, error: membershipError } = await supabase
          .from('student_classrooms')
          .select('classroom_id')
          .eq('student_id', student.id)
        if (membershipError) throw membershipError
        const classroomIds = (memberships || []).map(row => row.classroom_id)
        if (classroomIds.length === 0) return respond(403, { error: 'Audio upload is not authorized' })

        const { data: classrooms, error: classroomError } = await supabase
          .from('classrooms')
          .select('id, teacher_id')
          .in('id', classroomIds)
          .eq('grade', story.grade_level)
          .eq('is_active', true)
        if (classroomError) throw classroomError
        if (!classrooms?.length) return respond(403, { error: 'Audio upload is not authorized' })

        const teacherIds = classrooms.map(row => row.teacher_id).filter((id): id is string => typeof id === 'string')
        if (teacherIds.length > 0) {
          const { data: teachers, error: teacherError } = await supabase
            .from('teachers')
            .select('id')
            .in('id', teacherIds)
            .eq('is_active', true)
          if (teacherError) throw teacherError
          const activeTeacherIds = new Set((teachers || []).map(teacher => teacher.id))
          if (!classrooms.some(row => !row.teacher_id || activeTeacherIds.has(row.teacher_id))) {
            return respond(403, { error: 'Audio upload is not authorized' })
          }
        }

        if (!await consumeQuota(supabase, 'student_audio', student.id)) {
          return respond(429, { error: 'Too many audio upload requests' })
        }

        const filePath = `voice-recordings/${student.id}/${storyId}/${crypto.randomUUID()}.${extension}`
        const { data: signedUpload, error: signedUploadError } = await supabase.storage
          .from('student-recordings')
          .createSignedUploadUrl(filePath)
        if (signedUploadError) throw signedUploadError

        const { data: publicUrl } = supabase.storage
          .from('student-recordings')
          .getPublicUrl(filePath)

        return respond(200, {
          path: signedUpload.path,
          token: signedUpload.token,
          publicUrl: publicUrl.publicUrl
        })
      }

      case 'prepare_student': {
        const context = await loadStudentContext(supabase, body, supabaseUrl)
        if (!context) return respond(403, { error: 'Student submission is not authorized' })

        const existing = await findSubmissionByKey(supabase, context.idempotencyKey)
        if (existing) {
          if (existing.student_id !== context.student.id) return respond(409, { error: 'Submission key conflict' })
          return respond(200, { alreadySubmitted: true, submission: existing })
        }

        if (!await consumeQuota(supabase, 'student', context.student.id)) {
          return respond(429, { error: 'Too many grading requests' })
        }

        return respond(200, {
          alreadySubmitted: false,
          questions: context.questions,
          answers: context.answers,
          story: {
            title_arabic: context.story.title_arabic,
            content_arabic: context.story.content_arabic,
            difficulty: context.story.difficulty,
            grade_level: context.story.grade_level
          }
        })
      }

      case 'persist_student': {
        const context = await loadStudentContext(supabase, body, supabaseUrl)
        if (!context) return respond(403, { error: 'Student submission is not authorized' })

        const existing = await findSubmissionByKey(supabase, context.idempotencyKey)
        if (existing) {
          if (existing.student_id !== context.student.id) return respond(409, { error: 'Submission key conflict' })
          return respond(200, { submission: existing, duplicate: true })
        }

        const autoGrade = body.autoGrade === null || body.autoGrade === undefined ? null : Number(body.autoGrade)
        const autoFeedback = body.autoFeedback === null || body.autoFeedback === undefined
          ? null
          : requiredString(body.autoFeedback, 1_200)

        if (autoGrade !== null && (!Number.isInteger(autoGrade) || autoGrade < 0 || autoGrade > 100)) {
          return respond(400, { error: 'Invalid automatic grade' })
        }
        if ((autoGrade === null) !== (autoFeedback === null)) {
          return respond(400, { error: 'Incomplete automatic grade' })
        }

        const metadata = body.autoGradingMetadata && typeof body.autoGradingMetadata === 'object'
          ? body.autoGradingMetadata
          : null

        const { data: inserted, error: insertError } = await supabase
          .from('student_submissions')
          .insert({
            student_id: context.student.id,
            story_id: context.story.id,
            form_template_id: context.form.id,
            responses: context.answers,
            audio_url: context.audioUrl,
            auto_graded: autoGrade,
            auto_feedback: autoFeedback,
            auto_grading_metadata: metadata,
            submission_key: context.idempotencyKey,
            submitted_at: new Date().toISOString(),
            status: 'pending'
          })
          .select('id, student_id, story_id, form_template_id, submitted_at, status, grade, feedback_arabic, auto_graded, auto_feedback')
          .single()

        if (insertError?.code === '23505') {
          const duplicate = await findSubmissionByKey(supabase, context.idempotencyKey)
          if (duplicate?.student_id === context.student.id) return respond(200, { submission: duplicate, duplicate: true })
        }
        if (insertError) throw insertError

        const { error: statsError } = await supabase.rpc('update_student_stats', {
          student_uuid: context.student.id
        })
        if (statsError) console.warn('Student statistics update failed', statsError.code)

        return respond(201, { submission: inserted, duplicate: false })
      }

      case 'teacher_submissions': {
        const teacherAccessCode = requiredString(body.teacherAccessCode, 64)
        if (!teacherAccessCode) return respond(400, { error: 'Invalid teacher code' })

        const { data: teacher, error: teacherError } = await supabase
          .from('teachers')
          .select('id')
          .eq('access_code', teacherAccessCode)
          .eq('is_active', true)
          .maybeSingle()
        if (teacherError) throw teacherError
        if (!teacher) return respond(403, { error: 'Teacher is not authorized' })

        const { data: submissions, error: submissionsError } = await supabase.rpc('teacher_get_submissions', {
          teacher_access_code: teacherAccessCode
        })
        if (submissionsError) return respond(403, { error: 'Teacher is not authorized' })

        const ids = (submissions || []).map((submission: JsonRecord) => submission.submission_id).filter(Boolean)
        if (ids.length === 0) return respond(200, { submissions: [] })

        const { data: suggestions, error: suggestionsError } = await supabase
          .from('student_submissions')
          .select('id, auto_graded, auto_feedback, auto_grading_metadata')
          .in('id', ids)
        if (suggestionsError) throw suggestionsError

        const suggestionMap = new Map((suggestions || []).map(item => [item.id, item]))
        const merged = (submissions || []).map((submission: JsonRecord) => ({
          ...submission,
          auto_graded: suggestionMap.get(submission.submission_id as string)?.auto_graded ?? null,
          auto_feedback: suggestionMap.get(submission.submission_id as string)?.auto_feedback ?? null,
          auto_grading_metadata: suggestionMap.get(submission.submission_id as string)?.auto_grading_metadata ?? null
        }))
        return respond(200, { submissions: await signSubmissionRecordings(supabase, merged, supabaseUrl) })
      }

      case 'prepare_teacher': {
        const teacherAccessCode = requiredString(body.teacherAccessCode, 64)
        const submissionId = requiredString(body.submissionId, 36)
        if (!teacherAccessCode || !submissionId || !UUID_PATTERN.test(submissionId)) {
          return respond(400, { error: 'Invalid teacher grading request' })
        }

        const { data: teacher, error: teacherError } = await supabase
          .from('teachers')
          .select('id')
          .eq('access_code', teacherAccessCode)
          .eq('is_active', true)
          .maybeSingle()
        if (teacherError) throw teacherError
        if (!teacher) return respond(403, { error: 'Teacher is not authorized' })

        const { data: submissions, error: submissionsError } = await supabase.rpc('teacher_get_submissions', {
          teacher_access_code: teacherAccessCode
        })
        if (submissionsError) return respond(403, { error: 'Teacher is not authorized' })
        const submission = (submissions || []).find((item: JsonRecord) => item.submission_id === submissionId)
        if (!submission) return respond(404, { error: 'Submission not found' })

        if (!await consumeQuota(supabase, 'teacher', teacher.id)) {
          return respond(429, { error: 'Too many grading requests' })
        }

        const { data: storedSubmission, error: storedError } = await supabase
          .from('student_submissions')
          .select('story_id')
          .eq('id', submissionId)
          .single()
        if (storedError) throw storedError

        const { data: story, error: storyError } = await supabase
          .from('stories')
          .select('title_arabic, content_arabic, difficulty, grade_level')
          .eq('id', storedSubmission.story_id)
          .single()
        if (storyError) throw storyError

        return respond(200, {
          questions: submission.questions,
          answers: submission.responses,
          story,
          studentName: submission.student_name
        })
      }

      case 'authorize_staff_ai': {
        const accessCode = requiredString(body.accessCode, 64)
        const requestedRole = body.role === 'admin' ? 'admin' : body.role === 'teacher' ? 'teacher' : null
        if (!accessCode || !requestedRole) return respond(400, { error: 'Invalid staff request' })

        const table = requestedRole === 'admin' ? 'admins' : 'teachers'
        const { data: staff, error: staffError } = await supabase
          .from(table)
          .select('id')
          .eq('access_code', accessCode)
          .eq('is_active', true)
          .maybeSingle()

        if (staffError) throw staffError
        if (!staff) return respond(403, { error: 'Staff member is not authorized' })
        if (!await consumeQuota(supabase, 'teacher', `${requestedRole}:${staff.id}`)) {
          return respond(429, { error: 'Too many AI requests' })
        }

        return respond(200, { authorized: true, role: requestedRole })
      }

      case 'admin_grade_mutation': {
        const adminAccessCode = requiredString(body.adminAccessCode, 64)
        const operation = body.operation === 'update_name' || body.operation === 'toggle_status' || body.operation === 'delete'
          ? body.operation
          : null
        const gradeId = Number(body.gradeId)
        if (!adminAccessCode || !operation || !Number.isInteger(gradeId) || gradeId < 1 || gradeId > 100) {
          return respond(400, { error: 'Invalid grade management request' })
        }

        const { data: admin, error: adminError } = await supabase
          .from('admins')
          .select('id')
          .eq('access_code', adminAccessCode)
          .eq('is_active', true)
          .maybeSingle()
        if (adminError) throw adminError
        if (!admin) return respond(403, { error: 'Admin is not authorized' })

        if (operation === 'update_name') {
          const name = requiredString(body.name, 120)
          if (!name) return respond(400, { error: 'Invalid grade name' })
          const { data: grade, error: updateError } = await supabase
            .from('grades')
            .update({ name, updated_at: new Date().toISOString() })
            .eq('id', gradeId)
            .select('id, name, description, is_active, created_at, updated_at')
            .single()
          if (updateError) throw updateError
          return respond(200, { grade })
        }

        if (operation === 'toggle_status') {
          if (typeof body.isActive !== 'boolean') return respond(400, { error: 'Invalid grade status' })
          const { data: grade, error: updateError } = await supabase
            .from('grades')
            .update({ is_active: !body.isActive, updated_at: new Date().toISOString() })
            .eq('id', gradeId)
            .select('id, name, description, is_active, created_at, updated_at')
            .single()
          if (updateError) throw updateError
          return respond(200, { grade })
        }

        const { data: stories, error: storyLookupError } = await supabase
          .from('stories')
          .select('id')
          .eq('grade_level', gradeId)
        if (storyLookupError) throw storyLookupError
        const storyIds = (stories || []).map(story => story.id)
        if (storyIds.length > 0) {
          const { error: formsDeleteError } = await supabase.from('form_templates').delete().in('story_id', storyIds)
          if (formsDeleteError) throw formsDeleteError
          const { error: storiesDeleteError } = await supabase.from('stories').delete().in('id', storyIds)
          if (storiesDeleteError) throw storiesDeleteError
        }

        const { error: gradeDeleteError } = await supabase.from('grades').delete().eq('id', gradeId)
        if (gradeDeleteError) throw gradeDeleteError
        return respond(200, { deleted: true })
      }

      case 'admin_data': {
        const adminAccessCode = requiredString(body.adminAccessCode, 64)
        const resource = body.resource === 'overview' || body.resource === 'grade_submissions'
          ? body.resource
          : null
        if (!adminAccessCode || !resource) return respond(400, { error: 'Invalid admin data request' })

        const { data: admin, error: adminError } = await supabase
          .from('admins')
          .select('id')
          .eq('access_code', adminAccessCode)
          .eq('is_active', true)
          .maybeSingle()
        if (adminError) throw adminError
        if (!admin) return respond(403, { error: 'Admin is not authorized' })

        if (resource === 'grade_submissions') {
          const gradeLevel = Number(body.gradeLevel)
          if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 100) {
            return respond(400, { error: 'Invalid grade level' })
          }
          const { data: submissions, error: submissionsError } = await supabase.rpc('admin_get_grade_submissions', {
            grade_num: gradeLevel
          })
          if (submissionsError) throw submissionsError
          const safeSubmissions = await signSubmissionRecordings(supabase, submissions || [], supabaseUrl)
          return respond(200, { submissions: safeSubmissions })
        }

        const [
          { data: grades, error: gradesError },
          { data: classrooms, error: classroomsError },
          { data: students, error: studentsError },
          { data: teachers, error: teachersError },
          { data: stories, error: storiesError }
        ] = await Promise.all([
          supabase.from('grades').select('id').order('id'),
          supabase.rpc('admin_get_classrooms'),
          supabase.from('students').select('classroom_id, is_registered'),
          supabase.from('teachers').select('assigned_grade, is_active'),
          supabase.from('stories').select('grade_level')
        ])
        if (gradesError || classroomsError || studentsError || teachersError || storiesError) {
          throw gradesError || classroomsError || studentsError || teachersError || storiesError
        }

        const submissionsByGrade = await Promise.all((grades || []).map(async grade => {
          const { data, error } = await supabase.rpc('admin_get_grade_submissions', { grade_num: grade.id })
          if (error) throw error
          return data || []
        }))
        const allSubmissions = submissionsByGrade.flat().map((submission: JsonRecord) => ({
          id: submission.submission_id,
          student_name: submission.student_name,
          student_access_code: submission.student_access_code,
          story_title: submission.story_title,
          form_title: submission.form_title,
          grade: submission.grade,
          voice_grade: submission.voice_grade,
          submitted_at: submission.submitted_at,
          feedback: submission.feedback
        }))

        const stats = (grades || []).map(grade => {
          const classroomIds = new Set(
            (classrooms || [])
              .filter((classroom: JsonRecord) => classroom.grade === grade.id)
              .map((classroom: JsonRecord) => classroom.id)
          )
          return {
            grade: grade.id,
            teachers_count: (teachers || []).filter(teacher => teacher.assigned_grade === grade.id && teacher.is_active === true).length,
            students_count: (students || []).filter(student => student.is_registered === true && classroomIds.has(student.classroom_id)).length,
            stories_count: (stories || []).filter(story => story.grade_level === grade.id).length
          }
        })

        return respond(200, { classrooms: classrooms || [], submissions: allSubmissions, stats })
      }

      default:
        return respond(400, { error: 'Unsupported action' })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown edge function error'
    console.error('secure-auto-grading failed:', message)
    return respond(500, { error: 'Secure grading service failed' })
  }
})
