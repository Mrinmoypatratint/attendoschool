import React, { useState, useEffect } from 'react';
import { Calendar, Filter, RotateCcw, AlertCircle, X, Sparkles } from 'lucide-react';

export interface AnnouncementDateFilterProps {
  fromDate: string;
  toDate: string;
  onApply: (from: string, to: string) => void;
  onReset: () => void;
  loading?: boolean;
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getQuickDateRange(type: 'today' | 'last7' | 'this_month'): { from: string; to: string } {
  const now = new Date();
  const to = toLocalDateString(now);

  if (type === 'today') {
    return { from: to, to };
  }
  if (type === 'last7') {
    const past7 = new Date(now);
    past7.setDate(now.getDate() - 6);
    return { from: toLocalDateString(past7), to };
  }
  if (type === 'this_month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toLocalDateString(firstDay), to };
  }
  return { from: '', to: '' };
}

export function AnnouncementDateFilter({
  fromDate,
  toDate,
  onApply,
  onReset,
  loading = false
}: AnnouncementDateFilterProps) {
  const [internalFrom, setInternalFrom] = useState(fromDate);
  const [internalTo, setInternalTo] = useState(toDate);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync internal inputs when parent props change (e.g. on reset or external update)
  useEffect(() => {
    setInternalFrom(fromDate);
    setInternalTo(toDate);
    if (errorMessage) {
      setErrorMessage(null);
    }
  }, [fromDate, toDate]);

  function validate(from: string, to: string): boolean {
    if (from && to && from > to) {
      setErrorMessage('"From" date cannot be after "To" date.');
      return false;
    }
    setErrorMessage(null);
    return true;
  }

  function handleFromChange(val: string) {
    setInternalFrom(val);
    if (errorMessage) {
      if (!val || !internalTo || val <= internalTo) {
        setErrorMessage(null);
      }
    }
  }

  function handleToChange(val: string) {
    setInternalTo(val);
    if (errorMessage) {
      if (!internalFrom || !val || internalFrom <= val) {
        setErrorMessage(null);
      }
    }
  }

  function handleApply() {
    if (!validate(internalFrom, internalTo)) {
      return;
    }
    onApply(internalFrom, internalTo);
  }

  function handleReset() {
    setInternalFrom('');
    setInternalTo('');
    setErrorMessage(null);
    onReset();
  }

  function handleQuickSelect(type: 'today' | 'last7' | 'this_month') {
    const range = getQuickDateRange(type);
    setInternalFrom(range.from);
    setInternalTo(range.to);
    setErrorMessage(null);
    onApply(range.from, range.to);
  }

  // Determine which quick button is currently active
  const todayRange = getQuickDateRange('today');
  const last7Range = getQuickDateRange('last7');
  const thisMonthRange = getQuickDateRange('this_month');

  const isTodayActive = fromDate === todayRange.from && toDate === todayRange.to;
  const isLast7Active = fromDate === last7Range.from && toDate === last7Range.to;
  const isThisMonthActive = fromDate === thisMonthRange.from && toDate === thisMonthRange.to;
  const hasActiveFilter = Boolean(fromDate || toDate);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 mb-5 shadow-xs flex flex-col gap-3 transition-colors">
      {/* Top row: Header + Quick Filter Chips */}
      <div className="flex justify-between items-center flex-wrap gap-2.5">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-blue-600 dark:text-blue-400" />
          <span className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100">
            Filter by Date
          </span>
          {hasActiveFilter && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold inline-flex items-center gap-1">
              Filtered
            </span>
          )}
        </div>

        {/* Quick Filter Pill Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-0.5">
            Quick:
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickSelect('today')}
            className={`px-2.5 py-1 text-xs rounded-md cursor-pointer disabled:cursor-not-allowed transition-all border ${
              isTodayActive
                ? 'font-bold border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                : 'font-medium border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            Today
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickSelect('last7')}
            className={`px-2.5 py-1 text-xs rounded-md cursor-pointer disabled:cursor-not-allowed transition-all border ${
              isLast7Active
                ? 'font-bold border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                : 'font-medium border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            Last 7 Days
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickSelect('this_month')}
            className={`px-2.5 py-1 text-xs rounded-md cursor-pointer disabled:cursor-not-allowed transition-all border ${
              isThisMonthActive
                ? 'font-bold border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                : 'font-medium border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Date Inputs + Action Buttons Form */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* From Date Input */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
          <label className="text-[12.5px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            From:
          </label>
          <input
            type="date"
            value={internalFrom}
            onChange={(e) => handleFromChange(e.target.value)}
            disabled={loading}
            className={`w-full px-2.5 py-1.5 text-[13px] rounded-md outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-colors border ${
              errorMessage
                ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                : 'border-slate-300 dark:border-slate-700 focus:ring-1 focus:ring-blue-500'
            }`}
          />
        </div>

        {/* To Date Input */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
          <label className="text-[12.5px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            To:
          </label>
          <input
            type="date"
            value={internalTo}
            onChange={(e) => handleToChange(e.target.value)}
            disabled={loading}
            className={`w-full px-2.5 py-1.5 text-[13px] rounded-md outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-colors border ${
              errorMessage
                ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                : 'border-slate-300 dark:border-slate-700 focus:ring-1 focus:ring-blue-500'
            }`}
          />
        </div>

        {/* Buttons: Apply & Reset */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={loading}
            onClick={handleApply}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-semibold rounded-md border-0 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:cursor-not-allowed shadow-xs transition-colors"
          >
            <Filter size={13} />
            Apply
          </button>

          {(hasActiveFilter || internalFrom || internalTo) && (
            <button
              type="button"
              disabled={loading}
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Error Message banner if validation fails */}
      {errorMessage && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-[12.5px] font-medium">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
export default AnnouncementDateFilter;
