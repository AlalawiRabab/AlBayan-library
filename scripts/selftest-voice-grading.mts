/**
 * Local selftest for automatic voice/reading grading.
 * Run: npx tsx scripts/selftest-voice-grading.mts
 */
import assert from 'node:assert/strict'
import {
  assertTrustedSignedAudioUrl,
  isOwnedModernVoicePath,
  MAX_VOICE_BYTES
} from '../src/lib/voiceAudioGuard.ts'
import {
  calculateFinalGrade,
  gradeReadingTranscript,
  voiceGradeFromWer,
  computeWordEditCounts,
  wordErrorRate
} from '../src/lib/voiceGradingLogic.ts'
import { normalizeArabicForReading, tokenizeArabicWords } from '../src/lib/arabicText.ts'
import { shouldAttemptVoiceRegrade } from '../src/lib/voiceGradingRetry.ts'

let passed = 0
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1
      console.log(`PASS ${name}`)
    })
    .catch(error => {
      console.error(`FAIL ${name}`)
      throw error
    })
}

const story = 'ذهبت سارة إلى المدرسة في الصباح الباكر مع صديقتها'
const studentA = '11111111-1111-4111-8111-111111111111'
const studentB = '22222222-2222-4222-8222-222222222222'
const storyId = '33333333-3333-4333-8333-333333333333'
const host = 'aiigbtezdnfnfslrnxgs.supabase.co'

await check('full match → voice_grade=100', () => {
  const result = gradeReadingTranscript(story, story)
  assert.ok(result)
  assert.equal(result.voiceGrade, 100)
  assert.match(result.feedback, /ممتازة/)
})

await check('deletions lower the score', () => {
  const result = gradeReadingTranscript(story, 'ذهبت سارة إلى المدرسة')
  assert.ok(result)
  assert.ok(result.voiceGrade < 100)
  assert.ok(result.edits.deletions > 0)
})

await check('substitutions lower the score', () => {
  const result = gradeReadingTranscript(story, 'ذهبت نورة إلى المدرسة في الصباح الباكر مع صديقتها')
  assert.ok(result)
  assert.ok(result.voiceGrade < 100)
  assert.ok(result.edits.substitutions >= 1)
})

await check('insertions lower the score', () => {
  const result = gradeReadingTranscript(story, `${story} ثم رجعت بسرعة إلى البيت`)
  assert.ok(result)
  assert.ok(result.voiceGrade < 100)
  assert.ok(result.edits.insertions > 0)
})

await check('empty/silent transcript → null not zero', () => {
  assert.equal(gradeReadingTranscript(story, ''), null)
  assert.equal(gradeReadingTranscript(story, '   '), null)
  assert.equal(gradeReadingTranscript(story, '!!!'), null)
})

await check('diacritics/tatweel normalization is conservative', () => {
  const a = tokenizeArabicWords('ذَهَبَتْ سَارَةُ')
  const b = tokenizeArabicWords('ذهبت سارة')
  assert.deepEqual(a, b)
  assert.equal(normalizeArabicForReading('المـــدرسة'), 'المدرسة')
})

await check('grade=0 questions + successful voice → final average not stuck at 0', () => {
  assert.equal(calculateFinalGrade(0, 100), 50)
  assert.equal(calculateFinalGrade(0, null), 0)
  assert.equal(calculateFinalGrade(null, 80), 80)
})

await check('WER helpers stay in 0–100', () => {
  const edits = computeWordEditCounts(['ا', 'ب', 'ج'], ['ا', 'س', 'ج', 'د'])
  const wer = wordErrorRate(edits)
  const grade = voiceGradeFromWer(wer)
  assert.ok(grade >= 0 && grade <= 100)
})

await check('retry helper skips already graded voice', () => {
  assert.equal(shouldAttemptVoiceRegrade({ submissionId: 'x', hasAudio: true, voiceGrade: null }), true)
  assert.equal(shouldAttemptVoiceRegrade({ submissionId: 'x', hasAudio: true, voiceGrade: 90 }), false)
  assert.equal(shouldAttemptVoiceRegrade({ submissionId: 'x', hasAudio: false, voiceGrade: null }), false)
})

