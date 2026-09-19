
/*
 Integration smoke runner. Set BASE_URL and a valid token.
 This tests public health and readiness endpoints.
*/
const base = process.env.BASE_URL || 'http://localhost:5000';
async function check(path: string) {
  const r = await fetch(`${base}${path}`);
  console.log(path, r.status);
  if (!r.ok) throw new Error(`${path} failed`);
}
(async () => {
  await check('/api/production/health');
  await check('/api/production/ready');
  console.log('Production integration smoke checks passed.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
