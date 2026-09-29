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
        <span style={{ color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic', fontSize: 13 }}>
          — (Not Specified)
        </span>
      );
    }

    if (type === 'boolean') {
      const isTrue = Boolean(value) && value !== 'false' && value !== '0';
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 9px',
            borderRadius: 20,
            fontSize: 11.5,
            fontWeight: 700,
            background: isTrue ? '#dcfce7' : '#fee2e2',
            color: isTrue ? '#15803d' : '#b91c1c'
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isTrue ? '#16a34a' : '#ef4444' }} />
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
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.03em',
            background: isPositive ? '#dcfce7' : isWarning ? '#fef3c7' : '#fee2e2',
            color: isPositive ? '#15803d' : isWarning ? '#b45309' : '#b91c1c'
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isPositive ? '#16a34a' : isWarning ? '#f59e0b' : '#ef4444' }} />
          {strVal}
        </span>
      );
    }

    if (type === 'code') {
      return (
        <code
          style={{
            background: 'var(--bg, #f1f5f9)',
            border: '1px solid var(--border, #cbd5e1)',
            borderRadius: 6,
            padding: '2px 8px',
            fontFamily: 'monospace',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--text, #0f172a)'
          }}
        >
          {String(value)}
        </code>
      );
    }

    if (type === 'badge' || type === 'pill') {
      return (
        <span
          style={{
            display: 'inline-block',
            padding: '3px 9px',
            borderRadius: 6,
            background: 'var(--bg, #eff6ff)',
            color: 'var(--primary, #2563eb)',
            fontSize: 12,
            fontWeight: 600,
            border: '1px solid #bfdbfe'
          }}
        >
          {String(value)}
        </span>
      );
    }

    if (type === 'email') {
      return (
        <span style={{ color: '#2563eb', fontWeight: 500, fontSize: 13.5, wordBreak: 'break-all' }}>
          {String(value)}
        </span>
      );
    }

    if (type === 'phone') {
      return (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, color: 'var(--text, #1e293b)' }}>
          {String(value)}
        </span>
      );
    }

    return (
      <span style={{ color: 'var(--text, #0f172a)', fontWeight: 600, fontSize: 13.5, wordBreak: 'break-word' }}>
        {String(value)}
      </span>
    );
  };

  return (
    <div
      style={{
        gridColumn: span === 2 ? 'span 2' : 'span 1',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        padding: '8px 12px',
        borderRadius: 8,
        background: 'var(--bg, #f8fafc)',
        border: '1px solid var(--border, #f1f5f9)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon && <span style={{ color: 'var(--text-muted, #64748b)', display: 'inline-flex' }}>{icon}</span>}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted, #64748b)'
          }}
        >
          {label}
        </span>
      </div>
      <div>{renderValue()}</div>
    </div>
  );
};
