/**
 * Pure attempt-limit helpers (mirror SQL ledger rules for local tests / UI copy).
 * Hard cap: exactly 2 AI voice attempts per (student_id, story_id).
 * Source of truth after migration: reserve_voice_grading_attempt RPC.
 */

export const VOICE_GRADING_MAX_ATTEMPTS = 2 as const

export const VOICE_ATTEMPTS_EXHAUSTED_MESSAGE =
  'تم استخدام محاولتي التقييم الصوتي لهذه القصة'

export type VoiceAttemptStatus = {
  attempts_used: number
  attempts_remaining: number
  max_attempts: typeof VOICE_GRADING_MAX_ATTEMPTS
  limit_reached: boolean
}

/** Server-only reserve result — never expose attempt_id to browsers. */
export type VoiceAttemptReserveResult = {
  allowed: boolean
  should_call_groq: boolean
}

export function formatVoiceAttemptsRemainingMessage(remaining: number): string | null {
  if (remaining <= 0) return VOICE_ATTEMPTS_EXHAUSTED_MESSAGE
  if (remaining === 1) return 'متبقية محاولة واحدة للتقييم الصوتي'
  if (remaining === 2) return 'متبقي محاولتان للتقييم الصوتي'
  return VOICE_ATTEMPTS_EXHAUSTED_MESSAGE
}

export function decideVoiceGroqCall(options: {
  hasReusedVoiceGrade: boolean
  hasSignedAudio: boolean
  reserve: VoiceAttemptReserveResult | null
}): { callGroq: boolean; skipReason: string | null } {
  if (options.hasReusedVoiceGrade) {
    return { callGroq: false, skipReason: 'reused_voice_grade' }
  }
  if (!options.hasSignedAudio) {
    return { callGroq: false, skipReason: 'no_signed_audio' }
  }
  if (!options.reserve) {
    return { callGroq: false, skipReason: 'missing_reserve' }
  }
  if (!options.reserve.should_call_groq) {
    return {
      callGroq: false,
      skipReason: options.reserve.allowed ? 'duplicate_or_blocked' : 'limit_reached'
    }
  }
  if (!options.reserve.allowed) {
    return { callGroq: false, skipReason: 'limit_reached' }
  }
  return { callGroq: true, skipReason: null }
}

type LedgerRow = {
  studentId: string
  storyId: string
  submissionKey: string
  attemptNumber: 1 | 2
}

/** In-memory ledger used only by selftests to prove atomic reservation semantics. */
export class InMemoryVoiceAttemptLedger {
  private rows: LedgerRow[] = []
  private chains = new Map<string, Promise<unknown>>()

  snapshot() {
    return this.rows.map(row => ({ ...row }))
  }

  async status(studentId: string, storyId: string): Promise<VoiceAttemptStatus> {
    const used = this.rows.filter(r => r.studentId === studentId && r.storyId === storyId).length
    return {
      attempts_used: used,
      attempts_remaining: Math.max(VOICE_GRADING_MAX_ATTEMPTS - used, 0),
      max_attempts: VOICE_GRADING_MAX_ATTEMPTS,
      limit_reached: used >= VOICE_GRADING_MAX_ATTEMPTS
    }
  }

  async reserve(
    studentId: string,
    storyId: string,
    submissionKey: string
  ): Promise<VoiceAttemptReserveResult> {
    const lockKey = `${studentId}:${storyId}`
    const previous = this.chains.get(lockKey) || Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    this.chains.set(lockKey, previous.then(() => gate))
    await previous

    try {
      const existing = this.rows.find(r => r.submissionKey === submissionKey)
      if (existing) {
        if (existing.studentId !== studentId || existing.storyId !== storyId) {
          throw new Error('Voice grading attempt is not authorized')
        }
        return { allowed: true, should_call_groq: false }
      }

      const used = this.rows.filter(r => r.studentId === studentId && r.storyId === storyId).length
      if (used >= VOICE_GRADING_MAX_ATTEMPTS) {
        return { allowed: false, should_call_groq: false }
      }

      const attemptNumber = (used + 1) as 1 | 2
      if (attemptNumber !== 1 && attemptNumber !== 2) {
        return { allowed: false, should_call_groq: false }
      }
      if (this.rows.some(r => r.studentId === studentId && r.storyId === storyId && r.attemptNumber === attemptNumber)) {
        return { allowed: false, should_call_groq: false }
      }

      this.rows.push({ studentId, storyId, submissionKey, attemptNumber })
      return { allowed: true, should_call_groq: true }
    } finally {
      release()
    }
  }
}
