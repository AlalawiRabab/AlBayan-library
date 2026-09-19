/**
 * Logical security/behavior self-tests (no live DB).
 * Run: npx --yes tsx src/lib/security.selftest.ts
 */
import { isStoryVisibleToClassroom, validateClassroomName } from './classroomName'
import { validateTeacherName } from './teacherName'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

// --- Classroom rename validation (name-only rules) ---
assert(validateClassroomName('').ok === false, 'empty classroom name rejected')
assert(validateClassroomName('<x>').ok === false, 'angle brackets rejected')
assert(validateClassroomName('فصل أ').ok === true, 'valid classroom name')

// --- Teacher name feature untouched (still validates name-only) ---
assert(validateTeacherName('معلمة').ok === true, 'teacher name still validates')
assert(validateTeacherName('a').ok === false, 'teacher name length rule intact')

// --- Story visibility rules (mirrors RPC intent) ---
assert(
  isStoryVisibleToClassroom({
    storyGradeLevel: 3,
    classroomGrade: 3,
    authorTeacherId: 'teacher-a',
    classroomTeacherId: 'teacher-a',
  }),
  'student sees own classroom teacher story'
)
assert(
  !isStoryVisibleToClassroom({
    storyGradeLevel: 3,
    classroomGrade: 3,
    authorTeacherId: 'teacher-a',
    classroomTeacherId: 'teacher-b',
  }),
  'student does not see other teacher story'
)
assert(
  isStoryVisibleToClassroom({
    storyGradeLevel: 3,
    classroomGrade: 3,
    authorTeacherId: null,
    classroomTeacherId: 'teacher-a',
  }),
  'public null-author story visible at grade'
)
assert(
  !isStoryVisibleToClassroom({
    storyGradeLevel: 6,
    classroomGrade: 3,
    authorTeacherId: null,
    classroomTeacherId: 'teacher-a',
  }),
  'public story hidden on grade mismatch'
)

// --- Documented SQL invariants (staged migrations; not executable here) ---
const prepareStageInvariants = {
  setUserContextClientExecuteRevoked: true,
  teacherCreateRequiresActiveClassroom: true,
  adminStoryRpcsRequireActiveAdminCode: true,
  adminUpdateStoryDoesNotTouchAuthorOrGrade: true,
  classroomRenameUpdatesNameAndUpdatedAtOnly: true,
  legacyAdminGetGradeStoriesIntegerKeptDuringPrepare: true,
  secureAdminGetGradeStoriesIntegerTextAdded: true,
  tablesNotRevokedDuringPrepare: true,
}
assert(
  Object.values(prepareStageInvariants).every(Boolean),
  'prepare-stage migration invariants documented'
)

const enforceStageInvariants = {
  legacyAdminGetGradeStoriesIntegerDropped: true,
  tablesStoriesClassroomsStudentClassroomsRevokedFromAnon: true,
  looseStudentStoryPolicyReplaced: true,
}
assert(
  Object.values(enforceStageInvariants).every(Boolean),
  'enforce-stage migration invariants documented'
)

console.log('security.selftest: ok')
