import 'dotenv/config';
import { checkFirestoreHealth, getFirebaseStatus, firestore } from '../firebase';

async function verify() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('       ATTENDOSCHOOL — FIREBASE CONNECTION DIAGNOSTICS          ');
  console.log('═════════════════════════════════════════════════════════════════\n');

  const status = getFirebaseStatus();
  console.log('1. Configuration Overview:');
  console.log('   - Configured:        ', status.configured ? '✅ YES' : '❌ NO');
  console.log('   - Connection Mode:   ', status.mode === 'live_cloud' ? '🌐 LIVE GOOGLE CLOUD FIRESTORE' : status.mode === 'emulator' ? '💻 LOCAL FIRESTORE EMULATOR' : '⚠️ UNCONFIGURED DEV');
  console.log('   - Project ID:        ', status.projectId);
  console.log('   - Credential Source: ', status.credentialSource);
  console.log('   - .env Credentials:  ', (status as any).envCredentialsDetected ? '✅ Loaded directly from .env (No external file needed)' : '⚪ Not in .env');
  console.log('   - External Key File: ', (status as any).fileKeyDetected ? '📁 Present on disk' : '⚪ Not present (pure .env mode)');
  console.log('\n2. Live Read/Write Connectivity Test:');

  const startTime = Date.now();
  const health = await checkFirestoreHealth();
  const latency = Date.now() - startTime;

  if (health.ok) {
    console.log(`   ✅ Status: CONNECTED (${latency}ms)`);
    console.log(`   - Message: ${health.message}`);

    // Try a ping write to confirm write permissions
    try {
      await firestore.collection('_system_health').doc('connection_test').set({
        lastTested: new Date().toISOString(),
        testBy: 'verifyFirebaseConnection script',
        status: 'SUCCESS'
      });
      console.log('   ✅ Write Test: Read & Write permissions verified successfully.');
    } catch (writeErr: any) {
      console.log(`   ⚠️ Write Test Warning: Read succeeded but write failed: ${writeErr.message}`);
    }
  } else {
    console.log(`   ❌ Status: FAILED`);
    console.log(`   - Error: ${health.message}`);
  }

  console.log('\n═════════════════════════════════════════════════════════════════');
  if (status.mode === 'live_cloud') {
    console.log('🎉 Your backend is connected to LIVE Google Cloud Firebase Firestore!');
    console.log('   Collections: schools, users, students, classes, attendance...');
  } else {
    console.log('📌 HOW TO CONNECT YOUR REAL GOOGLE CLOUD FIREBASE PROJECT:');
    console.log('   ------------------------------------------------------------');
    console.log('   Method A (Easiest — Service Account JSON):');
    console.log('     1. Open Firebase Console: https://console.firebase.google.com');
    console.log('     2. Go to Project Settings ⚙️ > Service Accounts');
    console.log('     3. Click "Generate new private key"');
    console.log('     4. Save the downloaded file as "serviceAccountKey.json" inside:');
    console.log('        d:\\Project_Abir\\attendoschool\\backend\\serviceAccountKey.json');
    console.log('     5. Comment out FIRESTORE_EMULATOR_HOST in backend/.env');
    console.log('\n   Method B (Environment Variables):');
    console.log('     In backend/.env set:');
    console.log('     FIREBASE_PROJECT_ID=your-project-id');
    console.log('     FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com');
    console.log('     FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
    console.log('     # Comment out FIRESTORE_EMULATOR_HOST=');
  }
  console.log('═════════════════════════════════════════════════════════════════\n');
}

verify().catch((err) => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
