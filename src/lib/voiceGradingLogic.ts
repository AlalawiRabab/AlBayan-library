import { tokenizeArabicWords } from '@/lib/arabicText'

export type WordEditCounts = {
  referenceWords: number
  hypothesisWords: number
  correct: number
  substitutions: number
  deletions: number
  insertions: number
}

export type VoiceGradeResult = {
  voiceGrade: number
  feedback: string
  edits: WordEditCounts
  wer: number
}

const MIN_REFERENCE_WORDS = 3

/**
 * Word-level Levenshtein alignment counts (WER components).
 */
export function computeWordEditCounts(reference: string[], hypothesis: string[]): WordEditCounts {
  const n = reference.length
  const m = hypothesis.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))

  for (let i = 0; i <= n; i += 1) dp[i][0] = i
  for (let j = 0; j <= m; j += 1) dp[0][j] = j

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const cost = reference[i - 1] === hypothesis[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }

  let i = n
  let j = m
  let correct = 0
  let substitutions = 0
  let deletions = 0
  let insertions = 0

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && reference[i - 1] === hypothesis[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      correct += 1
      i -= 1
      j -= 1
      continue
    }
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      substitutions += 1
      i -= 1
      j -= 1
      continue
    }
    if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      insertions += 1
      j -= 1
      continue
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      deletions += 1
      i -= 1
      continue
    }
    // Fallback for equal-cost ties.
    if (i > 0 && j > 0) {
      if (reference[i - 1] === hypothesis[j - 1]) correct += 1
      else substitutions += 1
      i -= 1
      j -= 1
    } else if (j > 0) {
      insertions += 1
      j -= 1
    } else {
      deletions += 1
      i -= 1
    }
  }

  return {
    referenceWords: n,
    hypothesisWords: m,
    correct,
    substitutions,
    deletions,
    insertions
  }
}

export function wordErrorRate(edits: WordEditCounts): number {
  if (edits.referenceWords <= 0) return 1
  return (edits.substitutions + edits.deletions + edits.insertions) / edits.referenceWords
}

export function voiceGradeFromWer(wer: number): number {
  if (!Number.isFinite(wer) || wer < 0) return 0
  const grade = Math.round((1 - Math.min(wer, 1)) * 100)
  return Math.max(0, Math.min(100, grade))
}

export function buildVoiceFeedback(voiceGrade: number): string {
  if (voiceGrade >= 90) return 'قراءة ممتازة ودقيقة.'
  if (voiceGrade >= 70) return 'قراءة جيدة مع بعض الكلمات غير المطابقة.'
  return 'تحتاج القراءة إلى مزيد من التدريب.'
}

/**
 * Deterministic reading accuracy score from story text vs transcript.
 * Returns null for empty/unusable transcripts (do not invent a zero).
 */
export function gradeReadingTranscript(
  storyContent: string,
  transcript: string
): VoiceGradeResult | null {
  const reference = tokenizeArabicWords(storyContent)
  const hypothesis = tokenizeArabicWords(transcript)

  if (reference.length < MIN_REFERENCE_WORDS) return null
  if (hypothesis.length === 0) return null

  const edits = computeWordEditCounts(reference, hypothesis)
  const wer = wordErrorRate(edits)
  const voiceGrade = voiceGradeFromWer(wer)

  return {
    voiceGrade,
    feedback: buildVoiceFeedback(voiceGrade),
    edits,
    wer
  }
}

/** Canonical final average used across student/admin UIs. */
export function calculateFinalGrade(grade?: number | null, voiceGrade?: number | null): number | null {
  if (grade !== null && grade !== undefined && voiceGrade !== null && voiceGrade !== undefined) {
    return Math.round((grade + voiceGrade) / 2)
  }
  return grade ?? voiceGrade ?? null
}
