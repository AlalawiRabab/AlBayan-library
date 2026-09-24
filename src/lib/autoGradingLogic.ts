export type GradingQuestion = {
  id: string
  text_arabic: string
  type: string
  required: boolean
  options?: string[]
  correct_answer?: string | null
}

export type QuestionScore = {
  questionId: string
  score: number
  reason: string
}

export type GradingResult = {
  grade: number
  feedback: string
  confidence: number
  requiresReview: boolean
  questionScores: QuestionScore[]
}

export type PersistedAutoGradeFields = {
  auto_graded: number | null
  auto_feedback: string | null
  grade: number | null
  feedback_arabic: string | null
  status: 'pending' | 'graded'
  graded_at: string | null
}

export type AutoGradeClientOutcome = {
  autoGraded: boolean
  provisional: boolean
  grade: number | null
  feedback: string | null
  persist: PersistedAutoGradeFields
}

/**
 * Official grade promotion fields.
 * Note: DB column auto_graded is an integer score (0-100), not a boolean.
 * Presence of auto_graded + status='graded' + grade set means auto-grading succeeded.
 */
export function buildPersistedAutoGradeFields(
  grading: { grade: number; feedback: string } | null,
  gradedAtIso = new Date().toISOString()
): PersistedAutoGradeFields {
  if (!grading) {
    return {
      auto_graded: null,
      auto_feedback: null,
      grade: null,
      feedback_arabic: null,
      status: 'pending',
      graded_at: null
    }
  }

  return {
    auto_graded: grading.grade,
    auto_feedback: grading.feedback,
    grade: grading.grade,
    feedback_arabic: grading.feedback,
    status: 'graded',
    graded_at: gradedAtIso
  }
}

/** API + persist contract after Groq success, failure, or timeout. */
export function describeAutoGradeClientOutcome(
  grading: { grade: number; feedback: string } | null,
  gradedAtIso = new Date().toISOString()
): AutoGradeClientOutcome {
  const persist = buildPersistedAutoGradeFields(grading, gradedAtIso)
  const finalized = grading !== null
  return {
    autoGraded: finalized,
    provisional: !finalized,
    grade: finalized ? grading.grade : null,
    feedback: finalized ? grading.feedback : null,
    persist
  }
}

/** Detect nonsense/random answers used for score clamping. */
export function isNonsenseAnswer(answer: string): boolean {
  if (!answer || answer.trim().length < 2) return true

  const trimmedAnswer = answer.trim()
  const repeatedCharRegex = /^(\S)\1{3,}$/
  if (repeatedCharRegex.test(trimmedAnswer)) return true

  const hasOnlyLatinChars = /^[a-zA-Z\s]+$/.test(trimmedAnswer)
  if (hasOnlyLatinChars && trimmedAnswer.length <= 5) return true

  if (trimmedAnswer.length < 3 && !/[\u0600-\u06FF]/.test(trimmedAnswer)) return true

  return false
}

export function hasPromptInjectionRisk(answers: Record<string, string>) {
  const combinedAnswers = Object.values(answers).join(' ').toLocaleLowerCase('ar')
  const suspiciousPatterns = [
    /ignore\s+(all|any|previous|prior|system|developer)\s+(instructions?|messages?)/i,
    /system\s+prompt|developer\s+message|assistant\s+message/i,
    /return\s+(a\s+)?(grade|score)\s*(of|:)\s*100/i,
    /تجاهل\s+(كل|أي|جميع)?\s*(التعليمات|الأوامر|الرسائل)/,
    /(أعطني|امنحني|ضع)\s+(درجة|تقييم)\s*(100|مئة)/
  ]
  return suspiciousPatterns.some(pattern => pattern.test(combinedAnswers))
}

export function canGradeMultipleChoiceDeterministically(question: GradingQuestion) {
  return question.type === 'multiple_choice'
    && typeof question.correct_answer === 'string'
    && question.correct_answer.trim().length > 0
}

export function gradeMultipleChoiceQuestion(
  question: GradingQuestion,
  answer: string
): QuestionScore {
  const correct = (question.correct_answer || '').trim()
  const given = (answer || '').trim()
  const isCorrect = correct.length > 0 && given === correct
  return {
    questionId: question.id,
    score: isCorrect ? 100 : 0,
    reason: isCorrect
      ? 'إجابة اختيار من متعدد صحيحة.'
      : 'إجابة اختيار من متعدد غير مطابقة للإجابة الصحيحة.'
  }
}

