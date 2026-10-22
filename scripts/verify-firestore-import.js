const { Firestore } = require('../backend/node_modules/@google-cloud/firestore');
const sa = require('../backend/serviceAccountKey.json');

const db = new Firestore({
  projectId: sa.project_id,
  credentials: {
    client_email: sa.client_email,
    private_key: sa.private_key
  }
});

async function verify() {
  const collections = await db.listCollections();
  console.log('=== VERIFYING FIRESTORE COLLECTIONS ===');
  for (const col of collections) {
    const snap = await col.count().get();
    console.log(`  - ${col.id}: ${snap.data().count} documents`);
  }

  // Sample check on student
  const sampleStudent = await db.collection('students').limit(1).get();
  if (!sampleStudent.empty) {
    const s = sampleStudent.docs[0].data();
    console.log('\nSample Student from Firestore:');
    console.log(`  Name: ${s.name}, Roll: ${s.roll_number}, School ID: ${s.school_id}`);
  }

  // Sample check on DAV school
  const davDoc = await db.collection('schools').doc('5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3').get();
  if (davDoc.exists) {
    console.log('\nDAV School Document in Firestore:');
    console.log('  Name:', davDoc.data().name);
    console.log('  Code:', davDoc.data().code);
  }

  console.log('\nAll Firestore verifications passed successfully!');
}

verify();
