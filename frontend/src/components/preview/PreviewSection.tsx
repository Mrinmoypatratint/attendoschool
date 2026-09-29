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

  const badgeBg =
    badgeColor === 'green' ? '#dcfce7' :
    badgeColor === 'amber' ? '#fef3c7' :
    badgeColor === 'purple' ? '#faf5ff' : '#eff6ff';

  const badgeTextColor =
    badgeColor === 'green' ? '#15803d' :
    badgeColor === 'amber' ? '#b45309' :
    badgeColor === 'purple' ? '#9333ea' : '#1d4ed8';

  return (
    <div
      style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: 12,
        padding: '16px 18px',
        marginBottom: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border, #f1f5f9)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <span style={{ color: '#2563eb', display: 'inline-flex' }}>{icon}</span>}
          <h4
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text, #0f172a)',
              letterSpacing: '-0.01em'
            }}
          >
            {title}
          </h4>
        </div>
        {badge && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 12,
              background: badgeBg,
              color: badgeTextColor
            }}
          >
            {badge}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10
        }}
      >
        {fields.map((f, i) => (
          <PreviewField key={f.label || i} {...f} />
        ))}
      </div>
    </div>
  );
};
