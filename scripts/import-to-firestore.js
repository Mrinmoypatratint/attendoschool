const fs = require('fs');
const path = require('path');
const { Firestore } = require('../backend/node_modules/@google-cloud/firestore');

const saPath = path.join(__dirname, '../backend/serviceAccountKey.json');
if (!fs.existsSync(saPath)) {
  console.error('Service account key not found at:', saPath);
  process.exit(1);
}

const serviceAccount = require(saPath);
console.log('Using Service Account for Project:', serviceAccount.project_id);

const db = new Firestore({
  projectId: serviceAccount.project_id,
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key
  }
});

const exportDir = path.join(__dirname, '../supabase-export');

async function importCollection(fileName, collectionName) {
  const filePath = path.join(exportDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${collectionName} (file not found)`);
    return 0;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const items = JSON.parse(raw);
  if (!Array.isArray(items) || items.length === 0) {
    console.log(`Skipping ${collectionName} (empty)`);
    return 0;
  }

  console.log(`\nImporting ${items.length} records into Firestore collection '${collectionName}'...`);
  
  const BATCH_SIZE = 400; // Safe limit below Firestore's 500 max
  let importedCount = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const item of chunk) {
      // Clean dates and null/undefined values for Firestore
      const docData = {};
      for (const [key, val] of Object.entries(item)) {
        if (val !== undefined) {
          docData[key] = val;
        }
      }

      const docId = String(item.id || item.uuid || `${collectionName}_${importedCount + 1}`);
      const docRef = db.collection(collectionName).doc(docId);
      batch.set(docRef, docData, { merge: true });
    }

    await batch.commit();
    importedCount += chunk.length;
    process.stdout.write(`  Progress: ${importedCount}/${items.length} written...\r`);
  }

  console.log(`  ✅ Successfully imported ${importedCount} records into '${collectionName}'.`);
  return importedCount;
}

async function main() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('      ATTENDOSCHOOL — SUPABASE TO CLOUD FIRESTORE IMPORTER       ');
  console.log('═════════════════════════════════════════════════════════════════\n');

  try {
    const startTime = Date.now();
    let totalImported = 0;

    // Core Institutional Structure
    totalImported += await importCollection('schools.json', 'schools');
    totalImported += await importCollection('classes.json', 'classes');
    totalImported += await importCollection('sections.json', 'sections');
    totalImported += await importCollection('subjects.json', 'subjects');
    totalImported += await importCollection('academic_years.json', 'academic_years');

    // Users and Faculty
    totalImported += await importCollection('users.json', 'users');
    totalImported += await importCollection('teacher_profiles.json', 'teachers');

    // All Students (1,743 records)
    totalImported += await importCollection('students.json', 'students');

    // Operations & Subscriptions
    totalImported += await importCollection('school_subscriptions.json', 'school_subscriptions');
    totalImported += await importCollection('school_holidays.json', 'school_holidays');
    totalImported += await importCollection('school_working_days.json', 'school_working_days');
    totalImported += await importCollection('timetable_entries.json', 'timetable_entries');
    totalImported += await importCollection('timetable_periods.json', 'timetable_periods');
    totalImported += await importCollection('announcements.json', 'announcements');
    totalImported += await importCollection('payments.json', 'payments');
    totalImported += await importCollection('platform_settings.json', 'platform_settings');

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n═════════════════════════════════════════════════════════════════');
    console.log(`🎉 IMPORT COMPLETE: ${totalImported} total documents migrated to Cloud Firestore!`);
    console.log(`⏱ Total time: ${duration} seconds`);
    console.log('═════════════════════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('Fatal import error:', err);
    process.exit(1);
  }
}

main();
