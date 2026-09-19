const base = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const paths = [
  '/api/production/health',
  '/api/production/ready',
  '/api/final-integration/db-check',
  '/api/final-integration/migration-smoke',
  '/api/final-integration/integrity'
];
(async () => {
  let failed = 0;
  for (const path of paths) {
    try {
      const r = await fetch(base + path);
      console.log(`${r.ok ? 'PASS' : 'FAIL'} ${path} ${r.status}`);
      if (!r.ok) failed++;
    } catch (e) {
      console.log('FAIL', path);
      failed++;
    }
  }
  if (failed) process.exitCode = 1;
  else console.log('API smoke checks passed.');
})();
