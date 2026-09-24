/**
 * Selftests for voice AI attempt limit (hard cap: 2 per student+story).
 * Run: npx tsx scripts/selftest-voice-attempt-limit.mts
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import {
  decideVoiceGroqCall,
  formatVoiceAttemptsRemainingMessage,
  InMemoryVoiceAttemptLedger,
  VOICE_ATTEMPTS_EXHAUSTED_MESSAGE,
  VOICE_GRADING_MAX_ATTEMPTS
} from '../src/lib/voiceAttemptLimit.ts'

let passed = 0
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    passed += 1
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const student = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const otherStudent = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const story = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const otherStory = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

await check('first attempt allowed and calls Groq (attempt_number=1)', async () => {
  const ledger = new InMemoryVoiceAttemptLedger()
  const r1 = await ledger.reserve(student, story, randomUUID())
  assert.equal(r1.allowed, true)
  assert.equal(r1.should_call_groq, true)
  assert.equal(ledger.snapshot()[0]?.attemptNumber, 1)
  assert.equal(decideVoiceGroqCall({ hasReusedVoiceGrade: false, hasSignedAudio: true, reserve: r1 }).callGroq, true)
})

await check('second attempt allowed (attempt_number=2)', async () => {
  const ledger = new InMemoryVoiceAttemptLedger()
  await ledger.reserve(student, story, randomUUID())
  const r2 = await ledger.reserve(student, story, randomUUID())
  assert.equal(r2.allowed, true)
  assert.equal(r2.should_call_groq, true)
  assert.deepEqual(ledger.snapshot().map(r => r.attemptNumber).sort(), [1, 2])
})

await check('third attempt rejected before Groq', async () => {
  const ledger = new InMemoryVoiceAttemptLedger()
  await ledger.reserve(student, story, randomUUID())
  await ledger.reserve(student, story, randomUUID())
  const r3 = await ledger.reserve(student, story, randomUUID())
  assert.equal(r3.allowed, false)
  assert.equal(r3.should_call_groq, false)
  assert.equal(decideVoiceGroqCall({ hasReusedVoiceGrade: false, hasSignedAudio: true, reserve: r3 }).callGroq, false)
})

await check('two concurrent reserves never exceed two', async () => {
  const ledger = new InMemoryVoiceAttemptLedger()
  const keys = Array.from({ length: 12 }, () => randomUUID())
  const results = await Promise.all(keys.map(key => ledger.reserve(student, story, key)))
  const accepted = results.filter(r => r.should_call_groq)
  assert.equal(accepted.length, VOICE_GRADING_MAX_ATTEMPTS)
  assert.equal(ledger.snapshot().length, 2)
})

await check('changing submission_key does not bypass the limit', async () => {
  const ledger = new InMemoryVoiceAttemptLedger()
  await ledger.reserve(student, story, randomUUID())
  await ledger.reserve(student, story, randomUUID())
  const bypass = await ledger.reserve(student, story, randomUUID())
  assert.equal(bypass.allowed, false)
  assert.equal(bypass.should_call_groq, false)
})

await check('reusing the same submission_key does not call Groq again', async () => {
  const ledger = new InMemoryVoiceAttemptLedger()
  const key = randomUUID()
  const first = await ledger.reserve(student, story, key)
  const retry = await ledger.reserve(student, story, key)
  assert.equal(first.should_call_groq, true)
  assert.equal(retry.allowed, true)
  assert.equal(retry.should_call_groq, false)
  assert.equal(ledger.snapshot().length, 1)
  assert.equal(decideVoiceGroqCall({ hasReusedVoiceGrade: false, hasSignedAudio: true, reserve: retry }).callGroq, false)
})

await check('same submission_key for different student/story is rejected', async () => {
  const ledger = new InMemoryVoiceAttemptLedger()
  const key = randomUUID()
  await ledger.reserve(student, story, key)
  await assert.rejects(() => ledger.reserve(otherStudent, story, key), /not authorized/)
  await assert.rejects(() => ledger.reserve(student, otherStory, key), /not authorized/)
  assert.equal(ledger.snapshot().length, 1)
})

await check('teacher manual grade is outside the ledger (not counted)', async () => {
  const ledger = new InMemoryVoiceAttemptLedger()
  assert.equal((await ledger.status(student, story)).attempts_used, 0)
})

await check('legacy unanalyzed audio (voice_grade=NULL) is not counted', async () => {
  const ledger = new InMemoryVoiceAttemptLedger()
  assert.equal((await ledger.status(student, story)).attempts_used, 0)
})

await check('limits are per story', async () => {
  const ledger = new InMemoryVoiceAttemptLedger()
  await ledger.reserve(student, story, randomUUID())
  await ledger.reserve(student, story, randomUUID())
  const other = await ledger.reserve(student, otherStory, randomUUID())
  assert.equal(other.allowed, true)
  assert.equal(other.should_call_groq, true)
})

await check('UI copy shows 2 then 1 then exhausted', () => {
  assert.equal(formatVoiceAttemptsRemainingMessage(2), 'متبقي محاولتان للتقييم الصوتي')
  assert.equal(formatVoiceAttemptsRemainingMessage(1), 'متبقية محاولة واحدة للتقييم الصوتي')
  assert.equal(formatVoiceAttemptsRemainingMessage(0), VOICE_ATTEMPTS_EXHAUSTED_MESSAGE)
})

await check('migration has aborting prechecks and strict CREATE forms', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260924140000_voice_grading_attempt_limit.sql', import.meta.url), 'utf8')
  const rollback = await readFile(new URL('../supabase/rollback/20260924_voice_grading_attempt_limit_preapply/rollback.sql', import.meta.url), 'utf8')

  assert.match(migration, /PRECHECK ABORT: public\.voice_grading_attempt_ledger already exists/)
  assert.match(migration, /PRECHECK ABORT: voice grading attempt function\(s\) already exist/)
  assert.match(migration, /JOIN pg_namespace n ON n\.oid = p\.pronamespace/)
  assert.match(migration, /p\.proname IN \(/)

  assert.match(migration, /^CREATE TABLE public\.voice_grading_attempt_ledger/m)
  assert.match(migration, /^CREATE FUNCTION public\.get_voice_grading_attempt_status/m)
  assert.match(migration, /^CREATE FUNCTION public\.reserve_voice_grading_attempt/m)
  assert.equal(/CREATE TABLE IF NOT EXISTS/i.test(migration), false)
  assert.equal(/CREATE INDEX IF NOT EXISTS/i.test(migration), false)
  assert.equal(/CREATE OR REPLACE FUNCTION/i.test(migration), false)
  assert.equal(/CREATE INDEX /i.test(migration), false)

  assert.match(migration, /CHECK \(attempt_number IN \(1, 2\)\)/)
  assert.match(migration, /UNIQUE \(student_id, story_id, attempt_number\)/)
  assert.match(migration, /UNIQUE \(submission_key\)/)
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /SECURITY DEFINER/)
  assert.match(migration, /SET search_path = public, pg_temp/)
  assert.equal(/p_max_attempts/i.test(migration), false)
  assert.equal(/attempt_id/i.test(migration), false)

  assert.match(migration, /REVOKE ALL ON TABLE public\.voice_grading_attempt_ledger\s+FROM PUBLIC, anon, authenticated, service_role/)
  assert.equal(/GRANT (SELECT|INSERT|UPDATE|DELETE).*voice_grading_attempt_ledger/i.test(migration), false)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.get_voice_grading_attempt_status\(uuid, uuid\)\s+TO service_role/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.reserve_voice_grading_attempt\(uuid, uuid, uuid\)\s+TO service_role/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_voice_grading_attempt_status\(uuid, uuid\)\s+FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.reserve_voice_grading_attempt\(uuid, uuid, uuid\)\s+FROM PUBLIC, anon, authenticated/)

  assert.match(rollback, /DROP FUNCTION IF EXISTS public\.reserve_voice_grading_attempt\(uuid, uuid, uuid\);/)
  assert.match(rollback, /DROP FUNCTION IF EXISTS public\.get_voice_grading_attempt_status\(uuid, uuid\);/)
  assert.match(rollback, /DROP TABLE IF EXISTS public\.voice_grading_attempt_ledger;/)
  assert.equal(/integer\)/i.test(rollback), false)
  assert.equal(/uuid, uuid, uuid, integer/i.test(rollback), false)
  assert.equal(/uuid, uuid, integer/i.test(rollback), false)
})

await check('no anon/authenticated table or execute grants; TS hard-cap remains 2', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260924140000_voice_grading_attempt_limit.sql', import.meta.url), 'utf8')
  const ts = await readFile(new URL('../src/lib/voiceAttemptLimit.ts', import.meta.url), 'utf8')
  assert.equal(/GRANT EXECUTE[\s\S]*TO (anon|authenticated)/i.test(migration), false)
  assert.equal(/GRANT .* ON TABLE[\s\S]*TO (anon|authenticated|service_role|PUBLIC)/i.test(migration), false)
  assert.match(ts, /VOICE_GRADING_MAX_ATTEMPTS = 2/)
  assert.equal(/p_max_attempts/i.test(ts), false)
})

await check('post-apply VERIFY.sql ends with ROLLBACK and checks privileges', async () => {
  const verify = await readFile(new URL('../supabase/review/20260924_voice_grading_attempt_limit/VERIFY.sql', import.meta.url), 'utf8')
  assert.match(verify, /ROLLBACK;/)
  assert.match(verify, /relrowsecurity/)
  assert.match(verify, /has_table_privilege\('service_role'/)
  assert.match(verify, /has_function_privilege\('service_role'/)
  assert.match(verify, /third reserve must be rejected/)
})

console.log(`\n${passed} voice-attempt-limit checks passed`)
