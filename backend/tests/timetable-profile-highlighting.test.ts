import assert from 'assert';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

// Load and transpile the identity helper functions directly from frontend/src/pages/admin/Timetable.tsx
const timetablePath = path.resolve(__dirname, '../../frontend/src/pages/admin/Timetable.tsx');
const content = fs.readFileSync(timetablePath, 'utf8');

const fnMatch = content.match(/export function isPrimaryTeacherForEntry[\s\S]*?export function isTeacherEntry[\s\S]*?\n\}/);
if (!fnMatch) {
  throw new Error('Could not find identity helper functions in Timetable.tsx');
}

const jsCode = ts.transpile(fnMatch[0]);
const timetableModule: {
  isPrimaryTeacherForEntry: (user: any, entry: any) => boolean;
  isAlternateTeacherForEntry: (user: any, entry: any) => boolean;
  isTeacherEntry: (user: any, entry: any) => boolean;
} = {} as any;

const runner = new Function('exports', jsCode);
runner(timetableModule);

const { isPrimaryTeacherForEntry, isAlternateTeacherForEntry, isTeacherEntry } = timetableModule;

console.log('\n========================================================================');
console.log('🧪 VERIFYING PROFILE-BASED TIMETABLE HIGHLIGHTING & IDENTITY LOGIC');
console.log('========================================================================\n');

// Test fixtures
const debashisUser = {
  id: 'teacher-uuid-debashis',
  teacher_id: 'teacher-uuid-debashis',
  name: 'Debashis Das',
  role: 'TEACHER'
};

const arnabUser = {
  id: 'teacher-uuid-arnab',
  teacher_id: 'teacher-uuid-arnab',
  name: 'Arnab Sarkhel',
  role: 'TEACHER'
};

const priyaUser = {
  id: 'teacher-uuid-priya',
  teacher_id: 'teacher-uuid-priya',
  name: 'Priya Sharma',
  role: 'TEACHER'
};

// Period 1: Mathematics - Arnab Sarkhel is Primary, Debashis Das is Alternate
const mathPeriod = {
  id: 'period-math-01',
  subject_name: 'Mathematics',
  teacher_id: 'teacher-uuid-arnab',
  teacher_name: 'Arnab Sarkhel',
  substitute_teacher_id: 'teacher-uuid-debashis',
  substitute_teacher_name: 'Debashis Das'
};

// Period 2: English - Debashis Das is Primary, no alternate
const englishPeriod = {
  id: 'period-eng-02',
  subject_name: 'English',
  teacher_id: 'teacher-uuid-debashis',
  teacher_name: 'Debashis Das',
  substitute_teacher_id: null,
  substitute_teacher_name: null
};

// Scenario 1: Debashis Das as alternate for Mathematics and primary for English
console.log('Test 1: Debashis Das as alternate for Mathematics and primary for English');
// Mathematics period check for Debashis Das:
assert.strictEqual(isPrimaryTeacherForEntry(debashisUser, mathPeriod), false, 'Debashis must NOT be primary for Mathematics');
assert.strictEqual(isAlternateTeacherForEntry(debashisUser, mathPeriod), true, 'Debashis MUST be alternate for Mathematics');
assert.strictEqual(isTeacherEntry(debashisUser, mathPeriod), true, 'Mathematics must be in Debashis schedule');

// English period check for Debashis Das:
assert.strictEqual(isPrimaryTeacherForEntry(debashisUser, englishPeriod), true, 'Debashis MUST be primary for English');
assert.strictEqual(isAlternateTeacherForEntry(debashisUser, englishPeriod), false, 'Debashis must NOT be alternate for English');
assert.strictEqual(isTeacherEntry(debashisUser, englishPeriod), true, 'English must be in Debashis schedule');
console.log('  ✓ PASSED: Debashis correctly identified as alternate for Math and primary for English');

// Scenario 2: Arnab Sarkhel as primary for Mathematics
console.log('\nTest 2: Arnab Sarkhel as primary for Mathematics');
assert.strictEqual(isPrimaryTeacherForEntry(arnabUser, mathPeriod), true, 'Arnab MUST be primary for Mathematics');
assert.strictEqual(isAlternateTeacherForEntry(arnabUser, mathPeriod), false, 'Arnab must NOT be alternate for Mathematics');
assert.strictEqual(isTeacherEntry(arnabUser, mathPeriod), true, 'Mathematics must be in Arnab schedule');
console.log('  ✓ PASSED: Arnab correctly identified as primary for Math and NOT alternate');

