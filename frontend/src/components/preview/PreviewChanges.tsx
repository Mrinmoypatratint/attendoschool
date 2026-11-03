import React from 'react';
import { ArrowRight, History } from 'lucide-react';
import { PreviewChangeData } from './types';

export const PreviewChanges: React.FC<{ changes: PreviewChangeData[] }> = ({ changes }) => {
  if (!changes || changes.length === 0) return null;

  const changedItems = changes.filter(c => c.isChanged !== false);
  if (changedItems.length === 0) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 sm:p-4.5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <History size={16} className="text-amber-600 dark:text-amber-400" />
        <h4 className="m-0 text-sm font-bold text-amber-900 dark:text-amber-200">
          Detected Changes ({changedItems.length} {changedItems.length === 1 ? 'field modified' : 'fields modified'})
        </h4>
      </div>

      <div className="flex flex-col gap-2">
        {changedItems.map((c, i) => (
          <div
            key={c.field || i}
            className="flex items-center justify-between flex-wrap gap-2 p-2 sm:px-3 rounded-lg bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/30 shadow-xs"
          >
            <strong className="text-[13px] font-semibold text-amber-950 dark:text-amber-100 min-w-[140px]">
              {c.label || c.field}
            </strong>
            <div className="flex items-center gap-2.5 flex-1 justify-end flex-wrap">
              <span className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/40 px-2 py-0.5 rounded-md line-through">
                {c.previousValue !== null && c.previousValue !== undefined && c.previousValue !== ''
                  ? String(c.previousValue)
                  : '— (Empty)'}
              </span>
              <ArrowRight size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/40 px-2 py-0.5 rounded-md">
                {c.newValue !== null && c.newValue !== undefined && c.newValue !== ''
                  ? String(c.newValue)
                  : '— (Cleared)'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
