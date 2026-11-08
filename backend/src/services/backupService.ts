import path from 'path';
// Shared format and job state for HTTP, the dedicated worker, and nightly cron.
const backup = require(path.resolve(__dirname, '../../../scripts/backup/core.cjs'));
export const backupManager = () => new backup.BackupManager(process.env);
export const requireBackupOwner = backup.requireOwner;