// Scenario 3: Teacher who is neither primary nor alternate
console.log('\nTest 3: Teacher who is neither primary nor alternate');
assert.strictEqual(isPrimaryTeacherForEntry(priyaUser, mathPeriod), false, 'Priya must NOT be primary for Mathematics');
assert.strictEqual(isAlternateTeacherForEntry(priyaUser, mathPeriod), false, 'Priya must NOT be alternate for Mathematics');
assert.strictEqual(isTeacherEntry(priyaUser, mathPeriod), false, 'Mathematics must NOT be in Priya schedule');

assert.strictEqual(isPrimaryTeacherForEntry(priyaUser, englishPeriod), false, 'Priya must NOT be primary for English');
assert.strictEqual(isAlternateTeacherForEntry(priyaUser, englishPeriod), false, 'Priya must NOT be alternate for English');
assert.strictEqual(isTeacherEntry(priyaUser, englishPeriod), false, 'English must NOT be in Priya schedule');
console.log('  ✓ PASSED: Priya receives neutral status for both periods');

// Scenario 4: Missing IDs (Fallback to name matching when IDs are unavailable)
console.log('\nTest 4: Missing IDs (Graceful name matching fallback)');
const entryWithoutIds = {
  id: 'period-legacy-01',
  subject_name: 'Science',
  teacher_id: '',
  teacher_name: 'Arnab Sarkhel',
  substitute_teacher_id: null,
  substitute_teacher_name: 'Debashis Das'
};

assert.strictEqual(isPrimaryTeacherForEntry(arnabUser, entryWithoutIds), true, 'Fallback should match Arnab primary by name when ID missing');
assert.strictEqual(isAlternateTeacherForEntry(arnabUser, entryWithoutIds), false, 'Arnab should not match alternate');

assert.strictEqual(isPrimaryTeacherForEntry(debashisUser, entryWithoutIds), false, 'Debashis should not match primary');
assert.strictEqual(isAlternateTeacherForEntry(debashisUser, entryWithoutIds), true, 'Fallback should match Debashis alternate by name when ID missing');

// Missing user ID fallback
const userWithoutId = {
  id: '',
  name: 'Arnab Sarkhel',
  role: 'TEACHER'
};
assert.strictEqual(isPrimaryTeacherForEntry(userWithoutId, mathPeriod), true, 'Fallback should match user without ID by name');
console.log('  ✓ PASSED: Missing IDs properly fall back to name matching');

// Scenario 5: Conflicting IDs and names (ID takes absolute precedence, name NEVER overrides)
console.log('\nTest 5: Conflicting IDs and names (ID must override name match)');
// Entry has teacher_id belonging to someone else, but teacher_name accidentally set to 'Debashis Das'
const conflictingEntry = {
  id: 'period-conflict-01',
  subject_name: 'History',
  teacher_id: 'teacher-uuid-someone-else',
  teacher_name: 'Debashis Das',
  substitute_teacher_id: 'teacher-uuid-another-person',
  substitute_teacher_name: 'Debashis Das'
};

assert.strictEqual(
  isPrimaryTeacherForEntry(debashisUser, conflictingEntry),
  false,
  'Conflicting teacher_id MUST prevent primary match even when names match'
);
assert.strictEqual(
  isAlternateTeacherForEntry(debashisUser, conflictingEntry),
  false,
  'Conflicting substitute_teacher_id MUST prevent alternate match even when names match'
);
assert.strictEqual(
  isTeacherEntry(debashisUser, conflictingEntry),
  false,
  'Conflicting IDs must prevent teacher entry match'
);
console.log('  ✓ PASSED: Conflicting IDs take absolute precedence and reject invalid name matches');

// Scenario 6: Non-teacher role protection (Admins/Students do not receive teacher badges)
console.log('\nTest 6: Non-teacher role protection');
const adminUser = {
  id: 'teacher-uuid-arnab',
  name: 'Arnab Sarkhel',
  role: 'SCHOOL_ADMIN'
};
assert.strictEqual(isPrimaryTeacherForEntry(adminUser, mathPeriod), false, 'School admin must not be primary teacher');
assert.strictEqual(isAlternateTeacherForEntry(adminUser, mathPeriod), false, 'School admin must not be alternate teacher');
assert.strictEqual(isTeacherEntry(adminUser, mathPeriod), false, 'School admin must not be teacher entry');
console.log('  ✓ PASSED: Non-teacher roles are not granted teacher highlight status');

console.log('\n========================================================================');
console.log('🎉 ALL 6 PROFILE-BASED TIMETABLE TEST SUITES PASSED SUCCESSFULLY!');
console.log('========================================================================\n');