await check('rejects external and public (non-signed) audio URLs', () => {
  assert.throws(() => assertTrustedSignedAudioUrl('https://evil.example/file.webm', host))
  assert.throws(() => assertTrustedSignedAudioUrl(
    `https://${host}/storage/v1/object/public/student-recordings/voice-recordings/${studentA}/${storyId}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webm`,
    host
  ))
  assert.ok(MAX_VOICE_BYTES === 10 * 1024 * 1024)
})

await check('accepts modern prepare_audio_upload signed path for owning student', () => {
  const file = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webm'
  const owned = `voice-recordings/${studentA}/${storyId}/${file}`
  assert.equal(isOwnedModernVoicePath(owned, studentA, storyId), true)
  assert.equal(isOwnedModernVoicePath(owned, studentB, storyId), false)
  assert.equal(isOwnedModernVoicePath(`voice-recordings/${studentA}/other/${file}`, studentA, storyId), false)

  const signed = `https://${host}/storage/v1/object/sign/student-recordings/${owned}?token=x`
  assert.doesNotThrow(() => assertTrustedSignedAudioUrl(signed, host))
})

await check('rejects another student id inside an otherwise valid signed path', () => {
  const file = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webm'
  const otherPath = `voice-recordings/${studentB}/${storyId}/${file}`
  assert.equal(isOwnedModernVoicePath(otherPath, studentA, storyId), false)
})

await check('timeout budgets fit under route maxDuration=60 (parallel)', async () => {
  const fs = await import('node:fs/promises')
  const voiceSrc = await fs.readFile(new URL('../src/lib/groqVoice.ts', import.meta.url), 'utf8')
  const groqSrc = await fs.readFile(new URL('../src/lib/groq.ts', import.meta.url), 'utf8')
  const routeSrc = await fs.readFile(new URL('../src/app/api/student/submit-and-auto-grade/route.ts', import.meta.url), 'utf8')

  assert.match(voiceSrc, /GROQ_VOICE_TIMEOUT_MS = 20_000/)
  assert.match(voiceSrc, /VOICE_DOWNLOAD_TIMEOUT_MS = 15_000/)
  assert.match(groqSrc, /GROQ_GRADING_TIMEOUT_MS = 25_000/)
  assert.match(routeSrc, /maxDuration = 60/)
  assert.match(routeSrc, /Promise\.allSettled/)

  // Text and voice run in parallel — wall clock ≈ max(paths), not sum.
  const textBudget = 25_000
  const voiceBudget = 15_000 + 20_000
  const routeMaxDurationMs = 60_000
  const preparePersistHeadroomMs = 10_000
  assert.ok(Math.max(textBudget, voiceBudget) + preparePersistHeadroomMs <= routeMaxDurationMs)
  assert.ok(20_000 < 45_000, 'Whisper must not use 45s under a 60s route')
})

await check('Promise.allSettled isolation model (one failure keeps the other)', async () => {
  const [a, b] = await Promise.allSettled([
    Promise.resolve({ grade: 90 }),
    Promise.reject(new Error('voice boom'))
  ])
  assert.equal(a.status, 'fulfilled')
  if (a.status === 'fulfilled') assert.equal(a.value.grade, 90)
  assert.equal(b.status, 'rejected')
})

await check('route never returns signed URLs; redacts logs', async () => {
  const fs = await import('node:fs/promises')
  const route = await fs.readFile(new URL('../src/app/api/student/submit-and-auto-grade/route.ts', import.meta.url), 'utf8')
  assert.match(route, /clientSafeSubmission/)
  assert.match(route, /redactSensitive/)
  assert.match(route, /alreadySubmitted/)
  assert.match(route, /prepared\.audioSignedUrl = null/)
  // Must not put audioSignedUrl into any response payload object literal key.
  assert.equal(/\baudioSignedUrl\s*:/.test(route), false)
})

await check('no transcript/secrets leaked by logic modules', async () => {
  const fs = await import('node:fs/promises')
  for (const relative of [
    '../src/lib/voiceGradingLogic.ts',
    '../src/lib/arabicText.ts',
    '../src/lib/voiceGradingRetry.ts',
    '../src/lib/voiceAudioGuard.ts'
  ]) {
    const source = await fs.readFile(new URL(relative, import.meta.url), 'utf8')
    for (const needle of ['GROQ_API_KEY', 'AUTO_GRADING_RPC_SECRET', 'service_role', 'eyJ', 'access_code']) {
      assert.equal(source.includes(needle), false, `${relative} has ${needle}`)
    }
  }
})

console.log(`\n${passed} voice checks passed`)
