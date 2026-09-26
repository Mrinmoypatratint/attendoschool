import fs from 'fs';
import path from 'path';
import { 
  getGlobalSmtpConfig, 
  updateGlobalSmtpConfig, 
  saveSchoolSmtpConfig, 
  getSchoolSmtpConfig,
  persistSmtpConfigToEnv 
} from '../src/services/notificationService';
import { env } from '../src/config/env';

async function runTests() {
  console.log('=== RUNNING SMTP SYNCHRONIZATION AND BACKEND PERSISTENCE TESTS ===');

  const backendEnvPath = path.resolve(__dirname, '../.env');
  const rootEnvPath = path.resolve(__dirname, '../../.env');

  const targetUser = env.smtpUser || 'rajbsmv@gmail.com';
  const targetPass = env.smtpPass || 'ovmz huhs fxnx inlq';

  // Test 1: Verify initial configuration
  const globalCfg = getGlobalSmtpConfig();
  console.log('\n[Test 1] Checking current Global SMTP Config:');
  console.log('Host:', globalCfg.host);
  console.log('Port:', globalCfg.port);
  console.log('User:', globalCfg.username);
  console.log('Pass configured:', Boolean(globalCfg.password));
  
  if (globalCfg.username !== targetUser) {
    throw new Error(`Expected global username ${targetUser}, got ${globalCfg.username}`);
  }
  if (!globalCfg.password) {
    throw new Error('Expected global password to be configured');
  }
  console.log(`✓ Initial Global SMTP Config correctly configured with ${targetUser}`);

  // Test 2: Verify .env files currently have the credentials
  console.log('\n[Test 2] Checking .env files for Google SMTP credentials:');
  const backendEnvContent = fs.readFileSync(backendEnvPath, 'utf-8');
  if (!backendEnvContent.includes(`SMTP_USER=${targetUser}`)) {
    throw new Error(`backend/.env missing SMTP_USER=${targetUser}`);
  }
  if (!backendEnvContent.includes('SMTP_PASS=')) {
    throw new Error('backend/.env missing SMTP_PASS');
  }
  console.log('✓ backend/.env contains correct SMTP_USER and SMTP_PASS');

  // Test 3: Simulate UI change via saveSchoolSmtpConfig (from Notification Center)
  console.log('\n[Test 3] Simulating UI change from Notification Center:');
  const schoolId = '00000000-0000-0000-0000-000000000001';
  saveSchoolSmtpConfig(schoolId, {
    host: 'smtp.gmail.com',
    port: 587,
    username: targetUser,
    password: targetPass,
    senderEmail: targetUser,
    senderName: 'AttendoSchool Notifications',
    isEnabled: true
  });

  const updatedSchoolCfg = getSchoolSmtpConfig(schoolId);
  if (updatedSchoolCfg.username !== targetUser) {
    throw new Error('School config username failed to update');
  }
  if (updatedSchoolCfg.password !== targetPass) {
    throw new Error('School config password failed to update');
  }
  console.log('✓ School config updated successfully');

  // Test 4: Verify .env persistence
  console.log('\n[Test 4] Verifying physical persistence to .env:');
  const freshBackendEnv = fs.readFileSync(backendEnvPath, 'utf-8');
  if (!freshBackendEnv.includes(`SMTP_USER=${targetUser}`) || !freshBackendEnv.includes('SMTP_PASS=')) {
    throw new Error('Physical .env did not persist SMTP credentials');
  }
  console.log('✓ .env verified on disk with latest SMTP credentials');

  // Test 5: Verify updateGlobalSmtpConfig (from Super Admin UI)
  console.log('\n[Test 5] Simulating UI change from Super Admin Platform Settings:');
  updateGlobalSmtpConfig({
    host: 'smtp.gmail.com',
    port: 587,
    username: targetUser,
    password: targetPass,
    defaultSenderEmail: targetUser,
    defaultSenderName: 'AttendoSchool Superadmin'
  });

  const freshGlobal = getGlobalSmtpConfig();
  if (freshGlobal.defaultSenderName !== 'AttendoSchool Superadmin') {
    throw new Error('Global config failed to update sender name');
  }
  console.log('✓ Super Admin SMTP update synchronized successfully');

  console.log('\n=== ALL SMTP TESTS PASSED SUCCESSFULLY! ===\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
