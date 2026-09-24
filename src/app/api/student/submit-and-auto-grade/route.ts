import { NextRequest, NextResponse } from 'next/server'
import { callAutoGradingGateway, AutoGradingGatewayError } from '@/lib/autoGradingGateway'
import { autoGradeSubmission, canGradeMultipleChoiceDeterministically, describeAutoGradeClientOutcome, GradingQuestion, GradingResult } from '@/lib/groq'
import { gradeStudentVoiceRecording } from '@/lib/groqVoice'
import { calculateFinalGrade } from '@/lib/voiceGradingLogic'
import {
  decideVoiceGroqCall,
  VOICE_ATTEMPTS_EXHAUSTED_MESSAGE,
  type VoiceAttemptReserveResult
} from '@/lib/voiceAttemptLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/**
 * Hobby Fluid Compute allows up to 300s. We pin 60s so wall-clock budgets
 * (text ≤25s ∥ voice download+Whisper ≤35s + prepare/persist) stay under the limit.
 */
export const maxDuration = 60

type SubmissionRequest = {
  studentAccessCode: string
  storyId: string
  formTemplateId: string
  idempotencyKey: string
  answers: Record<string, string>
  audioUrl?: string
}

type PreparedStudentSubmission = {
  alreadySubmitted: boolean
  submission?: {
    status?: string | null
    grade?: number | null
    voice_grade?: number | null
    feedback_arabic?: string | null
    auto_graded?: number | null
    auto_feedback?: string | null
    audio_url?: string | null
  }
  questions?: GradingQuestion[]
  answers?: Record<string, string>
  /** Server-to-server only — never echo to browsers. */
  audioSignedUrl?: string | null
  reusedVoiceGrade?: number | null
  reusedVoiceFeedback?: string | null
  voiceLimitReached?: boolean
  attemptsRemaining?: number
  story?: {
    title_arabic: string
    content_arabic: string
    difficulty: string
    grade_level: number
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_REQUEST_LENGTH = 100_000
const MAX_ANSWER_LENGTH = 8_000
const MAX_TOTAL_ANSWER_LENGTH = 40_000
const PENDING_REVIEW_MESSAGE = 'تم حفظ التسليم بنجاح، ويحتاج مراجعة المعلمة لأن التقييم الآلي غير متاح حالياً.'
const VOICE_PENDING_MESSAGE = 'بانتظار مراجعة المعلمة لتقييم القراءة الصوتية.'

/**
 * Submission status / attempt policy:
 * - Production uniqueness is only on `submission_key` (partial unique index).
 * - Voice AI: max 2 attempts per (student_id, story_id) via atomic ledger RPC.
 * - Same owned audio with existing voice_grade reuses score (no Whisper / no reserve).
 * - status = 'graded' when grade and/or voice_grade is set; otherwise 'pending'.
 */

function validateAudioUrl(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || value.length > 4_000) return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!supabaseUrl) return null

  try {
    const audioUrl = new URL(value)
    const projectUrl = new URL(supabaseUrl)
    const expectedPrefix = '/storage/v1/object/public/student-recordings/voice-recordings/'
    if (audioUrl.protocol !== 'https:' || audioUrl.host !== projectUrl.host || !audioUrl.pathname.startsWith(expectedPrefix)) {
      return null
    }
    return audioUrl.toString()
  } catch {
    return null
  }
}

function parseSubmissionRequest(value: unknown): SubmissionRequest | null {
  if (!value || typeof value !== 'object') return null

  const body = value as Record<string, unknown>
  const studentAccessCode = typeof body.studentAccessCode === 'string' ? body.studentAccessCode.trim() : ''
  const storyId = typeof body.storyId === 'string' ? body.storyId.trim() : ''
  const formTemplateId = typeof body.formTemplateId === 'string' ? body.formTemplateId.trim() : ''
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
  const audioUrl = validateAudioUrl(body.audioUrl)

  if (
    !studentAccessCode ||
    studentAccessCode.length > 64 ||
    !UUID_PATTERN.test(storyId) ||
    !UUID_PATTERN.test(formTemplateId) ||
    !UUID_PATTERN.test(idempotencyKey) ||
    audioUrl === null ||
    !body.answers ||
    typeof body.answers !== 'object' ||
    Array.isArray(body.answers)
  ) {
    return null
  }

  const answers: Record<string, string> = {}
  let totalLength = 0
  for (const [questionId, answer] of Object.entries(body.answers as Record<string, unknown>)) {
    if (!questionId || questionId.length > 200 || typeof answer !== 'string') return null
    const normalizedAnswer = answer.trim()
    totalLength += normalizedAnswer.length
    if (normalizedAnswer.length > MAX_ANSWER_LENGTH || totalLength > MAX_TOTAL_ANSWER_LENGTH) return null
    answers[questionId] = normalizedAnswer
  }

  return { studentAccessCode, storyId, formTemplateId, idempotencyKey, answers, audioUrl }
}

