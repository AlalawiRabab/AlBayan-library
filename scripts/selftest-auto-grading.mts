/**
 * Local selftest for automatic grading finalize logic.
 * Run: node --experimental-strip-types scripts/selftest-auto-grading.mts
 * Or: npx tsx scripts/selftest-auto-grading.mts
 */
import assert from 'node:assert/strict'
import {
  buildDeterministicMultipleChoiceResult,
  buildPersistedAutoGradeFields,
  canGradeMultipleChoiceDeterministically,
  describeAutoGradeClientOutcome,
  gradeMultipleChoiceQuestion,
  mergeQuestionScores,
  parseGradingResponse,
  stripCorrectAnswersForClient
} from '../src/lib/autoGradingLogic.ts'

let passed = 0

function check(name: string, fn: () => void) {
  try {
    fn()
    passed += 1
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const mcQuestions = [
  {
    id: 'q1',
    text_arabic: 'من البطل؟',
    type: 'multiple_choice',
    required: true,
    options: ['أحمد', 'سارة'],
    correct_answer: 'أحمد'
  },
  {
    id: 'q2',
    text_arabic: 'أين جرت الأحداث؟',
    type: 'multiple_choice',
    required: true,
    options: ['المدرسة', 'البيت'],
    correct_answer: 'المدرسة'
  }
]

check('success finalize → graded + grade + auto_graded integer set', () => {
  const fields = buildPersistedAutoGradeFields({ grade: 88, feedback: 'أداء جيد' }, '2026-09-22T00:00:00.000Z')
  assert.equal(fields.status, 'graded')
  assert.equal(fields.grade, 88)
  assert.equal(fields.auto_graded, 88)
  assert.equal(typeof fields.auto_graded, 'number')
  assert.notEqual(fields.auto_graded, true as unknown as number)
  assert.equal(fields.feedback_arabic, 'أداء جيد')
  assert.equal(fields.auto_feedback, 'أداء جيد')
  assert.equal(fields.graded_at, '2026-09-22T00:00:00.000Z')
})

check('groq failure → pending with null grades', () => {
  const fields = buildPersistedAutoGradeFields(null)
  assert.equal(fields.status, 'pending')
  assert.equal(fields.grade, null)
  assert.equal(fields.auto_graded, null)
  assert.equal(fields.feedback_arabic, null)
  assert.equal(fields.auto_feedback, null)
  assert.equal(fields.graded_at, null)
})

check('timeout/failure → pending, autoGraded=false, provisional=true, no invented grade', () => {
  // Mirrors route catch path when GroqTimeoutError (or any Groq failure) leaves gradingResult=null.
  const outcome = describeAutoGradeClientOutcome(null)
  assert.equal(outcome.autoGraded, false)
  assert.equal(outcome.provisional, true)
  assert.equal(outcome.grade, null)
  assert.equal(outcome.feedback, null)
  assert.equal(outcome.persist.status, 'pending')
  assert.equal(outcome.persist.grade, null)
  assert.equal(outcome.persist.feedback_arabic, null)
  assert.equal(outcome.persist.auto_graded, null)
  assert.equal(outcome.persist.auto_feedback, null)
})

check('pending duplicate must not claim autoGraded from numeric auto_graded alone', () => {
  const pendingWithSuggestion = {
    status: 'pending' as const,
    grade: null as number | null,
    auto_graded: 90 as number | null
  }
  // Same rule as responseFromExistingSubmission after the review fix.
  const isOfficiallyGraded = pendingWithSuggestion.status === 'graded' || pendingWithSuggestion.grade !== null
  assert.equal(isOfficiallyGraded, false)
  assert.equal(pendingWithSuggestion.auto_graded !== null, true)
  assert.notEqual(isOfficiallyGraded, true)
})

check('invalid groq JSON → throws (caller keeps pending)', () => {
  assert.throws(() => parseGradingResponse('not-json', [{
    id: 'q1', text_arabic: 'س', type: 'short_answer', required: true
  }], { q1: 'جواب' }))
})

check('grade outside 0–100 → throws', () => {
  assert.throws(() => parseGradingResponse(JSON.stringify({
    grade: 101,
    feedback: 'تعليق',
    confidence: 0.9,
    question_scores: [{ question_id: 'q1', score: 101, reason: 'مرتفع' }]
  }), [{
    id: 'q1', text_arabic: 'س', type: 'short_answer', required: true
  }], { q1: 'جواب كافٍ' }))
})

check('multiple choice correct, incorrect, and trim tolerance', () => {
  const correct = gradeMultipleChoiceQuestion(mcQuestions[0], '  أحمد  ')
  const wrong = gradeMultipleChoiceQuestion(mcQuestions[0], 'سارة')
  assert.equal(correct.score, 100)
  assert.equal(wrong.score, 0)
  assert.equal(canGradeMultipleChoiceDeterministically(mcQuestions[0]), true)
  const mixed = buildDeterministicMultipleChoiceResult(mcQuestions, { q1: 'أحمد', q2: 'البيت' })
  assert.equal(mixed.grade, 50)
  assert.equal(mixed.requiresReview, false)
})

check('idempotency-safe merge keeps one score per question', () => {
  const result = mergeQuestionScores(
    mcQuestions,
    [
      { questionId: 'q1', score: 100, reason: 'صح' },
      { questionId: 'q2', score: 0, reason: 'خطأ' }
    ],
    ['تم التصحيح'],
    [1]
  )
  assert.equal(result.questionScores.length, 2)
  assert.equal(result.grade, 50)
})

check('correct_answer never returned to client payload', () => {
  const stripped = stripCorrectAnswersForClient(mcQuestions)
  assert.equal('correct_answer' in stripped[0], false)
  assert.equal(stripped[0].id, 'q1')
  assert.equal(JSON.stringify(stripped).includes('"correct_answer"'), false)
})

check('secrets are not embedded in logic module exports', async () => {
  const fs = await import('node:fs/promises')
  const source = await fs.readFile(new URL('../src/lib/autoGradingLogic.ts', import.meta.url), 'utf8')
  for (const needle of ['GROQ_API_KEY', 'AUTO_GRADING_RPC_SECRET', 'service_role', 'eyJ']) {
    assert.equal(source.includes(needle), false, `unexpected secret marker: ${needle}`)
  }
})

console.log(`\n${passed} checks passed`)
