import React from 'react';
import { PreviewSectionData } from './types';
import { PreviewField } from './PreviewField';

export const PreviewSection: React.FC<PreviewSectionData> = ({
  title,
  icon,
  badge,
  badgeColor = 'blue',
  fields
}) => {
  if (!fields || fields.length === 0) return null;

  const badgeClasses =
    badgeColor === 'green'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
      : badgeColor === 'amber'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
      : badgeColor === 'purple'
      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-4.5 mb-4 shadow-sm transition-colors">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {icon && <span className="text-blue-600 dark:text-blue-400 inline-flex">{icon}</span>}
          <h4 className="m-0 text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {title}
          </h4>
        </div>
        {badge && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badgeClasses}`}>
            {badge}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {fields.map((f, i) => (
          <PreviewField key={f.label || i} {...f} />
        ))}
      </div>
    </div>
  );
};
