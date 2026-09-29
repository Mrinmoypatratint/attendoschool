import React from 'react';
import { ArrowRight, History } from 'lucide-react';
import { PreviewChangeData } from './types';

export const PreviewChanges: React.FC<{ changes: PreviewChangeData[] }> = ({ changes }) => {
  if (!changes || changes.length === 0) return null;

  const changedItems = changes.filter(c => c.isChanged !== false);
  if (changedItems.length === 0) return null;

  return (
    <div
      style={{
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: 12,
        padding: '16px 18px',
        marginBottom: 16
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <History size={16} style={{ color: '#d97706' }} />
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#92400e' }}>
          Detected Changes ({changedItems.length} {changedItems.length === 1 ? 'field modified' : 'fields modified'})
        </h4>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {changedItems.map((c, i) => (
          <div
            key={c.field || i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 8,
              background: '#ffffff',
              border: '1px solid #fef3c7'
            }}
          >
            <strong style={{ fontSize: 13, color: '#78350f', minWidth: 140 }}>
              {c.label || c.field}
            </strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 12.5,
                  color: '#991b1b',
                  background: '#fee2e2',
                  padding: '2px 8px',
                  borderRadius: 6,
                  textDecoration: 'line-through'
                }}
              >
                {c.previousValue !== null && c.previousValue !== undefined && c.previousValue !== ''
                  ? String(c.previousValue)
                  : '— (Empty)'}
              </span>
              <ArrowRight size={14} style={{ color: '#b45309' }} />
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#15803d',
                  background: '#dcfce7',
                  padding: '2px 8px',
                  borderRadius: 6
                }}
              >
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
