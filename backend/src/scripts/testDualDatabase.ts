import 'dotenv/config';
import { getFirebaseStatus, checkFirestoreHealth } from '../firebase';
import { checkPostgresHealth, isPostgresConfigured } from '../db';
import { env } from '../config/env';

async function testDualDatabase() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('    ATTENDOSCHOOL — HYBRID DUAL-DATABASE HEALTH DIAGNOSTICS      ');
  console.log('═════════════════════════════════════════════════════════════════\n');

  // 1. Primary Store: Firebase Cloud Firestore
  console.log('1. PRIMARY DATABASE: Firebase Cloud Firestore');
  const fbStatus = getFirebaseStatus();
  console.log(`   - Configured:       ${fbStatus.configured ? '✅ YES' : '❌ NO'}`);
  console.log(`   - Project ID:       ${fbStatus.projectId}`);
  console.log(`   - Mode:             ${fbStatus.mode}`);

  const fbHealth = await checkFirestoreHealth();
  if (fbHealth.ok) {
    console.log(`   - Connection:       ✅ ONLINE (${fbHealth.message})`);
  } else {
    console.log(`   - Connection:       ⚠️ THROTTLED / OFFLINE (${fbHealth.message})`);
  }

  // 2. Secondary Store: Supabase (PostgreSQL)
  console.log('\n2. SECONDARY DATABASE: Supabase (PostgreSQL)');
  console.log(`   - Configured:       ${isPostgresConfigured ? '✅ YES' : '⚪ PENDING (Add SUPABASE_DATABASE_URL to .env)'}`);
  console.log(`   - Dual-DB Sync:     ${env.enableDualDbSync ? '✅ ENABLED' : '❌ DISABLED'}`);

  if (isPostgresConfigured) {
    const pgHealth = await checkPostgresHealth();
    if (pgHealth.ok) {
      console.log(`   - Connection:       ✅ ONLINE (${pgHealth.message})`);
      console.log('   - Failover Engine:  🛡️ ACTIVE — If Firebase hits quota limits, queries serve from Supabase!');
    } else {
      console.log(`   - Connection:       ❌ FAILED (${pgHealth.message})`);
    }
  } else {
    console.log('   - Next Step:        Create a free project at https://supabase.com');
    console.log('                       and paste SUPABASE_DATABASE_URL into backend/.env');
  }

  console.log('\n═════════════════════════════════════════════════════════════════\n');
}

testDualDatabase().catch(err => {
  console.error('Fatal error during dual-database test:', err);
});
