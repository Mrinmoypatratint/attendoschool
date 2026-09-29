import React from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { DestructiveConfirmProps } from './types';

export const DestructiveConfirmModal: React.FC<DestructiveConfirmProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  entityName,
  entityType,
  details = [],
  warningMessage,
  confirmText = 'Confirm & Delete',
  loading = false,
  error = null
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="overlay"
      style={{
        zIndex: 10060,
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        className="modal"
        style={{
          width: 'min(500px, 95vw)',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid #fecaca',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.25)',
          overflow: 'hidden',
          padding: 0
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #fee2e2',
            background: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#991b1b' }}>
                {title || `Delete ${entityType}`}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#b91c1c' }}>
                Destructive operation confirmation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#991b1b',
              padding: 4
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: 13,
                marginBottom: 14
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: '#fff1f2',
              border: '1px solid #ffe4e6',
              color: '#9f1239',
              fontSize: 13.5,
              marginBottom: 16,
              lineHeight: 1.5
            }}
          >
            {warningMessage || (
              <span>
                Are you sure you want to permanently remove <strong>{entityName}</strong> from active institutional records? This operation will revoke portal access.
              </span>
            )}
          </div>

          {/* Affected Entity Details Card */}
          {details.length > 0 && (
            <div
              style={{
                background: 'var(--bg, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: 10,
                padding: '12px 14px'
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted, #64748b)',
                  display: 'block',
                  marginBottom: 8
                }}
              >
                Target Record Details
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {details.map((d, i) => (
                  <div key={i}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', display: 'block' }}>
                      {d.label}
                    </span>
                    <strong style={{ fontSize: 13, color: 'var(--text, #0f172a)' }}>
                      {String(d.value)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            background: 'var(--bg, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              border: '1px solid var(--border, #cbd5e1)',
              background: '#ffffff',
              color: 'var(--text, #334155)'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 20px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
            }}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="spinning" />
                <span>Deleting…</span>
              </>
            ) : (
              <>
                <Trash2 size={15} />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
