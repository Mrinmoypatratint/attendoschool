import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  School, Plus, Search, Filter, MoreHorizontal, RefreshCw,
  ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Eye, Edit3,
  Calendar, Layers, ChevronLeft, ChevronRight, X, User, Mail,
  Phone, MapPin, Building
} from 'lucide-react';
import { SchoolRecord, SubscriptionPlan } from './types';

interface SchoolsManagementProps {
  initialCreateOpen?: boolean;
}

export function SchoolsManagement({ initialCreateOpen = false }: SchoolsManagementProps) {
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(initialCreateOpen);
  const [viewSchool, setViewSchool] = useState<SchoolRecord | null>(null);
  const [editSchool, setEditSchool] = useState<SchoolRecord | null>(null);
  const [renewSchool, setRenewSchool] = useState<SchoolRecord | null>(null);
  const [suspendSchool, setSuspendSchool] = useState<SchoolRecord | null>(null);

  // Wizard state (5 Steps)
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardBusy, setWizardBusy] = useState(false);
  const [wizardError, setWizardError] = useState('');
  const [newSchool, setNewSchool] = useState({
    name: '',
    code: '',
    enquiryNumber: '9000000000',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: 'ChangeMe123!',
    planId: 'plan-standard',
    days: 365
  });

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    code: '',
    enquiryNumber: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  // Renew state
  const [renewDays, setRenewDays] = useState(30);
  const [renewAmount, setRenewAmount] = useState(999);
  const [renewBusy, setRenewBusy] = useState(false);

  // Feedback Toast message
  const [toastMessage, setToastMessage] = useState('');

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [schoolsRes, plansRes] = await Promise.all([
        api.get('/super-admin/schools'),
        api.get('/super-admin/plans')
      ]);
      if (Array.isArray(schoolsRes.data)) {
        setSchools(schoolsRes.data);
      }
      if (Array.isArray(plansRes.data)) {
        setPlans(plansRes.data);
        if (plansRes.data.length > 0 && !newSchool.planId) {
          setNewSchool(prev => ({ ...prev, planId: plansRes.data[0].id }));
        }
      }
    } catch (e) {
      console.error('Failed to load schools:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filter & Search computation
  const filteredSchools = schools.filter(s => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.admin_email && s.admin_email.toLowerCase().includes(q)) ||
      (s.admin_name && s.admin_name.toLowerCase().includes(q));

    const matchStatus = statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && s.status === 'ACTIVE') ||
      (statusFilter === 'SUSPENDED' && s.status === 'SUSPENDED') ||
      (statusFilter === 'EXPIRED' && (s.status === 'EXPIRED' || (s.end_date && new Date(s.end_date) < new Date())));

    const matchPlan = planFilter === 'ALL' ||
      (s.plan_name && s.plan_name.toUpperCase().includes(planFilter.toUpperCase()));

    return matchSearch && matchStatus && matchPlan;
  });

  const totalPages = Math.max(1, Math.ceil(filteredSchools.length / pageSize));
  const paginatedSchools = filteredSchools.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Multi-step Wizard Submission
  async function handleWizardSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWizardBusy(true);
    setWizardError('');

    try {
      await api.post('/super-admin/schools', newSchool);
      setCreateModalOpen(false);
      setWizardStep(1);
      setNewSchool({
        name: '',
        code: '',
        enquiryNumber: '9000000000',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        adminName: '',
        adminEmail: '',
        adminPhone: '',
        adminPassword: 'ChangeMe123!',
        planId: plans[0]?.id || 'plan-standard',
        days: 365
      });
      showToast('School onboarded and access provisioned successfully!');
      await loadData();
    } catch (err: any) {
      setWizardError(err?.response?.data?.message || 'Could not register school. Please verify your input.');
    } finally {
      setWizardBusy(false);
    }
  }

  // Edit Submission
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editSchool) return;
    try {
      await api.put(`/super-admin/schools/${editSchool.id}`, editFormData);
      setEditSchool(null);
      showToast('School updated successfully.');
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Update failed');
    }
  }

  // Renew Submission
  async function handleRenewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!renewSchool) return;
    setRenewBusy(true);
    try {
      await api.post(`/super-admin/schools/${renewSchool.id}/renew`, {
        days: renewDays,
        amount: renewAmount
      });
      setRenewSchool(null);
      showToast('Subscription license extended successfully.');
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Renewal failed');
    } finally {
      setRenewBusy(false);
    }
  }

  // Suspend / Activate
  async function handleToggleStatus(s: SchoolRecord) {
    const nextStatus = s.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.patch(`/super-admin/schools/${s.id}/status`, { status: nextStatus });
      setSuspendSchool(null);
      showToast(`School marked as ${nextStatus}`);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Status change failed');
    }
  }

  return (
    <div className="sa-module-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="sa-toast">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Module Header */}
      <div className="sa-module-head">
        <div>
          <h2 className="sa-module-title">Schools & Campuses</h2>
          <p className="sa-module-sub">
            Manage enrolled institutions, administrator profiles, licenses, and tenant status.
          </p>
        </div>
        <button
          className="sa-btn-primary"
          onClick={() => {
            setWizardStep(1);
            setWizardError('');
            setCreateModalOpen(true);
          }}
        >
          <Plus size={16} /> <span>Register New School</span>
        </button>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="sa-filter-bar">
        <div className="sa-filter-search-wrap">
          <Search size={16} className="sa-search-bar-icon" />
          <input
            type="text"
            className="sa-filter-search-input"
            placeholder="Search by school name, code, or administrator email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="sa-filter-dropdowns">
          <select
            className="sa-select-input"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="SUSPENDED">Suspended Only</option>
            <option value="EXPIRED">Expired Only</option>
          </select>

          <select
            className="sa-select-input"
            value={planFilter}
            onChange={e => { setPlanFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="ALL">All Plans</option>
            <option value="BASIC">Basic Tier</option>
            <option value="STANDARD">Standard Tier</option>
            <option value="ENTERPRISE">Enterprise Tier</option>
          </select>

          <button
            className="sa-btn-secondary"
            onClick={loadData}
            title="Refresh schools"
          >
            <RefreshCw size={15} /> <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Schools Data Grid */}
      <div className="sa-card sa-table-card">
        <div className="sa-table-responsive">
          <table className="sa-table">
            <thead>
              <tr>
                <th>#</th>
                <th>SCHOOL / CODE</th>
                <th>ADMINISTRATOR</th>
                <th>STUDENTS</th>
                <th>SUBSCRIPTION</th>
                <th>VALIDITY</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="sa-td-empty">Loading schools directory...</td>
                </tr>
              ) : paginatedSchools.length === 0 ? (
                <tr>
                  <td colSpan={8} className="sa-td-empty">
                    {search || statusFilter !== 'ALL' || planFilter !== 'ALL'
                      ? 'No schools match the selected criteria.'
                      : 'No schools registered in the database yet.'}
                  </td>
                </tr>
              ) : (
                paginatedSchools.map((s, idx) => (
                  <tr key={s.id}>
                    <td className="sa-td-num">{(currentPage - 1) * pageSize + idx + 1}</td>
                    <td>
                      <div className="sa-school-cell">
                        <div className="sa-school-avatar">
                          {s.code ? s.code.slice(0, 2) : s.name.slice(0, 2)}
                        </div>
                        <div>
                          <strong className="sa-school-name">{s.name}</strong>
                          <span className="sa-school-code">{s.code} · {s.city || 'Campus'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="sa-admin-cell">
                        <span className="sa-admin-name">{s.admin_name || s.admin_email?.split('@')[0] || 'Administrator'}</span>
                        <span className="sa-admin-email">{s.admin_email || s.email || '—'}</span>
                      </div>
                    </td>
                    <td className="sa-td-num">{(s.student_count || 0).toLocaleString('en-IN')}</td>
                    <td>
                      <span className="sa-plan-tag">{s.plan_name || 'Standard'}</span>
                    </td>
                    <td className="sa-td-validity">
                      {s.end_date ? new Date(s.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Lifetime'}
                    </td>
                    <td>
                      <span
                        className={`sa-status-pill ${
                          (s.status || '').toLowerCase().includes('active')
                            ? 'active'
                            : (s.status || '').toLowerCase().includes('soon')
                            ? 'expiring'
                            : 'expired'
                        }`}
                      >
                        {s.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', position: 'relative' }}>
                      <button
                        className="sa-more-btn"
                        title="Actions"
                        onClick={() => setActiveMenuId(activeMenuId === s.id ? null : s.id)}
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {activeMenuId === s.id && (
                        <div className="sa-action-dropdown">
                          <button
                            onClick={() => {
                              setViewSchool(s);
                              setActiveMenuId(null);
                            }}
                          >
                            <Eye size={13} /> <span>View Dossier</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditSchool(s);
                              setEditFormData({
                                name: s.name,
                                code: s.code,
                                enquiryNumber: s.enquiry_number || '',
                                phone: s.phone || '',
                                email: s.email || '',
                                address: s.address || '',
                                city: s.city || '',
                                state: s.state || '',
                                pincode: s.pincode || ''
                              });
                              setActiveMenuId(null);
                            }}
                          >
                            <Edit3 size={13} /> <span>Edit School</span>
                          </button>
                          <button
                            onClick={() => {
                              setRenewSchool(s);
                              setActiveMenuId(null);
                            }}
                          >
                            <RefreshCw size={13} /> <span>Renew License</span>
                          </button>
                          <button
                            onClick={() => {
                              setSuspendSchool(s);
                              setActiveMenuId(null);
                            }}
                            className="danger-text"
                          >
                            <ShieldAlert size={13} />
                            <span>{s.status === 'ACTIVE' ? 'Suspend School' : 'Activate School'}</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="sa-pagination-bar">
            <span className="sa-pagination-info">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredSchools.length)} of {filteredSchools.length} schools
            </span>
            <div className="sa-pagination-controls">
              <button
                className="sa-btn-secondary sa-btn-small"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> <span>Previous</span>
              </button>
              <span className="sa-page-indicator">Page {currentPage} of {totalPages}</span>
              <button
                className="sa-btn-secondary sa-btn-small"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                <span>Next</span> <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── MULTI-STEP SCHOOL ONBOARDING WIZARD MODAL ─── */}
      {createModalOpen && (
        <div className="sa-modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div className="sa-wizard-modal-box" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div>
                <h3>Register & Onboard New School</h3>
                <span className="sa-modal-subtitle">Step {wizardStep} of 4: {
                  wizardStep === 1 ? 'Institute Information' :
                  wizardStep === 2 ? 'Administrator Credentials' :
                  wizardStep === 3 ? 'Subscription Plan' : 'Summary & Review'
                }</span>
              </div>
              <button className="sa-modal-close" onClick={() => setCreateModalOpen(false)}>×</button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="sa-wizard-stepper">
              {[
                { num: 1, label: 'Institute' },
                { num: 2, label: 'Administrator' },
                { num: 3, label: 'Subscription' },
                { num: 4, label: 'Review' }
              ].map(st => (
                <div
                  key={st.num}
                  className={`sa-step-indicator ${wizardStep === st.num ? 'current' : wizardStep > st.num ? 'completed' : ''}`}
                  onClick={() => {
                    if (wizardStep > st.num) setWizardStep(st.num);
                  }}
                >
                  <div className="sa-step-circle">{st.num}</div>
                  <span className="sa-step-label">{st.label}</span>
                </div>
              ))}
            </div>

            {wizardError && (
              <div className="sa-error-banner">
                <AlertTriangle size={16} />
                <span>{wizardError}</span>
              </div>
            )}

            <form onSubmit={handleWizardSubmit} className="sa-wizard-form">
              {/* STEP 1: Institute Information */}
              {wizardStep === 1 && (
                <div className="sa-wizard-step-content">
                  <div className="form-row">
                    <div className="form-group">
                      <label>School / Institute Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. St. Xavier International Academy"
                        value={newSchool.name}
                        onChange={e => setNewSchool({ ...newSchool, name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>School Code *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SXIA-2026"
                        value={newSchool.code}
                        onChange={e => setNewSchool({ ...newSchool, code: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Enquiry Phone Helpline</label>
                      <input
                        type="text"
                        placeholder="+91 98000 00000"
                        value={newSchool.enquiryNumber}
                        onChange={e => setNewSchool({ ...newSchool, enquiryNumber: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Institute Official Email</label>
                      <input
                        type="email"
                        placeholder="contact@stxavier.edu.in"
                        value={newSchool.email}
                        onChange={e => setNewSchool({ ...newSchool, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Campus Physical Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 124 Knowledge Corridor, Sector 4"
                      value={newSchool.address}
                      onChange={e => setNewSchool({ ...newSchool, address: e.target.value })}
                    />
                  </div>

                  <div className="form-row-three">
                    <div className="form-group">
                      <label>City</label>
                      <input
                        type="text"
                        placeholder="Bengaluru"
                        value={newSchool.city}
                        onChange={e => setNewSchool({ ...newSchool, city: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <input
                        type="text"
                        placeholder="Karnataka"
                        value={newSchool.state}
                        onChange={e => setNewSchool({ ...newSchool, state: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Pincode</label>
                      <input
                        type="text"
                        placeholder="560001"
                        value={newSchool.pincode}
                        onChange={e => setNewSchool({ ...newSchool, pincode: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="sa-wizard-nav">
                    <div />
                    <button
                      type="button"
                      className="sa-btn-primary"
                      disabled={!newSchool.name.trim() || !newSchool.code.trim()}
                      onClick={() => setWizardStep(2)}
                    >
                      <span>Proceed to Administrator</span> <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Administrator */}
              {wizardStep === 2 && (
                <div className="sa-wizard-step-content">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Principal / Admin Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Dr. Rajeshwari Sengupta"
                        value={newSchool.adminName}
                        onChange={e => setNewSchool({ ...newSchool, adminName: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Admin Login Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="admin@school.com"
                        value={newSchool.adminEmail}
                        onChange={e => setNewSchool({ ...newSchool, adminEmail: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Admin Phone Number</label>
                      <input
                        type="text"
                        placeholder="+91 98765 43210"
                        value={newSchool.adminPhone}
                        onChange={e => setNewSchool({ ...newSchool, adminPhone: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Initial Login Password *</label>
                      <input
                        type="password"
                        required
                        value={newSchool.adminPassword}
                        onChange={e => setNewSchool({ ...newSchool, adminPassword: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="sa-info-callout">
                    <User size={16} />
                    <span>This user will be provisioned as the tenant <strong>SCHOOL_ADMIN</strong> with complete authority over timetable, classes, students, and attendance.</span>
                  </div>

                  <div className="sa-wizard-nav">
                    <button
                      type="button"
                      className="sa-btn-secondary"
                      onClick={() => setWizardStep(1)}
                    >
                      <ChevronLeft size={15} /> <span>Back</span>
                    </button>
                    <button
                      type="button"
                      className="sa-btn-primary"
                      disabled={!newSchool.adminName.trim() || !newSchool.adminEmail.trim()}
                      onClick={() => setWizardStep(3)}
                    >
                      <span>Proceed to Subscription</span> <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Subscription Tier */}
              {wizardStep === 3 && (
                <div className="sa-wizard-step-content">
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: 12 }}>Select Subscription Plan *</label>
                  <div className="sa-tier-selection-grid">
                    {[
                      { id: 'plan-basic', name: 'Basic', price: 499, limit: 'Up to 300 students', desc: 'Preschools & small learning academies' },
                      { id: 'plan-standard', name: 'Standard', price: 999, limit: 'Up to 1,000 students', desc: 'Standard secondary & higher secondary schools' },
                      { id: 'plan-enterprise', name: 'Enterprise', price: 1999, limit: 'Up to 5,000 students', desc: 'Comprehensive institutions with multiple branches' }
                    ].map(tier => (
                      <div
                        key={tier.id}
                        className={`sa-tier-card ${newSchool.planId === tier.id ? 'selected' : ''}`}
                        onClick={() => setNewSchool({ ...newSchool, planId: tier.id })}
                      >
                        <div className="sa-tier-radio">
                          <input
                            type="radio"
                            name="planId"
                            checked={newSchool.planId === tier.id}
                            onChange={() => setNewSchool({ ...newSchool, planId: tier.id })}
                          />
                        </div>
                        <strong className="sa-tier-name">{tier.name}</strong>
                        <div className="sa-tier-price">₹{tier.price} <span style={{ fontSize: 13, fontWeight: 400 }}>/mo</span></div>
                        <span className="sa-tier-limit">{tier.limit}</span>
                        <p className="sa-tier-desc">{tier.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="form-group" style={{ marginTop: 16 }}>
                    <label>Initial Subscription Validity (Days)</label>
                    <input
                      type="number"
                      min="30"
                      value={newSchool.days}
                      onChange={e => setNewSchool({ ...newSchool, days: Number(e.target.value) })}
                    />
                  </div>

                  <div className="sa-wizard-nav">
                    <button
                      type="button"
                      className="sa-btn-secondary"
                      onClick={() => setWizardStep(2)}
                    >
                      <ChevronLeft size={15} /> <span>Back</span>
                    </button>
                    <button
                      type="button"
                      className="sa-btn-primary"
                      onClick={() => setWizardStep(4)}
                    >
                      <span>Review Details</span> <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: Review Summary */}
              {wizardStep === 4 && (
                <div className="sa-wizard-step-content">
                  <div className="sa-review-box">
                    <h4>Onboarding Summary</h4>
                    <div className="sa-review-grid">
                      <div className="sa-review-item">
                        <span className="sa-review-label">Institute Name:</span>
                        <strong>{newSchool.name}</strong>
                      </div>
                      <div className="sa-review-item">
                        <span className="sa-review-label">School Code:</span>
                        <strong>{newSchool.code}</strong>
                      </div>
                      <div className="sa-review-item">
                        <span className="sa-review-label">Administrator:</span>
                        <strong>{newSchool.adminName} ({newSchool.adminEmail})</strong>
                      </div>
                      <div className="sa-review-item">
                        <span className="sa-review-label">Selected Plan:</span>
                        <strong>{newSchool.planId.replace('plan-', '').toUpperCase()} (365 Days)</strong>
                      </div>
                      <div className="sa-review-item">
                        <span className="sa-review-label">Location:</span>
                        <span>{newSchool.city ? `${newSchool.city}, ${newSchool.state}` : 'Default Campus'}</span>
                      </div>
                      <div className="sa-review-item">
                        <span className="sa-review-label">Initial Status:</span>
                        <span className="sa-badge-pill success">ACTIVE</span>
                      </div>
                    </div>
                  </div>

                  <div className="sa-wizard-nav">
                    <button
                      type="button"
                      className="sa-btn-secondary"
                      disabled={wizardBusy}
                      onClick={() => setWizardStep(3)}
                    >
                      <ChevronLeft size={15} /> <span>Back</span>
                    </button>
                    <button
                      type="submit"
                      className="sa-btn-primary"
                      disabled={wizardBusy}
                    >
                      {wizardBusy ? 'Provisioning School...' : 'Provision School & Access'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: View School Dossier ─── */}
      {viewSchool && (
        <div className="sa-modal-backdrop" onClick={() => setViewSchool(null)}>
          <div className="sa-modal-box" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h3>School Dossier — {viewSchool.name}</h3>
              <button className="sa-modal-close" onClick={() => setViewSchool(null)}>×</button>
            </div>
            <div className="sa-dossier-content">
              <div className="sa-dossier-grid">
                <div>
                  <span className="sa-review-label">Code:</span>
                  <strong>{viewSchool.code}</strong>
                </div>
                <div>
                  <span className="sa-review-label">Status:</span>
                  <span className={`sa-status-pill ${(viewSchool.status || '').toLowerCase()}`}>{viewSchool.status}</span>
                </div>
                <div>
                  <span className="sa-review-label">Administrator:</span>
                  <strong>{viewSchool.admin_name || viewSchool.admin_email || '—'}</strong>
                </div>
                <div>
                  <span className="sa-review-label">Admin Email:</span>
                  <span>{viewSchool.admin_email || viewSchool.email || '—'}</span>
                </div>
                <div>
                  <span className="sa-review-label">Enrolled Students:</span>
                  <strong>{(viewSchool.student_count || 0).toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span className="sa-review-label">Subscription Plan:</span>
                  <span className="sa-plan-tag">{viewSchool.plan_name || 'Standard'}</span>
                </div>
                <div>
                  <span className="sa-review-label">Valid Until:</span>
                  <strong>{viewSchool.end_date ? new Date(viewSchool.end_date).toLocaleDateString() : 'Active'}</strong>
                </div>
                <div>
                  <span className="sa-review-label">Enquiry Helpline:</span>
                  <span>{viewSchool.enquiry_number || viewSchool.phone || '—'}</span>
                </div>
              </div>
            </div>
            <div className="sa-modal-actions">
              <button className="sa-btn-secondary" onClick={() => setViewSchool(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Edit School ─── */}
      {editSchool && (
        <div className="sa-modal-backdrop" onClick={() => setEditSchool(null)}>
          <div className="sa-modal-box" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h3>Edit School Information</h3>
              <button className="sa-modal-close" onClick={() => setEditSchool(null)}>×</button>
            </div>
            <form onSubmit={handleEditSubmit} className="sa-modal-form">
              <div className="form-group">
                <label>School Name *</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Code *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.code}
                    onChange={e => setEditFormData({ ...editFormData, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group">
                  <label>Enquiry Phone</label>
                  <input
                    type="text"
                    value={editFormData.enquiryNumber}
                    onChange={e => setEditFormData({ ...editFormData, enquiryNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  value={editFormData.address}
                  onChange={e => setEditFormData({ ...editFormData, address: e.target.value })}
                />
              </div>
              <div className="sa-modal-actions">
                <button type="button" className="sa-btn-secondary" onClick={() => setEditSchool(null)}>Cancel</button>
                <button type="submit" className="sa-btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Renew Subscription ─── */}
      {renewSchool && (
        <div className="sa-modal-backdrop" onClick={() => setRenewSchool(null)}>
          <div className="sa-modal-box" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h3>Extend Subscription — {renewSchool.name}</h3>
              <button className="sa-modal-close" onClick={() => setRenewSchool(null)}>×</button>
            </div>
            <form onSubmit={handleRenewSubmit} className="sa-modal-form">
              <div className="form-group">
                <label>Renewal Period (Days) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={renewDays}
                  onChange={e => setRenewDays(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Settlement Amount (₹ INR) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={renewAmount}
                  onChange={e => setRenewAmount(Number(e.target.value))}
                />
              </div>
              <div className="sa-modal-actions">
                <button type="button" className="sa-btn-secondary" onClick={() => setRenewSchool(null)}>Cancel</button>
                <button type="submit" className="sa-btn-primary" disabled={renewBusy}>
                  {renewBusy ? 'Renewing...' : 'Confirm License Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Suspend / Activate Confirmation ─── */}
      {suspendSchool && (
        <div className="sa-modal-backdrop" onClick={() => setSuspendSchool(null)}>
          <div className="sa-modal-box" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h3>{suspendSchool.status === 'ACTIVE' ? 'Suspend School Access?' : 'Reactivate School?'}</h3>
              <button className="sa-modal-close" onClick={() => setSuspendSchool(null)}>×</button>
            </div>
            <div style={{ padding: '16px 0' }}>
              <p>
                {suspendSchool.status === 'ACTIVE'
                  ? `Are you sure you want to suspend access for ${suspendSchool.name}? All teachers, admins, and students will be prevented from signing in until reactivated.`
                  : `Are you sure you want to reactivate access for ${suspendSchool.name}? Users belonging to this school will be permitted to log in.`}
              </p>
            </div>
            <div className="sa-modal-actions">
              <button className="sa-btn-secondary" onClick={() => setSuspendSchool(null)}>Cancel</button>
              <button
                className={suspendSchool.status === 'ACTIVE' ? 'sa-btn-danger' : 'sa-btn-primary'}
                onClick={() => handleToggleStatus(suspendSchool)}
              >
                {suspendSchool.status === 'ACTIVE' ? 'Suspend School Access' : 'Reactivate School'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
