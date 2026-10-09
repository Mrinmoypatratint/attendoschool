import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  X,
  FileCheck,
  ShieldCheck,
  RotateCcw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { UniversalPreviewProps } from './types';
import { PreviewSection } from './PreviewSection';
import { PreviewChanges } from './PreviewChanges';

export const UniversalPreviewModal: React.FC<UniversalPreviewProps> = ({
  isOpen,
  onClose,
  onEdit,
  onConfirm,
  title,
  subtitle = 'Please carefully review the entered details before permanently committing to the database.',
  entityName,
  operationType = 'create',
  confirmText,
  editText = 'Back to Edit',
  loading = false,
  error = null,
  sections = [],
  changes = [],
  summaryCards = [],
  tableData,
  isDestructive = false,
  destructiveWarning,
  children,
  width = 'min(700px, 95vw)'
}) => {
  if (!isOpen) return null;

  const [isMaximized, setIsMaximized] = useState(false);

  const defaultConfirmText =
    confirmText ||
    (isDestructive
      ? 'Confirm & Delete'
      : operationType === 'update'
      ? 'Confirm & Save Changes'
      : operationType === 'submit'
      ? 'Confirm & Submit'
      : operationType === 'import'
      ? 'Confirm & Import Data'
      : 'Confirm & Save');

  return (
    <div
      className="overlay"
      style={{
        zIndex: 10050,
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMaximized ? 8 : 16,
        transition: 'padding 0.2s ease'
      }}
    >
      <div
        className="modal"
        style={{
          width: isMaximized ? '97vw' : width,
          maxHeight: isMaximized ? '97vh' : '92vh',
          height: isMaximized ? '97vh' : undefined,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border, #cbd5e1)',
          borderRadius: isMaximized ? 12 : 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          padding: 0,
          transition: 'width 0.2s ease, height 0.2s ease, border-radius 0.2s ease'
        }}
      >
        {/* ─── Modal Header ─── */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isDestructive ? '#fef2f2' : 'var(--bg, #f8fafc)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: isDestructive ? '#fee2e2' : '#eff6ff',
                color: isDestructive ? '#dc2626' : '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {isDestructive ? <AlertTriangle size={22} /> : <FileCheck size={22} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 800,
                    color: isDestructive ? '#991b1b' : 'var(--text, #0f172a)',
                    letterSpacing: '-0.02em'
                  }}
                >
                  {title}
                </h3>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: isDestructive ? '#fee2e2' : operationType === 'update' ? '#fef3c7' : '#dcfce7',
                    color: isDestructive ? '#b91c1c' : operationType === 'update' ? '#b45309' : '#15803d'
                  }}
                >
                  {isDestructive ? 'Destructive Action' : operationType === 'update' ? 'Update Preview' : 'Preview Step'}
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
                {subtitle}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setIsMaximized(m => !m)}
              disabled={loading}
              style={{
                background: isMaximized ? '#e2e8f0' : 'transparent',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: isMaximized ? 'var(--text, #0f172a)' : 'var(--text-muted, #94a3b8)',
                padding: 6,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title={isMaximized ? 'Restore standard size' : 'Maximize window'}
            >
              {isMaximized ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: 'var(--text-muted, #94a3b8)',
                padding: 6,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title="Cancel and return"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─── Scrollable Modal Body ─── */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Review Banner */}
          {!isDestructive && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 10,
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1e40af',
                fontSize: 13,
                marginBottom: 16
              }}
            >
              <ShieldCheck size={18} style={{ flexShrink: 0 }} />
              <span>
                <strong>Verification Mode:</strong> This record has not been saved yet. Please review all fields. If anything needs correction, click <strong>{editText}</strong>.
              </span>
            </div>
          )}

          {/* Destructive Warning */}
          {isDestructive && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 10,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 13,
                marginBottom: 16,
                fontWeight: 600
              }}
            >
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
              <span>
                {destructiveWarning ||
                  `Warning: This destructive operation will delete or deactivate ${entityName || 'this record'}. This cannot be undone.`}
              </span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: 13,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={onEdit}
                style={{
                  background: '#ffffff',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Back to Form
              </button>
            </div>
          )}

          {/* KPI Summary Cards */}
          {summaryCards.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(${Math.floor(100 / summaryCards.length)}%, 1fr))`,
                gap: 12,
                marginBottom: 16
              }}
            >
              {summaryCards.map((c, i) => (
                <div
                  key={c.label || i}
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
                      color: 'var(--text-muted, #64748b)'
                    }}
                  >
                    {c.label}
                  </span>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text, #0f172a)', margin: '2px 0' }}>
                    {c.value}
                  </div>
                  {c.sub && <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>{c.sub}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Change Detection Diff (for Edit/Update) */}
          {changes.length > 0 && <PreviewChanges changes={changes} />}

          {/* Detailed Field Sections */}
          {sections.map((s, i) => (
            <PreviewSection key={s.title || i} {...s} />
          ))}

          {/* Table Data Preview */}
          {tableData && tableData.rows.length > 0 && (
            <div
              style={{
                background: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 16
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                    {tableData.headers.map((h, i) => (
                      <th
                        key={i}
                        style={{
                          padding: '10px 14px',
                          color: 'var(--text-muted, #64748b)',
                          fontWeight: 700,
                          fontSize: 11,
                          textTransform: 'uppercase'
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} style={{ padding: '9px 14px' }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Custom Children */}
          {children}
        </div>

        {/* ─── Modal Footer Actions ─── */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg, #f8fafc)',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          {/* Left: Back to Edit Button */}
          <button
            type="button"
            onClick={onEdit}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--bg-card, #ffffff)',
              color: 'var(--text, #1e293b)',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <ArrowLeft size={16} />
            <span>{editText}</span>
          </button>

          {/* Right: Cancel & Final Confirm Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                border: '1px solid transparent',
                background: 'transparent',
                color: 'var(--text-muted, #64748b)'
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
                padding: '10px 22px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                border: 'none',
                background: isDestructive ? '#dc2626' : '#2563eb',
                color: '#ffffff',
                boxShadow: isDestructive
                  ? '0 2px 6px rgba(220, 38, 38, 0.3)'
                  : '0 2px 6px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.15s ease'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spinning" />
                  <span>Submitting…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>{defaultConfirmText}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