/** Strip signed URLs / tokens from any string that might reach logs or clients. */
function redactSensitive(value: unknown): string {
  const text = typeof value === 'string' ? value : (value instanceof Error ? value.message : String(value ?? ''))
  return text
    .replace(/https?:\/\/[^\s"'\\]+/gi, '[redacted-url]')
    .replace(/token=[^&\s]+/gi, 'token=[redacted]')
    .replace(/signature=[^&\s]+/gi, 'signature=[redacted]')
}

function gatewayErrorResponse(error: unknown) {
  if (error instanceof AutoGradingGatewayError) {
    if (error.status === 429) {
      return NextResponse.json({ error: 'تم تجاوز عدد محاولات التقييم. يرجى الانتظار قليلاً.' }, { status: 429 })
    }
    if (error.status >= 400 && error.status < 500) {
      return NextResponse.json({ error: 'تعذر التحقق من بيانات الطالب أو القصة' }, { status: error.status })
    }
  }
  console.error('Secure student submission failed', redactSensitive(error))
  return NextResponse.json({ error: 'تعذر حفظ الإجابات' }, { status: 500 })
}

function clientSafeSubmission(submission: NonNullable<PreparedStudentSubmission['submission']>) {
  // Never include signed URLs or storage tokens in browser responses.
  const { audio_url, ...safe } = submission
  return {
    ...safe,
    has_audio: Boolean(audio_url)
  }
}

function responseFromExistingSubmission(submission: NonNullable<PreparedStudentSubmission['submission']>, duplicate: boolean) {
  const officialGrade = submission.grade ?? null
  const voiceGrade = submission.voice_grade ?? null
  const autoScore = submission.auto_graded ?? null
  const isOfficiallyGraded = submission.status === 'graded' || officialGrade !== null || voiceGrade !== null
  const grade = isOfficiallyGraded ? (officialGrade ?? autoScore) : null
  const feedback = isOfficiallyGraded
    ? (submission.feedback_arabic ?? submission.auto_feedback ?? null)
    : null
  const hasAudio = Boolean(submission.audio_url)
  const voicePending = hasAudio && voiceGrade === null

  return NextResponse.json({
    autoGraded: isOfficiallyGraded,
    provisional: !isOfficiallyGraded,
    grade,
    voiceGrade,
    finalGrade: calculateFinalGrade(grade, voiceGrade),
    feedback,
    voiceStatus: voiceGrade !== null ? 'graded' : (hasAudio ? 'awaiting_teacher' : 'none'),
    message: !isOfficiallyGraded
      ? PENDING_REVIEW_MESSAGE
      : (voicePending ? VOICE_PENDING_MESSAGE : undefined),
    submission: clientSafeSubmission(submission),
    duplicate
  })
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (contentLength > MAX_REQUEST_LENGTH) {
    return NextResponse.json({ error: 'حجم الطلب كبير جداً' }, { status: 413 })
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 })
  }
  if (rawBody.length > MAX_REQUEST_LENGTH) {
    return NextResponse.json({ error: 'حجم الطلب كبير جداً' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 })
  }

  const submission = parseSubmissionRequest(body)
  if (!submission) {
    return NextResponse.json({ error: 'بيانات الإجابات غير صالحة' }, { status: 400 })
  }

  let prepared: PreparedStudentSubmission
  try {
    prepared = await callAutoGradingGateway<PreparedStudentSubmission>({
      action: 'prepare_student',
      ...submission
    })
  } catch (error) {
    return gatewayErrorResponse(error)
  }

  // Idempotency short-circuit: same submission_key → no download, no Groq.
  if (prepared.alreadySubmitted && prepared.submission) {
    return responseFromExistingSubmission(prepared.submission, true)
  }

  if (!prepared.questions || !prepared.answers || !prepared.story) {
    return NextResponse.json({ error: 'تعذر تجهيز نموذج التقييم' }, { status: 500 })
  }

  const storyContent = prepared.story.content_arabic.slice(0, 30_000)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  let voiceLimitMessage: string | undefined

  // Parallel text + voice after prepare succeeds. One path failing must not cancel the other.
  const [textSettled, voiceSettled] = await Promise.allSettled([
    autoGradeSubmission({
      questions: prepared.questions,
      answers: prepared.answers,
      storyContent,
      storyTitle: prepared.story.title_arabic,
      difficulty: prepared.story.difficulty,
      gradeLevel: prepared.story.grade_level
    }),
    (async (): Promise<{ voiceGrade: number; feedback: string } | null> => {
      if (
        typeof prepared.reusedVoiceGrade === 'number'
        && Number.isInteger(prepared.reusedVoiceGrade)
        && prepared.reusedVoiceGrade >= 0
        && prepared.reusedVoiceGrade <= 100
        && typeof prepared.reusedVoiceFeedback === 'string'
        && prepared.reusedVoiceFeedback.trim()
      ) {
        // Existing voice_grade for same audio — no new Groq / no new ledger row.
        return {
          voiceGrade: prepared.reusedVoiceGrade,
          feedback: prepared.reusedVoiceFeedback.trim()
        }
      }

      if (prepared.voiceLimitReached) {
        voiceLimitMessage = VOICE_ATTEMPTS_EXHAUSTED_MESSAGE
        return null
      }

      if (!submission.audioUrl || !prepared.audioSignedUrl || !supabaseUrl) return null

      // Atomic reserve BEFORE download / Groq. Counts even if Whisper fails.
      let reserve: VoiceAttemptReserveResult
      try {
        const reserved = await callAutoGradingGateway<{
          allowed: boolean
          shouldCallGroq: boolean
        }>({
          action: 'reserve_voice_attempt',
          ...submission
        })
        reserve = {
          allowed: reserved.allowed,
          should_call_groq: reserved.shouldCallGroq
        }
      } catch (error) {
        if (error instanceof AutoGradingGatewayError && error.status === 403) {
          voiceLimitMessage = VOICE_ATTEMPTS_EXHAUSTED_MESSAGE
          return null
        }
        throw error
      }

      const decision = decideVoiceGroqCall({
        hasReusedVoiceGrade: false,
        hasSignedAudio: true,
        reserve
      })
      if (!decision.callGroq) {
        if (decision.skipReason === 'limit_reached') {
          voiceLimitMessage = VOICE_ATTEMPTS_EXHAUSTED_MESSAGE
        }
        // Same key retry: already reserved — do not re-call Groq automatically.
        return null
      }

      return gradeStudentVoiceRecording({
        signedAudioUrl: prepared.audioSignedUrl,
        supabaseUrl,
        storyContent,
        expectedStoryId: submission.storyId
      })
    })()
  ])

  // Drop signed URL reference ASAP — never include in responses or thrown errors.
  prepared.audioSignedUrl = null

  let gradingResult: GradingResult | null = null
  if (textSettled.status === 'fulfilled') {
    gradingResult = textSettled.value
  } else {
    console.error('Groq auto-grading failed; preserving the submission for teacher review', redactSensitive(textSettled.reason))
  }

  let voiceResult: { voiceGrade: number; feedback: string } | null = null
  if (voiceSettled.status === 'fulfilled') {
    voiceResult = voiceSettled.value
  } else {
    console.error('Voice auto-grading failed; leaving voice_grade unset', redactSensitive(voiceSettled.reason))
  }

  try {
    const usedOnlyDeterministicMultipleChoice = Boolean(
      gradingResult
      && prepared.questions.every(canGradeMultipleChoiceDeterministically)
    )

    const persisted = await callAutoGradingGateway<{ submission: PreparedStudentSubmission['submission']; duplicate: boolean }>({
      action: 'persist_student',
      ...submission,
      autoGrade: gradingResult?.grade ?? null,
      autoFeedback: gradingResult?.feedback ?? null,
      voiceGrade: voiceResult?.voiceGrade ?? null,
      voiceFeedback: voiceResult?.feedback ?? null,
      autoGradingMetadata: {
        ...(gradingResult ? {
          confidence: gradingResult.confidence,
          requires_review: false,
          question_scores: gradingResult.questionScores,
          model: usedOnlyDeterministicMultipleChoice
            ? 'deterministic-multiple-choice'
            : 'openai/gpt-oss-20b'
        } : {}),
        ...(voiceResult ? {
          voice_wer_based: true,
          voice_reused: typeof prepared.reusedVoiceGrade === 'number'
        } : {}),
        voice_pending_teacher_review: Boolean(submission.audioUrl) && !voiceResult,
        ...(voiceLimitMessage ? { voice_attempt_limit_reached: true } : {})
      }
    })

    if (persisted.duplicate && persisted.submission) {
      return responseFromExistingSubmission(persisted.submission, true)
    }

    const textOutcome = describeAutoGradeClientOutcome(
      gradingResult ? { grade: gradingResult.grade, feedback: gradingResult.feedback } : null
    )
    const voiceGrade = voiceResult?.voiceGrade ?? null
    const finalized = textOutcome.autoGraded || voiceGrade !== null
    const feedbackParts = [textOutcome.feedback, voiceResult?.feedback].filter(Boolean)

    return NextResponse.json({
      autoGraded: finalized,
      provisional: !finalized,
      grade: textOutcome.grade,
      voiceGrade,
      finalGrade: calculateFinalGrade(textOutcome.grade, voiceGrade),
      feedback: feedbackParts.length ? feedbackParts.join(' ') : null,
      voiceStatus: voiceGrade !== null ? 'graded' : (submission.audioUrl ? 'awaiting_teacher' : 'none'),
      message: voiceLimitMessage
        || (!finalized
          ? PENDING_REVIEW_MESSAGE
          : (submission.audioUrl && voiceGrade === null ? VOICE_PENDING_MESSAGE : undefined)),
      submission: persisted.submission ? clientSafeSubmission(persisted.submission) : null,
      duplicate: persisted.duplicate
    }, { status: persisted.duplicate ? 200 : 201 })
  } catch (error) {
    return gatewayErrorResponse(error)
  }
}
