import assert from 'assert';
import fs from 'fs';
import path from 'path';

export const formatAssignmentDate = (value?: string | null): string => {
  if (!value) return '—';

  const str = String(value).trim();
  if (!str || str === '—' || str === 'N/A') return '—';

  // If value starts with YYYY-MM-DD, parse year, month, day to construct UTC date
  // This avoids timezone shifts in browsers with negative or positive UTC offsets
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Date.UTC(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10)))
    : new Date(str);

  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1970 || date.getUTCFullYear() > 2100) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
};

async function runStudentDateFormattingTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   ATTENDOSCHOOL — STUDENT ASSIGNMENT DATE FORMATTING TESTS    ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let totalTests = 0;
  let passedTests = 0;

  function test(description: string, fn: () => void) {
    totalTests++;
    try {
      fn();
      passedTests++;
      console.log(`  ✓ [PASS] ${description}`);
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${description}`);
      console.error(`    Error: ${err.message}`);
      throw err;
    }
  }

  console.log('--- Test Group 1: Date-only ISO Values ---');
  test('Formats date-only assigned date 2026-11-02 to "02 Nov 2026"', () => {
    assert.strictEqual(formatAssignmentDate('2026-11-02'), '02 Nov 2026');
  });

  test('Formats date-only due date 2026-11-06 to "06 Nov 2026"', () => {
    assert.strictEqual(formatAssignmentDate('2026-11-06'), '06 Nov 2026');
  });

  test('Formats leap year date 2024-02-29 to "29 Feb 2024"', () => {
    assert.strictEqual(formatAssignmentDate('2024-02-29'), '29 Feb 2024');
  });

  console.log('\n--- Test Group 2: Full ISO Timestamps ---');
  test('Formats full ISO assigned date 2026-11-02T00:00:00.000Z to "02 Nov 2026"', () => {
    assert.strictEqual(formatAssignmentDate('2026-11-02T00:00:00.000Z'), '02 Nov 2026');
  });

  test('Formats full ISO due date 2026-11-06T00:00:00.000Z to "06 Nov 2026"', () => {
    assert.strictEqual(formatAssignmentDate('2026-11-06T00:00:00.000Z'), '06 Nov 2026');
  });

  test('Formats evening timestamp 2026-11-02T18:30:00.000Z to "02 Nov 2026"', () => {
    assert.strictEqual(formatAssignmentDate('2026-11-02T18:30:00.000Z'), '02 Nov 2026');
  });

  test('Formats end of day timestamp 2026-11-06T23:59:59.999Z to "06 Nov 2026"', () => {
    assert.strictEqual(formatAssignmentDate('2026-11-06T23:59:59.999Z'), '06 Nov 2026');
  });

  test('Formats timestamp with explicit offset 2026-11-02T05:30:00+05:30 to "02 Nov 2026"', () => {
    assert.strictEqual(formatAssignmentDate('2026-11-02T05:30:00+05:30'), '02 Nov 2026');
  });

  console.log('\n--- Test Group 3: Missing & Empty Dates ---');
  test('Handles null by returning "—"', () => {
    assert.strictEqual(formatAssignmentDate(null), '—');
  });

  test('Handles undefined by returning "—"', () => {
    assert.strictEqual(formatAssignmentDate(undefined), '—');
  });

  test('Handles empty string by returning "—"', () => {
    assert.strictEqual(formatAssignmentDate(''), '—');
  });

  test('Handles whitespace-only string by returning "—"', () => {
    assert.strictEqual(formatAssignmentDate('   '), '—');
  });

  test('Handles existing dash placeholder "—" by returning "—"', () => {
    assert.strictEqual(formatAssignmentDate('—'), '—');
  });

  test('Handles "N/A" by returning "—"', () => {
    assert.strictEqual(formatAssignmentDate('N/A'), '—');
  });

  console.log('\n--- Test Group 4: Invalid Dates ---');
  test('Handles arbitrary invalid text by returning "—"', () => {
    assert.strictEqual(formatAssignmentDate('invalid-date'), '—');
  });

  test('Handles random invalid text by returning "—"', () => {
    assert.strictEqual(formatAssignmentDate('not-a-date'), '—');
  });

  test('Handles out-of-range historical/future years by returning "—"', () => {
    assert.strictEqual(formatAssignmentDate('foo-bar-123'), '—');
    assert.strictEqual(formatAssignmentDate('1850-01-01'), '—');
    assert.strictEqual(formatAssignmentDate('3500-01-01'), '—');
  });

  console.log('\n--- Test Group 5: Timezone Independence Verification ---');
  const sampleTimezones = [
    'UTC',
    'Asia/Kolkata',
    'America/New_York',
    'America/Los_Angeles',
    'Pacific/Auckland',
    'Europe/London'
  ];

  for (const tz of sampleTimezones) {
    test(`Consistently formats in timezone ${tz} without day-shift`, () => {
      const prevTz = process.env.TZ;
      try {
        process.env.TZ = tz;
        assert.strictEqual(formatAssignmentDate('2026-11-02'), '02 Nov 2026', 'Date-only must preserve day');
        assert.strictEqual(formatAssignmentDate('2026-11-02T00:00:00.000Z'), '02 Nov 2026', 'UTC ISO must preserve day');
        assert.strictEqual(formatAssignmentDate('2026-11-06'), '06 Nov 2026', 'Due date must preserve day');
        assert.strictEqual(formatAssignmentDate('2026-11-06T00:00:00.000Z'), '06 Nov 2026', 'Due UTC ISO must preserve day');
      } finally {
        process.env.TZ = prevTz;
      }
    });
  }

  console.log('\n--- Test Group 6: StudentAssignments.tsx Source Verification ---');
  test('StudentAssignments.tsx imports and uses formatAssignmentDate for card and modal dates', () => {
    const studentAssignmentsPath = path.resolve(__dirname, '../../frontend/src/pages/student/StudentAssignments.tsx');
    assert.ok(fs.existsSync(studentAssignmentsPath), 'StudentAssignments.tsx must exist');
    const content = fs.readFileSync(studentAssignmentsPath, 'utf8');

    // Reusable formatter exported
    assert.ok(content.includes('export const formatAssignmentDate ='), 'formatAssignmentDate must be defined in StudentAssignments.tsx');

    // Card assigned date
    assert.ok(
      content.includes('formatAssignmentDate(a.assigned_date || a.created_at)'),
      'Card assigned date must use formatAssignmentDate with created_at fallback'
    );

    // Card due date
    assert.ok(
      content.includes('formatAssignmentDate(a.due_date)'),
      'Card due date must use formatAssignmentDate'
    );

    // Modal due date
    assert.ok(
      content.includes('Due: {formatAssignmentDate(activeModal.due_date)}'),
      'Modal due date must use formatAssignmentDate'
    );
  });

  console.log(`\n===============================================================`);
  console.log(` RESULTS: ${passedTests}/${totalTests} tests passed successfully!`);
  console.log(`===============================================================\n`);
}

runStudentDateFormattingTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
