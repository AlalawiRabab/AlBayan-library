/**
 * Safe retry design for existing submissions with audio_url and voice_grade IS NULL.
 *
 * Not executed in bulk. After explicit approval, a single authorized server call may:
 * 1. Load one submission by id with service role / secure gateway.
 * 2. Verify ownership path under student-recordings/voice-recordings/{student}/{story}/...
 * 3. Skip if voice_grade is already set (idempotent).
 * 4. Transcribe + score, then UPDATE voice_grade (+ metadata.voice_feedback) only.
 * 5. Never rewrite unrelated student/classroom rows; never delete storage objects.
 */
export type VoiceRegradeCandidate = {
  submissionId: string
  hasAudio: boolean
  voiceGrade: number | null
}

export function shouldAttemptVoiceRegrade(candidate: VoiceRegradeCandidate): boolean {
  return Boolean(candidate.submissionId)
    && candidate.hasAudio
    && (candidate.voiceGrade === null || candidate.voiceGrade === undefined)
}
