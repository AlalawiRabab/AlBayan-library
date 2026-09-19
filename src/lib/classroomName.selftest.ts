/**
 * Lightweight Node test runner checks (no Jest/Vitest in this repo).
 * Run: node --import tsx  ...  OR compile via npx ts-node if available.
 * Prefer: npx --yes tsx src/lib/classroomName.selftest.ts
 */
import { isStoryVisibleToClassroom, validateClassroomName } from './classroomName'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(validateClassroomName('').ok === false, 'empty name rejected')
assert(validateClassroomName('أ').ok === false, 'too short rejected')
assert(validateClassroomName('<b>').ok === false, 'angle brackets rejected')
assert(validateClassroomName('  الصف الثالث أ  ').ok === true, 'valid name accepted')
assert(
  (validateClassroomName('  الصف الثالث أ  ') as { ok: true; name: string }).name === 'الصف الثالث أ',
  'name trimmed'
)

assert(
  isStoryVisibleToClassroom({
    storyGradeLevel: 3,
    classroomGrade: 3,
    authorTeacherId: null,
    classroomTeacherId: 't1',
  }) === true,
  'public story visible'
)

assert(
  isStoryVisibleToClassroom({
    storyGradeLevel: 3,
    classroomGrade: 3,
    authorTeacherId: 't1',
    classroomTeacherId: 't1',
  }) === true,
  'matching author visible'
)

assert(
  isStoryVisibleToClassroom({
    storyGradeLevel: 3,
    classroomGrade: 3,
    authorTeacherId: 't1',
    classroomTeacherId: 't2',
  }) === false,
  'other teacher hidden'
)

assert(
  isStoryVisibleToClassroom({
    storyGradeLevel: 6,
    classroomGrade: 3,
    authorTeacherId: 't1',
    classroomTeacherId: 't1',
  }) === false,
  'grade mismatch hidden'
)

console.log('classroomName.selftest: ok')
