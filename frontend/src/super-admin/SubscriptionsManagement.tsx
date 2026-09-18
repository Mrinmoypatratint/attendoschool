import React, { useState, useEffect } from 'react';
import { SubscriptionPlan, SchoolRecord } from './types';
import { apiRequest } from '../api';

interface SubscriptionsManagementProps {
  onNavigateSchools?: () => void;
}

export const SubscriptionsManagement: React.FC<SubscriptionsManagementProps> = ({ onNavigateSchools }) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    max_students: 1000,
    price_monthly: 999,
    price_yearly: 9999,
    is_active: true
  });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansData, schoolsData] = await Promise.all([
        apiRequest<SubscriptionPlan[]>('/super-admin/plans').catch(() => [
          { id: 'plan-basic', name: 'Basic Tier', description: 'Essential attendance and student profiles for small schools', max_students: 300, price_monthly: 499, price_yearly: 4999, is_active: true },
          { id: 'plan-standard', name: 'Standard Growth', description: 'Complete SIS with timetable, exams, and parent communications', max_students: 1000, price_monthly: 999, price_yearly: 9999, is_active: true },
          { id: 'plan-enterprise', name: 'Enterprise Elite', description: 'Unlimited scale with biometric integration, audit logs, and 24/7 SLA', max_students: 5000, price_monthly: 1999, price_yearly: 19999, is_active: true }
        ]),
        apiRequest<SchoolRecord[]>('/super-admin/schools').catch(() => [])
      ]);
      setPlans(plansData);
      setSchools(schoolsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription tiers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      description: '',
      max_students: 1000,
      price_monthly: 999,
      price_yearly: 9999,
      is_active: true
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description || '',
      max_students: plan.max_students,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly || plan.price_monthly * 10,
      is_active: plan.is_active
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.name.trim()) {
      setFormError('Tier plan name is required.');
      return;
    }
    if (planForm.price_monthly <= 0) {
      setFormError('Monthly price must be greater than zero.');
      return;
    }
    setSubmitting(true);
    setFormError(null);

    try {
      if (editingPlan) {
        await apiRequest(`/super-admin/plans/${editingPlan.id}`, {
          method: 'PUT',
          body: JSON.stringify(planForm)
        });
      } else {
        await apiRequest('/super-admin/plans', {
          method: 'POST',
          body: JSON.stringify(planForm)
        });
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save subscription tier.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to compute subscribers for a plan
  const getSubscribersCount = (planName: string) => {
    const clean = planName.toLowerCase().replace(/tier|elite|growth|plan/g, '').trim();
    return schools.filter(s => {
      const p = (s.plan_name || '').toLowerCase();
      return p.includes(clean) || clean.includes(p);
    }).length;
  };

  return (
    <div className="super-admin-content-inner">
      {/* Header */}
      <div className="section-header-row">
        <div>
          <h2 className="section-title">Subscription Tiers & Packaging</h2>
          <p className="section-subtitle">
            Configure institutional SaaS tiers, student capacity limits, pricing models, and active tenant distribution.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={loadData} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
          <button className="btn-primary" onClick={openCreateModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Tier Plan
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ margin: '16px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          Loading subscription tiers...
        </div>
      ) : (
        <>
          {/* Plan Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', margin: '24px 0' }}>
            {plans.map((p) => {
              const subCount = getSubscribersCount(p.name);
              const isEnterprise = p.name.toLowerCase().includes('enterprise');
              const isStandard = p.name.toLowerCase().includes('standard');

              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    border: isEnterprise ? '2px solid rgba(99, 102, 241, 0.4)' : undefined,
                    boxShadow: isEnterprise ? '0 10px 25px -5px rgba(99, 102, 241, 0.1)' : undefined
                  }}
                >
                  {isEnterprise && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '-32px',
                      transform: 'rotate(45deg)',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '4px 35px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Popular
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
                        {p.name}
                      </h3>
                      <span className={`badge ${p.is_active ? 'badge-active' : 'badge-suspended'}`}>
                        {p.is_active ? 'Active Tier' : 'Archived'}
                      </span>
                    </div>
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => openEditModal(p)}
                    >
                      Configure
                    </button>
                  </div>

                  <p style={{ fontSize: '13px', color: '#64748b', minHeight: '36px', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                    {p.description || 'Standard institutional service level packaging for verified educational tenants.'}
                  </p>

                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>
                        ₹{Number(p.price_monthly).toLocaleString('en-IN')}
                      </span>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>/ month</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '600', marginTop: '4px' }}>
                      ₹{Number(p.price_yearly || p.price_monthly * 10).toLocaleString('en-IN')} billed annually (Save 17%)
                    </div>
                  </div>

                  {/* Quota & Feature Specs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <strong>Up to {p.max_students.toLocaleString()} students</strong> quota limit
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Realtime Biometric & Mobile QR sync
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Automated SMS & WhatsApp Parent Alerts
                    </div>
                    {isEnterprise && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <strong>Dedicated Account Manager & 99.9% SLA</strong>
                      </div>
                    )}
                  </div>

                  {/* Tenant Adoption Footprint */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Active Institutions: <strong style={{ color: '#0f172a' }}>{subCount}</strong>
                    </div>
                    {onNavigateSchools && (
                      <button
                        className="btn-link"
                        style={{ fontSize: '12px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onClick={onNavigateSchools}
                      >
                        View schools &rarr;
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Subscriptions Breakdown Table */}
          <div className="card" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  Active Tenant Subscription Ledger
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Live quota consumption and license validity per institution.
                </p>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Institution</th>
                    <th>Subscribed Tier</th>
                    <th>Student Limit</th>
                    <th>Current Enrolled</th>
                    <th>Quota Usage</th>
                    <th>Valid Through</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                        No institutions currently registered on any subscription tier.
                      </td>
                    </tr>
                  ) : (
                    schools.map((s) => {
                      const maxSt = s.plan_name?.toLowerCase().includes('enterprise') ? 5000 : s.plan_name?.toLowerCase().includes('standard') ? 1000 : 300;
                      const enrolled = s.student_count || 0;
                      const pct = Math.min(100, Math.round((enrolled / maxSt) * 100));

                      return (
                        <tr key={s.id}>
                          <td>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>{s.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{s.code}</div>
                          </td>
                          <td>
                            <span style={{ fontWeight: '600', color: '#4f46e5' }}>
                              {s.plan_name || 'Standard Growth'}
                            </span>
                          </td>
                          <td>{maxSt.toLocaleString()} students</td>
                          <td>{enrolled.toLocaleString()} students</td>
                          <td style={{ minWidth: '150px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    background: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#10b981',
                                    borderRadius: '3px'
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', width: '32px' }}>
                                {pct}%
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '13px', color: '#334155' }}>
                              {s.end_date ? new Date(s.end_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Ongoing'}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${s.status === 'ACTIVE' ? 'badge-active' : 'badge-suspended'}`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal: Create or Edit Plan */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => !submitting && setModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                {editingPlan ? `Configure Tier: ${editingPlan.name}` : 'Create New Subscription Tier'}
              </h3>
              <button
                className="close-btn"
                disabled={submitting}
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitPlan}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
                {formError && (
                  <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    Tier Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Enterprise Elite, Campus Pro"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    Description & Value Proposition
                  </label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="Describe included modules, SLA, and capacity"
                    value={planForm.description}
                    onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                      Max Student Limit *
                    </label>
                    <input
                      type="number"
                      required
                      min={10}
                      className="form-control"
                      value={planForm.max_students}
                      onChange={(e) => setPlanForm({ ...planForm, max_students: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                      Monthly Price (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      className="form-control"
                      value={planForm.price_monthly}
                      onChange={(e) => setPlanForm({
                        ...planForm,
                        price_monthly: Number(e.target.value),
                        price_yearly: Number(e.target.value) * 10
                      })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                      Annual Price (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="form-control"
                      value={planForm.price_yearly}
                      onChange={(e) => setPlanForm({ ...planForm, price_yearly: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                      Tier Status
                    </label>
                    <select
                      className="form-control"
                      value={planForm.is_active ? 'active' : 'inactive'}
                      onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.value === 'active' })}
                    >
                      <option value="active">Active (Available to new schools)</option>
                      <option value="inactive">Archived / Hidden</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={submitting}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving Tier...' : editingPlan ? 'Update Tier' : 'Create Tier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
