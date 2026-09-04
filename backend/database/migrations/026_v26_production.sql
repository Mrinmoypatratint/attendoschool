-- V26: Production readiness metadata
CREATE TABLE IF NOT EXISTS system_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL,
  details JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_checks_component_time
 ON system_health_checks(component,checked_at DESC);

CREATE TABLE IF NOT EXISTS job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  details JSONB,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_job_runs_name_time ON job_runs(job_name,started_at DESC);
