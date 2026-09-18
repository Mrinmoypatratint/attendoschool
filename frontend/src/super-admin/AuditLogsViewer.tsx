import React, { useState, useEffect, useMemo } from 'react';
import { AuditLogRecord } from './types';
import { apiRequest } from '../api';

export const AuditLogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  // Inspector modal
  const [inspectLog, setInspectLog] = useState<AuditLogRecord | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ logs: AuditLogRecord[]; total: number }>('/super-admin/audit-logs')
        .catch(() => ({ logs: [], total: 0 }));
      setLogs(res.logs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load system audit trail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleExportJson = () => {
    if (filteredLogs.length === 0) return;
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendoschool_audit_trail_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const matchesSearch =
        search === '' ||
        l.userName?.toLowerCase().includes(search.toLowerCase()) ||
        l.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
        l.action?.toLowerCase().includes(search.toLowerCase()) ||
        (l.schoolName && l.schoolName.toLowerCase().includes(search.toLowerCase()));

      const matchesAction = actionFilter === 'ALL' || l.action === actionFilter;
      return matchesSearch && matchesAction;
    });
  }, [logs, search, actionFilter]);

  // Distinct actions for dropdown
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action).filter(Boolean)));

  return (
    <div className="super-admin-content-inner">
      {/* Header */}
      <div className="section-header-row">
        <div>
          <h2 className="section-title">System Audit Trail & Compliance Ledger</h2>
          <p className="section-subtitle">
            Immutable log of all administrative actions, tenant lifecycle events, user status modifications, and billing updates.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={loadLogs} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh Logs
          </button>
          <button className="btn-primary" onClick={handleExportJson} disabled={filteredLogs.length === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export JSON
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ margin: '16px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px', margin: '20px 0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by user, action name, or target institution..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: '36px' }}
            />
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Action Filter:</span>
            <select
              className="form-control"
              style={{ width: '200px' }}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="ALL">All Actions</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {(search || actionFilter !== 'ALL') && (
            <button
              className="btn-secondary"
              style={{ padding: '8px 14px' }}
              onClick={() => {
                setSearch('');
                setActionFilter('ALL');
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Audit Trail Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Action Event</th>
                <th>Actor Identity</th>
                <th>Target Entity</th>
                <th>Scope Institution</th>
                <th>IP Address</th>
                <th>Timestamp</th>
                <th style={{ textAlign: 'right' }}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px', width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Loading compliance audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No audit records matching your search query.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isCreate = log.action?.includes('CREATE');
                  const isRenew = log.action?.includes('RENEW');
                  const isStatus = log.action?.includes('STATUS');

                  return (
                    <tr key={log.id}>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: isCreate ? 'rgba(16, 185, 129, 0.1)' : isRenew ? 'rgba(99, 102, 241, 0.1)' : isStatus ? 'rgba(245, 158, 11, 0.1)' : '#f1f5f9',
                            color: isCreate ? '#10b981' : isRenew ? '#4f46e5' : isStatus ? '#f59e0b' : '#475569',
                            fontWeight: '600',
                            fontFamily: 'monospace'
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{log.userName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{log.userEmail}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#334155', fontWeight: '500' }}>
                          {log.entityType} ({log.entityId?.slice(0, 12)}...)
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', color: '#334155' }}>
                          {log.schoolName || 'Platform Global'}
                        </span>
                      </td>
                      <td>
                        <code style={{ fontSize: '12px', color: '#64748b' }}>
                          {log.ipAddress || '127.0.0.1'}
                        </code>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {log.createdAt ? new Date(log.createdAt).toLocaleString('en-IN') : 'Recent'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          onClick={() => setInspectLog(log)}
                        >
                          Inspect JSON
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: JSON Payload Inspector */}
      {inspectLog && (
        <div className="modal-backdrop" onClick={() => setInspectLog(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                  Audit Event Payload: {inspectLog.action}
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Event ID: {inspectLog.id} · {new Date(inspectLog.createdAt).toLocaleString()}
                </div>
              </div>
              <button
                className="close-btn"
                onClick={() => setInspectLog(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 0' }}>
              <pre
                style={{
                  background: '#0f172a',
                  color: '#e2e8f0',
                  padding: '16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  overflowX: 'auto',
                  maxHeight: '400px'
                }}
              >
                {JSON.stringify(inspectLog, null, 2)}
              </pre>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setInspectLog(null)}>
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
