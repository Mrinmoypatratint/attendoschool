import React, { useState, useEffect, useMemo } from 'react';
import { InvoiceRecord } from './types';
import { apiRequest, API_BASE_URL } from '../api';
import {
  FileText, Download, Mail, Pencil, Printer, X,
  CheckCircle2, RefreshCw, AlertCircle, Sparkles, Building2
} from 'lucide-react';

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
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  // Edit Invoice states
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editSaving, setEditSaving] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<{
    id: string;
    invoice_number: string;
    receipt_number: string;
    school_name: string;
    school_code: string;
    amount: number;
    gst_rate: number;
    status: string;
    issued_at: string;
    paid_at: string;
    billing_address: string;
  }>({
    id: '',
    invoice_number: '',
    receipt_number: '',
    school_name: '',
    school_code: '',
    amount: 0,
    gst_rate: 18,
    status: 'PAID',
    issued_at: '',
    paid_at: '',
    billing_address: ''
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<InvoiceRecord[]>('/invoices').catch(() => []);
      setInvoices(data || []);
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
    setDownloadingPdf(true);
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
      showToast(`Official Tax Invoice ${invoice.invoice_number}.pdf downloaded successfully.`);
    } catch {
      // Fallback: Trigger print preview of the receipt view
      setSelectedInvoice(invoice);
      showToast('Opening institutional tax receipt preview...');
      setTimeout(() => window.print(), 500);
    } finally {
      setDownloadingPdf(false);
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

  const handleOpenEdit = (invoice: InvoiceRecord) => {
    setEditForm({
      id: invoice.id,
      invoice_number: invoice.invoice_number || '',
      receipt_number: invoice.receipt_number || '',
      school_name: invoice.school_name || '',
      school_code: invoice.school_code || '',
      amount: Number(invoice.amount) || 0,
      gst_rate: Number(invoice.gst_rate) || 18,
      status: invoice.status || 'PAID',
      issued_at: invoice.issued_at ? invoice.issued_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      paid_at: invoice.paid_at ? invoice.paid_at.slice(0, 10) : '',
      billing_address: invoice.billing_address || ''
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.school_name.trim()) {
      alert('Institution Name is required');
      return;
    }
    setEditSaving(true);
    try {
      const res: any = await apiRequest(`/invoices/${editForm.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      const updatedInvoice: InvoiceRecord = res?.invoice || {
        ...selectedInvoice,
        ...editForm,
        taxable_amount: Math.round(Number(editForm.amount) * (100 / (100 + Number(editForm.gst_rate))) * 100) / 100,
        gst_amount: Math.round(Number(editForm.amount) * (Number(editForm.gst_rate) / (100 + Number(editForm.gst_rate))) * 100) / 100
      };

      setInvoices(prev => prev.map(inv => inv.id === editForm.id ? { ...inv, ...updatedInvoice } : inv));
      if (selectedInvoice && selectedInvoice.id === editForm.id) {
        setSelectedInvoice({ ...selectedInvoice, ...updatedInvoice });
      }
      setEditModalOpen(false);
      showToast(`Tax invoice ${editForm.invoice_number} updated successfully.`);
    } catch (err: any) {
      alert(err.message || 'Failed to update invoice.');
    } finally {
      setEditSaving(false);
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
            Generate, audit, customize, download, and dispatch official GST-compliant institutional tax invoices.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="sa-btn-secondary" onClick={loadInvoices} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div style={{ margin: '14px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {error && (
        <div className="error-banner" style={{ margin: '16px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <AlertCircle size={16} style={{ display: 'inline', marginRight: '6px' }} />
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
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#2563eb', marginTop: '6px' }}>
            ₹{totalGst.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
            CGST (9%) + SGST (9%)
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Settled Tax Invoices
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
          <div style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '8px', fontFamily: 'monospace' }}>
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
              className="sa-btn-secondary"
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
                    <div className="spinner" style={{ margin: '0 auto 12px', width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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
                        <span style={{ fontWeight: '700', color: '#2563eb', fontFamily: 'monospace' }}>
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
                          {inv.gst_rate || 18}% GST
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
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            className="sa-btn-secondary"
                            style={{ padding: '6px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => setSelectedInvoice(inv)}
                            title="View Official Receipt & Actions"
                          >
                            <FileText size={14} />
                            <span>Receipt</span>
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

      {/* Modal: Receipt Breakdown Viewer with Company Logo & Actions */}
      {selectedInvoice && !emailModalOpen && !editModalOpen && (
        <div className="modal-backdrop" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px', background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Top Brand Accent Bar */}
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #1e40af, #3b82f6)' }} />

            <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <img
                  src="/attendo-school-logo.png"
                  alt="AttendoSchool"
                  style={{ height: '36px', maxWidth: '120px', objectFit: 'contain' }}
                  onError={(e) => {
                    // Fallback to text badge if image fails
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    AttendoSchool Technologies Inc.
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    GSTIN: 19AAACB1234P1Z5 · Campus 4, Tech Park Boulevard, Bengaluru
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={`badge ${selectedInvoice.status === 'PAID' ? 'badge-active' : 'badge-pending'}`}>
                  {selectedInvoice.status}
                </span>
                <button
                  className="close-btn"
                  onClick={() => setSelectedInvoice(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#64748b' }}
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ padding: '24px', maxHeight: '72vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', gap: '20px' }}>
                <div style={{ flex: 1, background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#1e40af', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    Billed To (Institution)
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                    {selectedInvoice.school_name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    School Code: {selectedInvoice.school_code || 'GWIS-2025'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Address: {selectedInvoice.billing_address || 'Main Campus Boulevard, India'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    GSTIN: {selectedInvoice.gstin || 'Institutional / Unregistered'}
                  </div>
                </div>

                <div style={{ flex: 1, background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#1e40af', letterSpacing: '0.05em' }}>
                    TAX INVOICE & RECEIPT
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', fontFamily: 'monospace', marginTop: '2px' }}>
                    {selectedInvoice.invoice_number}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Receipt Ref: {selectedInvoice.receipt_number || 'REC-AUTO'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Date: {new Date(selectedInvoice.issued_at || Date.now()).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '600', marginTop: '2px' }}>
                    Payment Mode: {selectedInvoice.provider || 'Razorpay Gateway'}
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px', color: '#334155', fontWeight: '700' }}>Item Description</th>
                      <th style={{ padding: '10px 14px', color: '#334155', fontWeight: '700', textAlign: 'center' }}>SAC</th>
                      <th style={{ padding: '10px 14px', color: '#334155', fontWeight: '700', textAlign: 'right' }}>Taxable</th>
                      <th style={{ padding: '10px 14px', color: '#334155', fontWeight: '700', textAlign: 'right' }}>GST ({selectedInvoice.gst_rate || 18}%)</th>
                      <th style={{ padding: '10px 14px', color: '#334155', fontWeight: '700', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>School Attendance SaaS Subscription</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Institutional license, multi-tenant portal, biometric sync & parent alerts</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                        998313
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                        ₹{(Number(selectedInvoice.amount) * (100 / (100 + (Number(selectedInvoice.gst_rate) || 18)))).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                        ₹{(Number(selectedInvoice.amount) * ((Number(selectedInvoice.gst_rate) || 18) / (100 + (Number(selectedInvoice.gst_rate) || 18)))).toFixed(2)}
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
                <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Taxable Subtotal:</span>
                    <span>₹{(Number(selectedInvoice.amount) * (100 / (100 + (Number(selectedInvoice.gst_rate) || 18)))).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>CGST (9%):</span>
                    <span>₹{(Number(selectedInvoice.amount) * (0.09 / 1.18)).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>SGST (9%):</span>
                    <span>₹{(Number(selectedInvoice.amount) * (0.09 / 1.18)).toFixed(2)}</span>
                  </div>
                  <div style={{ borderTop: '2px solid #cbd5e1', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    <span>Grand Total:</span>
                    <span style={{ color: '#10b981' }}>₹{Number(selectedInvoice.amount).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    <span>Payment Status:</span>
                    <span className={`badge ${selectedInvoice.status === 'PAID' ? 'badge-active' : 'badge-pending'}`}>{selectedInvoice.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer with all functions */}
            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="sa-btn-secondary"
                  onClick={() => handleOpenEmail(selectedInvoice)}
                  title="Dispatch invoice by Email"
                >
                  <Mail size={14} />
                  <span>Email Invoice</span>
                </button>
                <button
                  type="button"
                  className="sa-btn-secondary"
                  onClick={() => handleOpenEdit(selectedInvoice)}
                  title="Edit invoice details"
                >
                  <Pencil size={14} />
                  <span>Edit Invoice</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="sa-btn-secondary"
                  onClick={() => window.print()}
                  title="Print receipt preview"
                >
                  <Printer size={14} />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={downloadingPdf}
                  onClick={() => handleDownloadPdf(selectedInvoice)}
                  title="Download professional PDF with company logo"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={14} />
                  <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Invoice Option */}
      {editModalOpen && (
        <div className="modal-backdrop" onClick={() => !editSaving && setEditModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', background: '#fff', borderRadius: '12px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'grid', placeItems: 'center', color: '#2563eb' }}>
                  <Pencil size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    Edit Tax Invoice & Receipt
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Update institutional invoice metadata, tax calculations, and status
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="close-btn"
                disabled={editSaving}
                onClick={() => setEditModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Invoice Number *
                    </label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      value={editForm.invoice_number}
                      onChange={(e) => setEditForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                      placeholder="INV-2025-001"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Receipt Reference
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.receipt_number}
                      onChange={(e) => setEditForm(prev => ({ ...prev, receipt_number: e.target.value }))}
                      placeholder="REC-2025-001"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Institution / School Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      value={editForm.school_name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, school_name: e.target.value }))}
                      placeholder="Greenwood International School"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      School Code
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.school_code}
                      onChange={(e) => setEditForm(prev => ({ ...prev, school_code: e.target.value }))}
                      placeholder="GWIS-2025"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Total Invoiced (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      className="form-control"
                      value={editForm.amount}
                      onChange={(e) => setEditForm(prev => ({ ...prev, amount: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      GST Rate (%)
                    </label>
                    <select
                      className="form-control"
                      value={editForm.gst_rate}
                      onChange={(e) => setEditForm(prev => ({ ...prev, gst_rate: Number(e.target.value) || 18 }))}
                    >
                      <option value={18}>18% GST (Standard)</option>
                      <option value={12}>12% GST</option>
                      <option value={5}>5% GST</option>
                      <option value={0}>0% (Tax Exempt)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Payment Status
                    </label>
                    <select
                      className="form-control"
                      value={editForm.status}
                      onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="PAID">PAID</option>
                      <option value="PENDING">PENDING</option>
                      <option value="OVERDUE">OVERDUE</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Issue Date
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={editForm.issued_at}
                      onChange={(e) => setEditForm(prev => ({ ...prev, issued_at: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Paid / Settlement Date
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={editForm.paid_at}
                      onChange={(e) => setEditForm(prev => ({ ...prev, paid_at: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Billing Campus Address
                  </label>
                  <textarea
                    rows={2}
                    className="form-control"
                    value={editForm.billing_address}
                    onChange={(e) => setEditForm(prev => ({ ...prev, billing_address: e.target.value }))}
                    placeholder="Enter campus physical or registered billing address..."
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#fafafa' }}>
                <button
                  type="button"
                  className="sa-btn-secondary"
                  disabled={editSaving}
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={editSaving}
                >
                  {editSaving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Email Invoice */}
      {emailModalOpen && selectedInvoice && (
        <div className="modal-backdrop" onClick={() => !emailSending && setEmailModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px', background: '#fff', borderRadius: '12px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={18} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  Email Tax Invoice {selectedInvoice.invoice_number}
                </h3>
              </div>
              <button
                className="close-btn"
                disabled={emailSending}
                onClick={() => setEmailModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
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

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#fafafa' }}>
              <button
                type="button"
                className="sa-btn-secondary"
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
