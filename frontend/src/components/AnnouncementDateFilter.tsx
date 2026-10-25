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
    <div
      style={{
        backgroundColor: 'var(--card, #ffffff)',
        borderRadius: 12,
        border: '1px solid var(--border, #e2e8f0)',
        padding: '14px 16px',
        marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      {/* Top row: Header + Quick Filter Chips */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={16} color="var(--primary, #2563eb)" />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
            Filter by Date
          </span>
          {hasActiveFilter && (
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 999,
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--primary, #2563eb)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              Filtered
            </span>
          )}
        </div>

        {/* Quick Filter Pill Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginRight: 2 }}>
            Quick:
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickSelect('today')}
            style={{
              padding: '4px 11px',
              fontSize: 12,
              fontWeight: isTodayActive ? 700 : 500,
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              border: isTodayActive
                ? '1px solid var(--primary, #2563eb)'
                : '1px solid var(--border, #cbd5e1)',
              backgroundColor: isTodayActive
                ? 'rgba(37, 99, 235, 0.12)'
                : 'var(--surface-subtle, #f8fafc)',
              color: isTodayActive ? 'var(--primary, #2563eb)' : 'var(--text, #334155)',
              transition: 'all 0.15s ease'
            }}
          >
            Today
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickSelect('last7')}
            style={{
              padding: '4px 11px',
              fontSize: 12,
              fontWeight: isLast7Active ? 700 : 500,
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              border: isLast7Active
                ? '1px solid var(--primary, #2563eb)'
                : '1px solid var(--border, #cbd5e1)',
              backgroundColor: isLast7Active
                ? 'rgba(37, 99, 235, 0.12)'
                : 'var(--surface-subtle, #f8fafc)',
              color: isLast7Active ? 'var(--primary, #2563eb)' : 'var(--text, #334155)',
              transition: 'all 0.15s ease'
            }}
          >
            Last 7 Days
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickSelect('this_month')}
            style={{
              padding: '4px 11px',
              fontSize: 12,
              fontWeight: isThisMonthActive ? 700 : 500,
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              border: isThisMonthActive
                ? '1px solid var(--primary, #2563eb)'
                : '1px solid var(--border, #cbd5e1)',
              backgroundColor: isThisMonthActive
                ? 'rgba(37, 99, 235, 0.12)'
                : 'var(--surface-subtle, #f8fafc)',
              color: isThisMonthActive ? 'var(--primary, #2563eb)' : 'var(--text, #334155)',
              transition: 'all 0.15s ease'
            }}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Date Inputs + Action Buttons Form */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap'
        }}
      >
        {/* From Date Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 180px', minWidth: 160 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap' }}>
            From:
          </label>
          <input
            type="date"
            value={internalFrom}
            onChange={(e) => handleFromChange(e.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: 13,
              borderRadius: 6,
              border: errorMessage
                ? '1px solid #ef4444'
                : '1px solid var(--border, #cbd5e1)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              color: 'var(--text, #0f172a)',
              outline: 'none'
            }}
          />
        </div>

        {/* To Date Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 180px', minWidth: 160 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap' }}>
            To:
          </label>
          <input
            type="date"
            value={internalTo}
            onChange={(e) => handleToChange(e.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: 13,
              borderRadius: 6,
              border: errorMessage
                ? '1px solid #ef4444'
                : '1px solid var(--border, #cbd5e1)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              color: 'var(--text, #0f172a)',
              outline: 'none'
            }}
          />
        </div>

        {/* Buttons: Apply & Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={loading}
            onClick={handleApply}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'var(--primary, #2563eb)',
              color: '#ffffff',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
              transition: 'all 0.15s ease'
            }}
          >
            <Filter size={13} />
            Apply
          </button>

          {(hasActiveFilter || internalFrom || internalTo) && (
            <button
              type="button"
              disabled={loading}
              onClick={handleReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 6,
                border: '1px solid var(--border, #cbd5e1)',
                backgroundColor: 'transparent',
                color: 'var(--text-muted, #64748b)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCcw size={13} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Error Message banner if validation fails */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 6,
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#dc2626',
            fontSize: 12.5,
            fontWeight: 500
          }}
        >
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
export default AnnouncementDateFilter;
