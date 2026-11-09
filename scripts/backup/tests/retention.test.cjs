const { test } = require('node:test');
const assert = require('node:assert/strict');
const { retention } = require(process.env.BACKUP_CORE_UNDER_TEST || '../core.cjs');
test('retention preserves recent, monthly, current and unrelated releases', () => {
  const tags = ['backup-2026-11-08-0200', 'backup-2026-11-01-0200', 'backup-2026-10-01-0200', 'backup-2026-10-15-0200', 'backup-2025-11-01-0200', 'v1.0', 'backup-2026-11-02-0200'];
  assert.deepEqual(retention(tags, tags[6], 14, 12, new Date('2026-11-08T03:00:00Z')), ['backup-2026-10-15-0200', 'backup-2025-11-01-0200']);
});