export function stripCorrectAnswersForClient<T extends GradingQuestion>(questions: T[]): Omit<T, 'correct_answer'>[] {
  return questions.map(question => {
    const { correct_answer: _omittedCorrectAnswer, ...rest } = question
    void _omittedCorrectAnswer
    return rest
  })
}

export function parseGradingResponse(
  response: string,
  questions: GradingQuestion[],
  answers: Record<string, string>
): GradingResult {
  const parsed = JSON.parse(response) as {
    grade?: unknown
    feedback?: unknown
    confidence?: unknown
    question_scores?: Array<{ question_id?: unknown; score?: unknown; reason?: unknown }>
  }
  const reportedGrade = Number(parsed.grade)
  const feedback = typeof parsed.feedback === 'string' ? parsed.feedback.trim() : ''
  const confidence = Number(parsed.confidence)
  const expectedIds = new Set(questions.map(question => question.id))
  const seenIds = new Set<string>()
  const questionScores = (parsed.question_scores || []).map(item => {
    const questionId = typeof item.question_id === 'string' ? item.question_id : ''
    const score = Number(item.score)
    const reason = typeof item.reason === 'string' ? item.reason.trim() : ''
    if (!expectedIds.has(questionId) || seenIds.has(questionId) || !Number.isInteger(score) || score < 0 || score > 100 || !reason) {
      throw new Error('Groq returned an invalid per-question result')
    }
    seenIds.add(questionId)
    return { questionId, score, reason }
  })

  if (
    !Number.isInteger(reportedGrade) ||
    reportedGrade < 0 ||
    reportedGrade > 100 ||
    !feedback ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1 ||
    questionScores.length !== questions.length ||
    seenIds.size !== expectedIds.size
  ) {
    throw new Error('Groq returned an invalid grading result')
  }

  let grade = Math.round(questionScores.reduce((total, item) => total + item.score, 0) / questionScores.length)
  if (Math.abs(reportedGrade - grade) > 10) {
    throw new Error('Groq returned an inconsistent grading result')
  }
  const nonsenseCount = questions.filter(question => isNonsenseAnswer(answers[question.id] || '')).length
  const promptInjectionRisk = hasPromptInjectionRisk(answers)

  if (nonsenseCount > questions.length / 2) grade = Math.min(grade, 20)
  else if (nonsenseCount > 0) grade = Math.min(grade, 60)
  if (promptInjectionRisk) grade = Math.min(grade, 20)

  return {
    grade,
    feedback,
    confidence,
    requiresReview: false,
    questionScores
  }
}

export function mergeQuestionScores(
  allQuestions: GradingQuestion[],
  scores: QuestionScore[],
  feedbackParts: string[],
  confidenceValues: number[]
): GradingResult {
  const byId = new Map(scores.map(score => [score.questionId, score]))
  const ordered = allQuestions.map(question => {
    const score = byId.get(question.id)
    if (!score) throw new Error('Missing per-question score while merging grades')
    return score
  })

  const grade = Math.round(ordered.reduce((total, item) => total + item.score, 0) / ordered.length)
  const feedback = feedbackParts.map(part => part.trim()).filter(Boolean).join(' ')
  if (!feedback) throw new Error('Missing grading feedback')
  if (!Number.isInteger(grade) || grade < 0 || grade > 100) throw new Error('Invalid merged grade')

  const confidence = confidenceValues.length
    ? confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length
    : 1

  return {
    grade,
    feedback: feedback.slice(0, 1200),
    confidence,
    requiresReview: false,
    questionScores: ordered
  }
}

export function buildDeterministicMultipleChoiceResult(
  questions: GradingQuestion[],
  answers: Record<string, string>
): GradingResult {
  const scores = questions.map(question => gradeMultipleChoiceQuestion(question, answers[question.id] || ''))
  const correctCount = scores.filter(score => score.score === 100).length
  const feedback = correctCount === questions.length
    ? 'أحسنتِ! أجبتِ على جميع أسئلة الاختيار من متعدد بشكل صحيح.'
    : `تم تصحيح أسئلة الاختيار من متعدد: ${correctCount} من ${questions.length} صحيحة. راجعي الإجابات غير المطابقة.`

  return mergeQuestionScores(questions, scores, [feedback], [1])
}
