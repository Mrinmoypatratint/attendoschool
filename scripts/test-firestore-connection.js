const { initializeApp, cert } = require('../backend/node_modules/firebase-admin');
const { getFirestore } = require('../backend/node_modules/firebase-admin/firestore');
const path = require('path');

const serviceAccount = require('../backend/serviceAccountKey.json');

try {
  const app = initializeApp({
    credential: cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized successfully for project:', serviceAccount.project_id);

  const db = getFirestore(app);
  
  async function test() {
    try {
      console.log('Listing existing collections in Firestore...');
      const collections = await db.listCollections();
      console.log('Existing collections:', collections.map(c => c.id));

      console.log('\nTesting write permission with a ping document in _system_health...');
      await db.collection('_system_health').doc('connection_test').set({
        status: 'CONNECTED',
        timestamp: new Date().toISOString(),
        testedBy: 'AttendoSchool Migration Script'
      });
      console.log('✅ Write test PASSED!');

      const doc = await db.collection('_system_health').doc('connection_test').get();
      console.log('✅ Read test PASSED! Document data:', doc.data());

      console.log('\n🎉 CLOUD FIRESTORE IS 100% OPERATIONAL ON ATTENDOSCHOOL-2D0FB!');
      process.exit(0);
    } catch (err) {
      console.error('❌ Firestore Test Error:', err);
      process.exit(1);
    }
  }

  test();
} catch (initErr) {
  console.error('❌ Firebase Admin Initialization Error:', initErr);
  process.exit(1);
}
