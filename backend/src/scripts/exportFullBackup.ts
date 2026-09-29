import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { firestore, isFirebaseConfigured, getFirebaseStatus } from '../firebase';

interface BackupManifest {
  timestamp: string;
  projectId: string;
  connectionMode: string;
  totalCollections: number;
  totalDocuments: number;
  collections: {
    name: string;
    documentCount: number;
    filePath: string;
    sha256: string;
  }[];
}

async function exportFullBackup() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('         ATTENDOSCHOOL — FULL FIREBASE DATA BACKUP               ');
  console.log('═════════════════════════════════════════════════════════════════\n');

  if (!isFirebaseConfigured()) {
    console.error('❌ Firebase is not configured. Aborting backup.');
    process.exit(1);
  }

  const status = getFirebaseStatus();
  console.log(`📌 Project ID:        ${status.projectId}`);
  console.log(`📌 Connection Mode:   ${status.mode}`);
  console.log(`📌 Credential Source: ${status.credentialSource}\n`);

  // Target backup folder with date-time stamp
  const now = new Date();
  const timestampStr = now.toISOString().replace(/[:.]/g, '-');
  const backupRootDir = path.resolve(process.cwd(), '..', 'backups', `firebase_backup_${timestampStr}`);

  if (!fs.existsSync(backupRootDir)) {
    fs.mkdirSync(backupRootDir, { recursive: true });
  }

  console.log(`📁 Backup directory: ${backupRootDir}\n`);

  // Known collections list
  const knownCollections = [
    'schools',
    'users',
    'students',
    'teachers',
    'classes',
    'sections',
    'subjects',
    'attendance_sessions',
    'attendance_records',
    'attendanceSessions',
    'attendanceRecords',
    'subscription_plans',
    'school_subscriptions',
    'payments',
    'invoices',
    'timetables',
    'timetable_periods',
    'timetable_entries',
    'teacher_assignments',
    'notifications',
    'announcements',
    'announcement_replies',
    'announcementReplies',
    'academic_years',
    'academicYears',
    'attendance_correction_requests',
    'attendanceCorrectionRequests',
    'audit_logs',
    'parent_profiles',
    'parent_student_links',
    'student_assignments',
    'student_assignment_submissions',
    'student_exams',
    'student_exam_results',
    'student_leave_requests'
  ];

  // Try to list all collections dynamically via Firestore Admin API
  const collectionNamesSet = new Set<string>(knownCollections);
  try {
    const dynamicCollections = await firestore.listCollections();
    for (const col of dynamicCollections) {
      collectionNamesSet.add(col.id);
    }
  } catch (err: any) {
    console.warn(`⚠️ Note: firestore.listCollections() not supported or restricted: ${err.message}. Using registered collection catalog.`);
  }

  const allCollectionNames = Array.from(collectionNamesSet);
  console.log(`🔍 Inspecting ${allCollectionNames.length} potential collections...\n`);

  const manifest: BackupManifest = {
    timestamp: now.toISOString(),
    projectId: status.projectId,
    connectionMode: status.mode,
    totalCollections: 0,
    totalDocuments: 0,
    collections: []
  };

  const consolidatedData: Record<string, any[]> = {};

  for (const colName of allCollectionNames) {
    try {
      const snap = await firestore.collection(colName).get();
      if (snap.empty) {
        continue;
      }

      console.log(`📦 Collection [${colName}]: Found ${snap.size} documents`);

      const docsData: any[] = [];
      snap.forEach(doc => {
        docsData.push({
          _id: doc.id,
          ...doc.data()
        });
      });

      const colFileName = `${colName}.json`;
      const colFilePath = path.join(backupRootDir, colFileName);
      const jsonContent = JSON.stringify(docsData, null, 2);

      fs.writeFileSync(colFilePath, jsonContent, 'utf-8');

      const hash = crypto.createHash('sha256').update(jsonContent).digest('hex');

      manifest.collections.push({
        name: colName,
        documentCount: docsData.length,
        filePath: colFileName,
        sha256: hash
      });

      manifest.totalDocuments += docsData.length;
      manifest.totalCollections++;

      consolidatedData[colName] = docsData;
    } catch (colErr: any) {
      console.warn(`⚠️ Error reading collection [${colName}]: ${colErr.message}`);
    }
  }

  // Write single consolidated master backup file
  const consolidatedFilePath = path.join(backupRootDir, 'master_consolidated_backup.json');
  fs.writeFileSync(consolidatedFilePath, JSON.stringify(consolidatedData, null, 2), 'utf-8');

  // Write manifest file
  const manifestFilePath = path.join(backupRootDir, 'manifest.json');
  fs.writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log('🎉 BACKUP COMPLETED SUCCESSFULLY!');
  console.log(`   - Total Active Collections: ${manifest.totalCollections}`);
  console.log(`   - Total Documents Saved:    ${manifest.totalDocuments}`);
  console.log(`   - Backup Location:          ${backupRootDir}`);
  console.log(`   - Master JSON:              ${consolidatedFilePath}`);
  console.log(`   - Integrity Manifest:       ${manifestFilePath}`);
  console.log('═════════════════════════════════════════════════════════════════\n');
}

exportFullBackup().catch(err => {
  console.error('❌ Fatal error during backup execution:', err);
  process.exit(1);
});
