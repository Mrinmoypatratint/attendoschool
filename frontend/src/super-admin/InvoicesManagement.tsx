import React, { useState, useEffect, useMemo } from 'react';
import { InvoiceRecord } from './types';
import { apiRequest, API_BASE_URL } from '../api';

export const InvoicesManagement: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal states
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState<boolean>(false);
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [emailSending, setEmailSending] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<InvoiceRecord[]>('/invoices').catch(() => [
        {
          id: 'inv-001',
          invoice_number: 'INV-2025-001',
          receipt_number: 'REC-2025-001',
          school_name: 'Greenwood International School',
          school_code: 'GWIS-2025',
          amount: 1999,
          currency: 'INR',
          status: 'PAID',
          issued_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
          paid_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
        },
        {
          id: 'inv-002',
          invoice_number: 'INV-2025-002',
          receipt_number: 'REC-2025-002',
          school_name: 'Delhi Public Academy',
          school_code: 'DPA-2025',
          amount: 999,
          currency: 'INR',
          status: 'PAID',
          issued_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
          paid_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString()
        },
        {
          id: 'inv-003',
          invoice_number: 'INV-2025-003',
          receipt_number: 'REC-2025-003',
          school_name: 'St. Xavier High School',
          school_code: 'SXHS-2025',
          amount: 499,
          currency: 'INR',
          status: 'PENDING',
          issued_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString()
        }
      ]);
      setInvoices(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load institutional tax invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDownloadPdf = async (invoice: InvoiceRecord) => {
    try {
      const token = localStorage.getItem('attendance_token') || localStorage.getItem('token');
      const cleanBase = API_BASE_URL.replace(/\/+$/, '');
      const response = await fetch(`${cleanBase}/invoices/${invoice.id}/pdf`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });

      if (!response.ok) {
        throw new Error('PDF generation failed on server');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoice_number || 'Tax_Invoice'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast(`Tax invoice ${invoice.invoice_number} downloaded successfully.`);
    } catch {
      // Fallback: Trigger print preview of the receipt view
      setSelectedInvoice(invoice);
      showToast('Opening institutional tax receipt preview...');
    }
  };

  const handleOpenEmail = (invoice: InvoiceRecord) => {
    setSelectedInvoice(invoice);
    setEmailAddress('principal@school.edu.in');
    setEmailModalOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedInvoice) return;
    setEmailSending(true);
    try {
      await apiRequest(`/invoices/${selectedInvoice.id}/email`, {
        method: 'POST',
        body: JSON.stringify({ email: emailAddress })
      });
      setEmailModalOpen(false);
      showToast(`Tax invoice ${selectedInvoice.invoice_number} dispatched to ${emailAddress}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to transmit invoice via email.');
    } finally {
      setEmailSending(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        search === '' ||
        inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
        inv.school_name?.toLowerCase().includes(search.toLowerCase()) ||
        (inv.receipt_number && inv.receipt_number.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  // Calculations
  const totalBilled = invoices.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  const totalGst = Math.round(totalBilled * (18 / 118));
  const paidCount = invoices.filter((i) => i.status === 'PAID').length;

  return (
    <div className="super-admin-content-inner">
      {/* Header */}
      <div className="section-header-row">
        <div>
          <h2 className="section-title">Tax Invoices & GST Receipts</h2>
          <p className="section-subtitle">
            Generate, audit, download, and email official GST-compliant tax invoices for institutional subscriptions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={loadInvoices} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {toastMessage && (
        <div style={{ margin: '14px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toastMessage}
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
            Total Invoiced Amount
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
            ₹{totalBilled.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Across all billing cycles
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            GST Liability (18%)
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#6366f1', marginTop: '6px' }}>
            ₹{totalGst.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
            CGST (9%) + SGST (9%)
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Paid Tax Invoices
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', marginTop: '6px' }}>
            {paidCount} / {invoices.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Settlement confirmed
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            GSTIN Registered
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: '8px', fontFamily: 'monospace' }}>
            19AAACB1234P1Z5
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            AttendoSchool Technologies Inc.
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
              placeholder="Search by invoice #, receipt #, school name..."
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
              <option value="ALL">All Invoices</option>
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
            </select>
          </div>

          {(search || statusFilter !== 'ALL') && (
            <button
              className="btn-secondary"
              style={{ padding: '8px 14px' }}
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Receipt Ref</th>
                <th>Institution</th>
                <th>Total Invoiced</th>
                <th>GST Rate</th>
                <th>Status</th>
                <th>Issue Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px', width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Loading tax invoices...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No tax invoices found matching your query.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isPaid = inv.status === 'PAID';

                  return (
                    <tr key={inv.id}>
                      <td>
                        <span style={{ fontWeight: '700', color: '#4f46e5', fontFamily: 'monospace' }}>
                          {inv.invoice_number}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                          {inv.receipt_number || 'REC-AUTO'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{inv.school_name}</div>
                        {inv.school_code && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{inv.school_code}</div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: '700', color: '#0f172a' }}>
                          ₹{Number(inv.amount || 0).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                          18% GST
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${isPaid ? 'badge-active' : 'badge-pending'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '11px', color: '#ffffff' }}
                            onClick={() => setSelectedInvoice(inv)}
                            title="View Receipt Breakdown"
                          >
                            Receipt
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '11px', color: '#ffffff' }}
                            onClick={() => handleDownloadPdf(inv)}
                            title="Download PDF"
                          >
                            PDF
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '11px', color: '#ffffff' }}
                            onClick={() => handleOpenEmail(inv)}
                            title="Email to School Admin"
                          >
                            Email
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Receipt Breakdown Viewer */}
      {selectedInvoice && !emailModalOpen && (
        <div className="modal-backdrop" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', background: '#fff' }}>
            <div className="modal-header" style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #0f172a, #334155)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                  A
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    AttendoSchool Technologies Inc.
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    GSTIN: 19AAACB1234P1Z5 · Campus 4, Tech Park Boulevard, Bengaluru
                  </div>
                </div>
              </div>
              <button
                className="close-btn"
                onClick={() => setSelectedInvoice(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ padding: '24px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '600', letterSpacing: '0.05em' }}>
                    Billed To
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                    {selectedInvoice.school_name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    School Code: {selectedInvoice.school_code || 'GWIS-2025'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    GSTIN: Unregistered / Institutional
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#4f46e5' }}>
                    TAX INVOICE
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', fontFamily: 'monospace' }}>
                    {selectedInvoice.invoice_number}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Receipt: {selectedInvoice.receipt_number || 'REC-AUTO'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Date: {new Date(selectedInvoice.issued_at || Date.now()).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600' }}>Item Description</th>
                      <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', textAlign: 'right' }}>Taxable</th>
                      <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', textAlign: 'right' }}>GST (18%)</th>
                      <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>School Attendance SaaS Subscription</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Institutional license, multi-tenant portal & biometric sync</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                        ₹{(Number(selectedInvoice.amount) * 0.84745).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                        ₹{(Number(selectedInvoice.amount) * 0.15255).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>
                        ₹{Number(selectedInvoice.amount).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Taxable Subtotal:</span>
                    <span>₹{(Number(selectedInvoice.amount) * 0.84745).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>CGST (9%):</span>
                    <span>₹{(Number(selectedInvoice.amount) * 0.07627).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>SGST (9%):</span>
                    <span>₹{(Number(selectedInvoice.amount) * 0.07627).toFixed(2)}</span>
                  </div>
                  <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    <span>Grand Total:</span>
                    <span style={{ color: '#10b981' }}>₹{Number(selectedInvoice.amount).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    <span>Payment Status:</span>
                    <span className="badge badge-active">{selectedInvoice.status}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <button
                className="btn-secondary"
                onClick={() => handleOpenEmail(selectedInvoice)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Email Invoice
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn-secondary"
                  onClick={() => setSelectedInvoice(null)}
                >
                  Close
                </button>
                <button
                  className="btn-primary"
                  onClick={() => handleDownloadPdf(selectedInvoice)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Email Invoice */}
      {emailModalOpen && selectedInvoice && (
        <div className="modal-backdrop" onClick={() => !emailSending && setEmailModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                Email Tax Invoice {selectedInvoice.invoice_number}
              </h3>
              <button
                className="close-btn"
                disabled={emailSending}
                onClick={() => setEmailModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 0' }}>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px 0' }}>
                Dispatch the official PDF tax receipt to the institutional administrator or finance desk.
              </p>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                Recipient Email Address *
              </label>
              <input
                type="email"
                required
                className="form-control"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="accounts@school.edu.in"
              />
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={emailSending}
                onClick={() => setEmailModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={emailSending || !emailAddress}
                onClick={handleSendEmail}
              >
                {emailSending ? 'Dispatching...' : 'Send Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
