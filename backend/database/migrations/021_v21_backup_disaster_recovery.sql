-- V21: Backup & Disaster Recovery
CREATE TABLE IF NOT EXISTS backup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  file_name TEXT,
  storage_location TEXT,
  size_bytes BIGINT,
  checksum_sha256 VARCHAR(64),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_time ON backup_jobs(started_at DESC);

CREATE TABLE IF NOT EXISTS backup_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  backup_type VARCHAR(30) NOT NULL DEFAULT 'DATABASE',
  frequency VARCHAR(20) NOT NULL DEFAULT 'DAILY',
  retention_days INTEGER NOT NULL DEFAULT 30,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_restore_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_job_id UUID REFERENCES backup_jobs(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL,
  notes TEXT,
  tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO backup_schedules(name,backup_type,frequency,retention_days,enabled)
VALUES
('Daily Database Backup','DATABASE','DAILY',30,TRUE),
('Weekly Database Backup','DATABASE','WEEKLY',90,TRUE)
ON CONFLICT(name) DO NOTHING;
