import React, { useState } from 'react';
import TemporaryAssignmentForm from '../../components/TemporaryAssignmentForm';
import TemporaryAssignmentTable from '../../components/TemporaryAssignmentTable';
import { ClipboardCheck } from 'lucide-react';

interface Props {
  embedded?: boolean;
  onAssignmentsChange?: () => void;
}

export default function TemporaryAssignments({ embedded = false, onAssignmentsChange }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleFormSuccess = () => {
    setRefreshKey(k => k + 1);
    if (onAssignmentsChange) onAssignmentsChange();
  };

  return (
    <div
      className={embedded ? "as-temporary-assignments-view" : "admin-page-container"}
      style={embedded ? { display: 'flex', flexDirection: 'column', gap: 20 } : { padding: '24px 32px' }}
    >
      {!embedded && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--primary-subtle, rgba(37, 99, 235, 0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary, #2563eb)'
            }}>
              <ClipboardCheck size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                Teacher Substitution
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
                Assign substitute teachers and manage temporary class allocations for specific dates without overwriting permanent class teacher assignments.
              </p>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <TemporaryAssignmentForm onSuccess={handleFormSuccess} />
        <TemporaryAssignmentTable key={refreshKey} onAssignmentsChange={onAssignmentsChange} />
      </div>
    </div>
  );
}
