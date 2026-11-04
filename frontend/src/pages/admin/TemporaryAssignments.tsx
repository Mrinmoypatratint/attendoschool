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
      className={`${embedded ? "as-temporary-assignments-view flex flex-col gap-5" : "admin-page-container p-6 md:p-8"}`}
    >
      {!embedded && (
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold m-0 text-slate-900 dark:text-slate-100">
                Teacher Substitution
              </h1>
              <p className="mt-1 mb-0 text-xs md:text-sm text-slate-500 dark:text-slate-400">
                Assign substitute teachers and manage temporary class allocations for specific dates without overwriting permanent class teacher assignments.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        <TemporaryAssignmentForm onSuccess={handleFormSuccess} />
        <TemporaryAssignmentTable key={refreshKey} onAssignmentsChange={onAssignmentsChange} />
      </div>
    </div>
  );
}
