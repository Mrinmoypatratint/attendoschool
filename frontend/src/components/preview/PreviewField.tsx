import React from 'react';
import { PreviewFieldData } from './types';

export const PreviewField: React.FC<PreviewFieldData> = ({
  label,
  value,
  type = 'text',
  color = 'slate',
  icon,
  span = 1
}) => {
  const isNullOrEmpty = value === null || value === undefined || value === '';

  const renderValue = () => {
    if (isNullOrEmpty) {
      return (
        <span className="text-slate-400 dark:text-slate-500 italic text-[13px]">
          — (Not Specified)
        </span>
      );
    }

    if (type === 'boolean') {
      const isTrue = Boolean(value) && value !== 'false' && value !== '0';
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-bold ${
            isTrue
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isTrue ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-rose-600 dark:bg-rose-400'
            }`}
          />
          {isTrue ? 'Yes / Enabled' : 'No / Disabled'}
        </span>
      );
    }

    if (type === 'status') {
      const strVal = String(value).toUpperCase();
      const isPositive = strVal === 'ACTIVE' || strVal === 'APPROVED' || strVal === 'PRESENT' || strVal === 'SUCCESS';
      const isWarning = strVal === 'PENDING' || strVal === 'LATE' || strVal === 'HALF_DAY';
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-bold tracking-wide ${
            isPositive
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : isWarning
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isPositive
                ? 'bg-emerald-600 dark:bg-emerald-400'
                : isWarning
                ? 'bg-amber-500 dark:bg-amber-400'
                : 'bg-rose-600 dark:bg-rose-400'
            }`}
          />
          {strVal}
        </span>
      );
    }

    if (type === 'code') {
      return (
        <code className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 font-mono text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">
          {String(value)}
        </code>
      );
    }

    if (type === 'badge' || type === 'pill') {
      return (
        <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 text-xs font-semibold">
          {String(value)}
        </span>
      );
    }

    if (type === 'email') {
      return (
        <span className="text-blue-600 dark:text-blue-400 font-medium text-[13.5px] break-all">
          {String(value)}
        </span>
      );
    }

    if (type === 'phone') {
      return (
        <span className="font-mono font-semibold text-[13px] text-slate-800 dark:text-slate-200">
          {String(value)}
        </span>
      );
    }

    return (
      <span className="text-slate-900 dark:text-slate-100 font-semibold text-[13.5px] break-words">
        {String(value)}
      </span>
    );
  };

  return (
    <div
      className={`flex flex-col gap-1 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 transition-colors ${
        span === 2 ? 'col-span-2' : 'col-span-1'
      }`}
    >
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-slate-500 dark:text-slate-400 inline-flex">{icon}</span>}
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
      </div>
      <div>{renderValue()}</div>
    </div>
  );
};
