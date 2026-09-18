import React, { useState, useEffect, useMemo } from 'react';
import { PaymentRecord } from './types';
import { apiRequest } from '../api';

export const PaymentsLedger: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [reconcileFilter, setReconcileFilter] = useState<string>('ALL');

  // Action status
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try reconciliation endpoint first, then standard payments
      const data = await apiRequest<PaymentRecord[]>('/super-admin/payments/reconciliation')
        .catch(() => apiRequest<PaymentRecord[]>('/super-admin/payments'))
        .catch(() => []);
      setPayments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load transaction ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleReconcile = async (id: string) => {
    setReconcilingId(id);
    setActionSuccess(null);
    try {
      await apiRequest(`/super-admin/payments/${id}/reconcile`, {
        method: 'POST'
      });
      setActionSuccess(`Payment transaction ${id} has been marked as RECONCILED.`);
      // Update local state
      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, reconciliation_status: 'RECONCILED' } : p))
      );
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to reconcile transaction.');
    } finally {
      setReconcilingId(null);
    }
  };

  const handleExportCsv = () => {
    if (filteredPayments.length === 0) return;
    const headers = ['ID', 'School', 'Plan', 'Amount (INR)', 'Provider', 'Status', 'Reconciliation', 'Date'];
    const rows = filteredPayments.map((p) => [
      p.id,
      `"${(p.school_name || 'School').replace(/"/g, '""')}"`,
      `"${(p.plan_name || 'Standard').replace(/"/g, '""')}"`,
      p.amount,
      p.provider,
      p.status,
      p.reconciliation_status || 'UNRECONCILED',
      p.paid_at || p.created_at || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `attendoschool_payments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch =
        search === '' ||
        (p.school_name && p.school_name.toLowerCase().includes(search.toLowerCase())) ||
        (p.id && p.id.toLowerCase().includes(search.toLowerCase())) ||
        (p.provider_order_id && p.provider_order_id.toLowerCase().includes(search.toLowerCase())) ||
        (p.invoice_number && p.invoice_number.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchesReconcile =
        reconcileFilter === 'ALL' ||
        (reconcileFilter === 'RECONCILED' && p.reconciliation_status === 'RECONCILED') ||
        (reconcileFilter === 'UNRECONCILED' && p.reconciliation_status !== 'RECONCILED');

      return matchesSearch && matchesStatus && matchesReconcile;
    });
  }, [payments, search, statusFilter, reconcileFilter]);

  // Aggregate Metrics
  const totalSettled = payments
    .filter((p) => p.status === 'PAID')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const pendingCount = payments.filter((p) => p.status === 'PENDING').length;
  const reconciledCount = payments.filter((p) => p.reconciliation_status === 'RECONCILED').length;

  return (
    <div className="super-admin-content-inner">
      {/* Header */}
      <div className="section-header-row">
        <div>
          <h2 className="section-title">Institutional Payments Ledger</h2>
          <p className="section-subtitle">
            Audit multi-tenant subscription remittances, payment gateway provider statuses, and bank reconciliation records.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={loadPayments} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
          <button className="btn-primary" onClick={handleExportCsv} disabled={filteredPayments.length === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Ledger CSV
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div style={{ margin: '14px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {actionSuccess}
        </div>
      )}

      {error && (
        <div className="error-banner" style={{ margin: '16px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {/* KPI Cards Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', margin: '20px 0' }}>
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Settled Revenue
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', marginTop: '6px' }}>
            ₹{totalSettled.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Across verified tenant accounts
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending Invoices
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: pendingCount > 0 ? '#f59e0b' : '#0f172a', marginTop: '6px' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Awaiting bank or gateway capture
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Reconciled Transactions
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#6366f1', marginTop: '6px' }}>
            {reconciledCount} / {payments.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Audit verification matched
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Default Currency & Gateway
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
            INR · Razorpay
          </div>
          <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
            18% GST auto-computed
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by school, transaction ID, order ref..."
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
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Status:</span>
            <select
              className="form-control"
              style={{ width: '130px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Reconciliation:</span>
            <select
              className="form-control"
              style={{ width: '160px' }}
              value={reconcileFilter}
              onChange={(e) => setReconcileFilter(e.target.value)}
            >
              <option value="ALL">All Records</option>
              <option value="RECONCILED">Reconciled</option>
              <option value="UNRECONCILED">Unreconciled</option>
            </select>
          </div>

          {(search || statusFilter !== 'ALL' || reconcileFilter !== 'ALL') && (
            <button
              className="btn-secondary"
              style={{ padding: '8px 14px' }}
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setReconcileFilter('ALL');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Institution</th>
                <th>Subscribed Tier</th>
                <th>Amount (INR)</th>
                <th>Payment Gateway</th>
                <th>Payment Status</th>
                <th>Reconciliation</th>
                <th>Timestamp</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px', width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Loading payment records...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No payment transactions matching the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const isPaid = p.status === 'PAID';
                  const isReconciled = p.reconciliation_status === 'RECONCILED';

                  return (
                    <tr key={p.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                          {p.id.length > 20 ? `${p.id.slice(0, 16)}...` : p.id}
                        </span>
                        {p.provider_order_id && (
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            Ref: {p.provider_order_id}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>
                          {p.school_name || 'Greenwood International School'}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#4f46e5', fontWeight: '600' }}>
                          {p.plan_name || 'Enterprise'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: '700', color: '#0f172a' }}>
                          ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                          {p.provider || 'RAZORPAY'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${isPaid ? 'badge-active' : p.status === 'PENDING' ? 'badge-pending' : 'badge-suspended'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: isReconciled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: isReconciled ? '#10b981' : '#f59e0b',
                            border: `1px solid ${isReconciled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                          }}
                        >
                          {isReconciled ? 'RECONCILED' : 'PENDING AUDIT'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {p.paid_at || p.created_at ? new Date(p.paid_at || p.created_at!).toLocaleString('en-IN') : 'Recent'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!isReconciled ? (
                          <button
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '11px', color: '#4f46e5' }}
                            disabled={reconcilingId === p.id}
                            onClick={() => handleReconcile(p.id)}
                          >
                            {reconcilingId === p.id ? 'Reconciling...' : 'Reconcile'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>
                            &check; Verified
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
