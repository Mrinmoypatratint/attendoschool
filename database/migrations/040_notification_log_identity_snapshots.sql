-- Preserve the identity used to render each email. A delivery log is an audit
-- record and must not be reinterpreted from mutable/non-unique recipient email.
ALTER TABLE notification_logs
  ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS admission_number VARCHAR(120);

-- Recover admission numbers for historical messages where the rendered text
-- contains the value. Future records write these snapshot columns directly.
UPDATE notification_logs
SET admission_number = NULLIF(
  BTRIM(SUBSTRING(message FROM 'Admission Number \(Login ID\):[[:space:]]*([^\r\n]+)')),
  ''
)
WHERE admission_number IS NULL
  AND message ~ 'Admission Number \(Login ID\):';

CREATE INDEX IF NOT EXISTS notification_logs_school_admission_idx
  ON notification_logs(school_id, admission_number)
  WHERE admission_number IS NOT NULL;
