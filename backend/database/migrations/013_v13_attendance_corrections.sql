-- V13: Attendance Correction & Approval
CREATE TABLE IF NOT EXISTS attendance_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_status VARCHAR(20) NOT NULL CHECK (requested_status IN ('PRESENT','ABSENT')),
  current_status VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  reviewed_by UUID REFERENCES users(id),
  review_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_correction_school_status
  ON attendance_correction_requests(school_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_correction_record
  ON attendance_correction_requests(attendance_record_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_correction_record
  ON attendance_correction_requests(attendance_record_id)
  WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS attendance_correction_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  correction_request_id UUID NOT NULL REFERENCES attendance_correction_requests(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(30) NOT NULL,
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correction_audit_request
  ON attendance_correction_audit(correction_request_id, created_at DESC);
