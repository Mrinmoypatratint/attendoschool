import assert from 'assert';
import {
  calculateSyncStatus,
  compareBranches,
  formatSyncMarkdownRow,
  SyncStatusType
} from '../../scripts/branch-sync-logic';

function runRegressionTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   ATTENDOSCHOOL — BRANCH SYNC ANALYSIS REGRESSION TESTS       ');
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

  // -------------------------------------------------------------------------
  // Test 1: Both counts zero -> Up-to-date
  // -------------------------------------------------------------------------
  console.log('--- Scenario 1: Both counts zero ---');
  test('Returns Up-to-date when ahead = 0 and behind = 0', () => {
    const status = calculateSyncStatus(0, 0);
    assert.strictEqual(status, 'Up-to-date');

    const row = formatSyncMarkdownRow({
      branch: 'origin/synced',
      target: 'origin/main',
      ahead: 0,
      behind: 0,
      status,
      conflicts: '—'
    });
    assert.ok(row.includes('✅ Up-to-date'));
    assert.ok(row.includes('| 0 | 0 |'));
  });

  // -------------------------------------------------------------------------
  // Test 2: Ahead only -> Ahead
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Ahead only ---');
  test('Returns Ahead when ahead > 0 and behind = 0', () => {
    assert.strictEqual(calculateSyncStatus(1, 0), 'Ahead');
    assert.strictEqual(calculateSyncStatus(15, 0), 'Ahead');
    assert.strictEqual(calculateSyncStatus(97, 0), 'Ahead');

    const status = calculateSyncStatus(5, 0);
    const row = formatSyncMarkdownRow({
      branch: 'origin/feature',
      target: 'origin/main',
      ahead: 5,
      behind: 0,
      status,
      conflicts: '✅ None'
    });
    assert.ok(row.includes('🚀 Ahead'));
    assert.ok(!row.includes('Up-to-date'));
  });

  // -------------------------------------------------------------------------
  // Test 3: Behind only -> Behind (Never Up-to-date!)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Behind only (Regression for bug report) ---');
  test('Returns Behind when ahead = 0 and behind > 0 (NEVER Up-to-date)', () => {
    // Specifically test the exact numbers from the bug report:
    // arnab: 0 ahead, 109 behind
    assert.strictEqual(calculateSyncStatus(0, 109), 'Behind');
    assert.notStrictEqual(calculateSyncStatus(0, 109), 'Up-to-date');

    // feature/ui-reskin: 0 ahead, 17 behind
    assert.strictEqual(calculateSyncStatus(0, 17), 'Behind');
    assert.notStrictEqual(calculateSyncStatus(0, 17), 'Up-to-date');

    // sweta-mondal: 0 ahead, 2 behind
    assert.strictEqual(calculateSyncStatus(0, 2), 'Behind');
    assert.notStrictEqual(calculateSyncStatus(0, 2), 'Up-to-date');

    // latest arnab: 0 ahead, 113 behind
    assert.strictEqual(calculateSyncStatus(0, 113), 'Behind');
    assert.notStrictEqual(calculateSyncStatus(0, 113), 'Up-to-date');

    const row = formatSyncMarkdownRow({
      branch: 'origin/arnab',
      target: 'origin/main',
      ahead: 0,
      behind: 109,
      status: calculateSyncStatus(0, 109),
      conflicts: '—'
    });
    assert.ok(row.includes('📥 Behind'), 'Row must contain Behind status badge');
    assert.ok(!row.includes('Up-to-date'), 'Row must NEVER contain Up-to-date when behind > 0');
  });

  // -------------------------------------------------------------------------
  // Test 4: Both ahead and behind -> Diverged
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Both ahead and behind (Diverged) ---');
  test('Returns Diverged when ahead > 0 and behind > 0', () => {
    assert.strictEqual(calculateSyncStatus(1, 1), 'Diverged');
    assert.strictEqual(calculateSyncStatus(5, 12), 'Diverged');
    assert.strictEqual(calculateSyncStatus(97, 16), 'Diverged');

    const status = calculateSyncStatus(3, 4);
    const row = formatSyncMarkdownRow({
      branch: 'origin/topic',
      target: 'origin/main',
      ahead: 3,
      behind: 4,
      status,
      conflicts: '⚠️ Conflicts'
    });
    assert.ok(row.includes('🔀 Diverged'));
    assert.ok(!row.includes('Up-to-date'));
  });

  // -------------------------------------------------------------------------
  // Test 5: Missing upstream branch
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Missing upstream branch ---');
  test('Reports error and Unknown / Error when branch reference is missing', () => {
    // Mock execFn that throws when verifying non-existent branch
    const mockExec = (cmd: string): string => {
      if (cmd.includes('git rev-parse --verify "origin/missing-branch"')) {
        throw new Error('fatal: Needed a single revision');
      }
      if (cmd.includes('git rev-parse --verify "origin/main"')) {
        return 'main_hash_123';
      }
      return '';
    };

    const result = compareBranches('origin/missing-branch', 'origin/main', mockExec);
    assert.strictEqual(result.status, 'Unknown / Error');
    assert.strictEqual(result.ahead, null);
    assert.strictEqual(result.behind, null);
    assert.ok(result.error?.includes('missing-branch'));
    assert.strictEqual(result.conflicts, '❓');
  });

  test('Reports error and Unknown / Error when target reference is missing', () => {
    const mockExec = (cmd: string): string => {
      if (cmd.includes('git rev-parse --verify "origin/nonexistent-target"')) {
        throw new Error('fatal: Needed a single revision');
      }
      return '';
    };

    const result = compareBranches('origin/arnab', 'origin/nonexistent-target', mockExec);
    assert.strictEqual(result.status, 'Unknown / Error');
    assert.ok(result.error?.includes('nonexistent-target'));
  });

  // -------------------------------------------------------------------------
  // Test 6: Fetch failure
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 6: Fetch failure handling ---');
  test('Handles fetch failure by refusing to report stale/invalid data as Up-to-date', () => {
    // When fetch fails, comparison shouldn't produce a false 'Up-to-date'
    const statusWithFetchError = calculateSyncStatus(null, null, 'Fetch failed');
    assert.strictEqual(statusWithFetchError, 'Unknown / Error');
    assert.notStrictEqual(statusWithFetchError, 'Up-to-date');

    const statusWithException = calculateSyncStatus(undefined, undefined, true);
    assert.strictEqual(statusWithException, 'Unknown / Error');
  });

  // -------------------------------------------------------------------------
  // Test 7: Comparison failure (git rev-list failure or malformed output)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 7: Comparison failure ---');
  test('Handles rev-list error or malformed count output', () => {
    // 7a. rev-list command throws an error
    const mockFailingExec = (cmd: string): string => {
      if (cmd.includes('rev-parse')) return 'hash';
      if (cmd.includes('rev-list')) throw new Error('fatal: ambiguous argument');
      return '';
    };

    const resFail = compareBranches('origin/corrupted', 'origin/main', mockFailingExec);
    assert.strictEqual(resFail.status, 'Unknown / Error');
    assert.strictEqual(resFail.ahead, null);
    assert.strictEqual(resFail.behind, null);
    assert.ok(resFail.error?.includes('ambiguous argument'));

    // 7b. rev-list returns garbage
    const mockGarbageExec = (cmd: string): string => {
      if (cmd.includes('rev-parse')) return 'hash';
      if (cmd.includes('rev-list')) return 'not_numbers';
      return '';
    };

    const resGarbage = compareBranches('origin/garbage', 'origin/main', mockGarbageExec);
    assert.strictEqual(resGarbage.status, 'Unknown / Error');

    // 7c. Direct helper test with NaN / negative numbers
    assert.strictEqual(calculateSyncStatus(NaN, 0), 'Unknown / Error');
    assert.strictEqual(calculateSyncStatus(0, NaN), 'Unknown / Error');
    assert.strictEqual(calculateSyncStatus(-1, 0), 'Unknown / Error');
    assert.strictEqual(calculateSyncStatus(0, -5), 'Unknown / Error');
  });

  console.log(`\n===============================================================`);
  console.log(` RESULTS: ${passedTests}/${totalTests} regression tests passed successfully!`);
  console.log(`===============================================================\n`);
}

runRegressionTests();
