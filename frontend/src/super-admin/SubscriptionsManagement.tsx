import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, CheckCircle2, Sliders, Plus, RefreshCw,
  TrendingUp, Users, Building2, ExternalLink, X,
  ShieldCheck, Sparkles, Search
} from 'lucide-react';
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

  // Billing cycle view toggle
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Ledger filter & search
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerPlanFilter, setLedgerPlanFilter] = useState<string>('ALL');

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    max_students: 1000,
    price_monthly: 999,
    price_yearly: 999 * 12,
    discount_percentage: 0,
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
          { id: 'plan-basic', name: 'Basic Tier', description: 'Essential attendance and student profiles for small educational institutions.', max_students: 300, price_monthly: 499, price_yearly: 499 * 12, is_active: true },
          { id: 'plan-standard', name: 'Standard Growth', description: 'Complete student information system with timetables, exams, and parent communications.', max_students: 1000, price_monthly: 999, price_yearly: 999 * 12, is_active: true },
          { id: 'plan-enterprise', name: 'Enterprise Elite', description: 'Institutional scale with automated biometric sync, audit logging, and 24/7 priority SLA.', max_students: 5000, price_monthly: 1999, price_yearly: 1999 * 12, is_active: true }
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

  // Helper to compute subscribers for a plan
  const getSubscribersCount = (planName: string) => {
    const clean = planName.toLowerCase().replace(/tier|elite|growth|plan/g, '').trim();
    return schools.filter(s => {
      const p = (s.plan_name || '').toLowerCase();
      return p.includes(clean) || clean.includes(p);
    }).length;
  };

  // Telemetry metric calculations
  const telemetry = useMemo(() => {
    const activePlansCount = plans.filter(p => p.is_active).length;
    const enrolledSchoolsCount = schools.length;

    // Aggregate student capacity
    const totalStudentCapacity = schools.reduce((acc, s) => {
      const pName = (s.plan_name || '').toLowerCase();
      if (pName.includes('enterprise')) return acc + 5000;
      if (pName.includes('standard')) return acc + 1000;
      return acc + 300;
    }, 0);

    // Estimated MRR
    const estimatedMRR = schools.reduce((acc, s) => {
      const pName = (s.plan_name || '').toLowerCase();
      const matched = plans.find(p => {
        const clean = p.name.toLowerCase().replace(/tier|elite|growth|plan/g, '').trim();
        return pName.includes(clean) || clean.includes(pName);
      });
      return acc + (matched ? Number(matched.price_monthly || 0) : 999);
    }, 0);

    return {
      activePlansCount,
      enrolledSchoolsCount,
      totalStudentCapacity,
      estimatedMRR
    };
  }, [plans, schools]);

  // Filtered schools for the ledger
  const filteredSchools = useMemo(() => {
    return schools.filter(s => {
      const q = ledgerSearch.toLowerCase().trim();
      const matchesSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.city && s.city.toLowerCase().includes(q));

      const matchesPlan = ledgerPlanFilter === 'ALL' ||
        (s.plan_name && s.plan_name.toUpperCase().includes(ledgerPlanFilter.toUpperCase()));

      return matchesSearch && matchesPlan;
    });
  }, [schools, ledgerSearch, ledgerPlanFilter]);

  const openCreateModal = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      description: '',
      max_students: 1000,
      price_monthly: 999,
      price_yearly: 999 * 12,
      discount_percentage: 0,
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
      price_yearly: plan.price_yearly || plan.price_monthly * 12,
      discount_percentage: plan.discount_percentage || 0,
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

  return (
    <div className="sa-subs-view">
      {/* Module Header */}
      <div className="sa-module-head">
        <div>
          <h1 className="sa-module-title">Subscription Tiers & Packaging</h1>
          <p className="sa-module-sub">
            Configure institutional SaaS tiers, student capacity limits, pricing models, and active tenant distribution.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="sa-btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
          <button className="sa-btn-primary" onClick={openCreateModal}>
            <Plus size={16} />
            <span>New Tier Plan</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="sa-error-banner">
          {error}
        </div>
      )}

      {/* 4-KPI Telemetry Strip */}
      <div className="sa-subs-kpi-grid">
        <div className="sa-subs-kpi-card">
          <div className="sa-subs-kpi-top">
            <span className="sa-subs-kpi-label">Active Tiers</span>
            <div className="sa-subs-kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Layers size={18} />
            </div>
          </div>
          <div className="sa-subs-kpi-val">{loading ? '…' : telemetry.activePlansCount}</div>
          <span className="sa-subs-kpi-sub">Commercial SaaS plans</span>
        </div>

        <div className="sa-subs-kpi-card">
          <div className="sa-subs-kpi-top">
            <span className="sa-subs-kpi-label">Subscribed Campuses</span>
            <div className="sa-subs-kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#16a34a' }}>
              <Building2 size={18} />
            </div>
          </div>
          <div className="sa-subs-kpi-val">{loading ? '…' : telemetry.enrolledSchoolsCount}</div>
          <span className="sa-subs-kpi-sub">Active institutional tenants</span>
        </div>

        <div className="sa-subs-kpi-card">
          <div className="sa-subs-kpi-top">
            <span className="sa-subs-kpi-label">Total Student Quota</span>
            <div className="sa-subs-kpi-icon-wrap" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <Users size={18} />
            </div>
          </div>
          <div className="sa-subs-kpi-val">{loading ? '…' : telemetry.totalStudentCapacity.toLocaleString()}</div>
          <span className="sa-subs-kpi-sub">Aggregate enrolled capacity</span>
        </div>

        <div className="sa-subs-kpi-card">
          <div className="sa-subs-kpi-top">
            <span className="sa-subs-kpi-label">Estimated MRR</span>
            <div className="sa-subs-kpi-icon-wrap" style={{ background: '#f0fdf4', color: '#15803d' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="sa-subs-kpi-val">{loading ? '…' : `₹${telemetry.estimatedMRR.toLocaleString('en-IN')}`}</div>
          <span className="sa-subs-kpi-sub">Monthly subscription run rate</span>
        </div>
      </div>

      {/* Pricing Header & Billing Switcher */}
      <div className="sa-billing-switch-container">
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
            Commercial Tier Packages
          </h2>
          <span style={{ fontSize: '12.5px', color: '#64748b' }}>
            Multi-tenant license quotas and feature matrix
          </span>
        </div>

        <div className="sa-billing-switch-wrap">
          <button
            type="button"
            className={`sa-billing-switch-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            className={`sa-billing-switch-btn ${billingCycle === 'yearly' ? 'active' : ''}`}
            onClick={() => setBillingCycle('yearly')}
          >
            Annual Billing
            <span className="sa-billing-save-pill">Save 17%</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
          <div className="spinning" style={{ margin: '0 auto 16px', width: '32px', height: '32px', border: '3px solid #cbd5e1', borderTopColor: '#2563eb', borderRadius: '50%' }} />
          Loading subscription tiers...
        </div>
      ) : (
        <>
          {/* Plan Cards Grid */}
          <div className="sa-plans-grid">
            {plans.map((p) => {
              const subCount = getSubscribersCount(p.name);
              const isEnterprise = p.name.toLowerCase().includes('enterprise');

              const displayPrice = billingCycle === 'yearly'
                ? Math.round((p.price_yearly || p.price_monthly * 12) / 12)
                : p.price_monthly;

              const totalAnnual = p.price_yearly || p.price_monthly * 12;

              return (
                <div
                  key={p.id}
                  className={`sa-plan-card ${isEnterprise ? 'featured' : ''}`}
                >
                  {isEnterprise && (
                    <div className="sa-plan-featured-tag">
                      <Sparkles size={13} />
                      <span>Enterprise Recommended</span>
                    </div>
                  )}

                  <div className="sa-plan-header">
                    <div className="sa-plan-title-group">
                      <h3 className="sa-plan-title">{p.name}</h3>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className={`sa-badge-pill ${p.is_active ? 'success' : 'warning'}`}>
                          {p.is_active ? 'Active Tier' : 'Archived'}
                        </span>
                        {p.discount_percentage && p.discount_percentage > 0 ? (
                          <span className="sa-badge-pill" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 'bold' }}>
                            {p.discount_percentage}% OFF
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <button
                      className="sa-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => openEditModal(p)}
                      title="Configure Tier"
                    >
                      <Sliders size={13} />
                      <span>Configure</span>
                    </button>
                  </div>

                  <p className="sa-plan-desc">
                    {p.description || 'Standard institutional service level packaging for verified educational tenants.'}
                  </p>

                  <div className="sa-plan-price-box">
                    <div className="sa-plan-price-row">
                      <span className="sa-plan-price-num">
                        ₹{Number(displayPrice).toLocaleString('en-IN')}
                      </span>
                      <span className="sa-plan-price-period">
                        / month {billingCycle === 'yearly' && '(billed annually)'}
                      </span>
                    </div>

                    <div className="sa-plan-price-billed">
                      <CheckCircle2 size={14} />
                      <span>
                        ₹{Number(totalAnnual).toLocaleString('en-IN')} billed annually (12 months)
                      </span>
                    </div>
                  </div>

                  {/* Quota & Feature Specs */}
                  <div className="sa-plan-specs-list">
                    <div className="sa-plan-spec-item">
                      <CheckCircle2 size={16} className="sa-spec-icon-check" />
                      <span>
                        <strong>Up to {p.max_students.toLocaleString()} students</strong> quota limit
                      </span>
                    </div>
                    <div className="sa-plan-spec-item">
                      <CheckCircle2 size={16} className="sa-spec-icon-check" />
                      <span>Realtime Biometric & Mobile QR sync</span>
                    </div>
                    <div className="sa-plan-spec-item">
                      <CheckCircle2 size={16} className="sa-spec-icon-check" />
                      <span>Automated SMS & WhatsApp Parent Alerts</span>
                    </div>
                    {isEnterprise && (
                      <div className="sa-plan-spec-item">
                        <ShieldCheck size={16} className="sa-spec-icon-star" />
                        <span>
                          <strong>Dedicated Account Manager & 99.9% SLA</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tenant Adoption Footprint */}
                  <div className="sa-plan-footer">
                    <div className="sa-plan-adoption">
                      Active Institutions: <strong>{subCount}</strong>
                    </div>
                    {onNavigateSchools && (
                      <button
                        className="sa-link-btn"
                        onClick={onNavigateSchools}
                      >
                        <span>View schools</span>
                        <ExternalLink size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Tenant Subscription Ledger Card */}
          <div className="sa-card" style={{ marginTop: '10px' }}>
            <div className="sa-card-head" style={{ flexWrap: 'wrap', gap: '14px' }}>
              <div className="sa-card-title-group">
                <Building2 size={18} className="sa-card-icon" />
                <div>
                  <h3>Active Tenant Subscription Ledger</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Live quota consumption and license validity per institution.
                  </span>
                </div>
              </div>

              {/* Filter and Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div className="sa-inline-search" style={{ minWidth: '200px' }}>
                  <Search size={14} style={{ color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search institution or code..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                  />
                </div>

                <select
                  className="sa-select-input"
                  value={ledgerPlanFilter}
                  onChange={(e) => setLedgerPlanFilter(e.target.value)}
                >
                  <option value="ALL">All Tiers</option>
                  <option value="BASIC">Basic Tier</option>
                  <option value="STANDARD">Standard Tier</option>
                  <option value="ENTERPRISE">Enterprise Tier</option>
                </select>
              </div>
            </div>

            <div className="sa-table-responsive">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>INSTITUTION</th>
                    <th>SUBSCRIBED TIER</th>
                    <th>STUDENT LIMIT</th>
                    <th>CURRENT ENROLLED</th>
                    <th>QUOTA USAGE</th>
                    <th>VALID THROUGH</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchools.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                        {ledgerSearch || ledgerPlanFilter !== 'ALL'
                          ? 'No institutions match the filter criteria.'
                          : 'No institutions currently registered on any subscription tier.'}
                      </td>
                    </tr>
                  ) : (
                    filteredSchools.map((s) => {
                      const maxSt = s.plan_name?.toLowerCase().includes('enterprise') ? 5000 : s.plan_name?.toLowerCase().includes('standard') ? 1000 : 300;
                      const enrolled = s.student_count || 0;
                      const pct = Math.min(100, Math.round((enrolled / maxSt) * 100));
                      const fillClass = pct > 90 ? 'red' : pct > 70 ? 'amber' : 'green';

                      return (
                        <tr key={s.id}>
                          <td>
                            <div className="sa-school-cell">
                              <div className="sa-school-avatar">
                                {s.code ? s.code.slice(0, 2) : s.name.slice(0, 2)}
                              </div>
                              <div className="sa-school-info">
                                <strong className="sa-school-name">{s.name}</strong>
                                <span style={{ fontSize: '11.5px', color: '#64748b' }}>{s.code} · {s.city || 'Campus'}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: '#2563eb' }}>
                              {s.plan_name || 'Standard Growth'}
                            </span>
                          </td>
                          <td>{maxSt.toLocaleString()} students</td>
                          <td>{enrolled.toLocaleString()} students</td>
                          <td>
                            <div className="sa-ledger-progress-wrap">
                              <div className="sa-ledger-progress-bar">
                                <div
                                  className={`sa-ledger-progress-fill ${fillClass}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="sa-ledger-progress-pct">{pct}%</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '13px' }}>
                              {s.end_date ? new Date(s.end_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Ongoing'}
                            </span>
                          </td>
                          <td>
                            <span className={`sa-badge-pill ${s.status === 'ACTIVE' ? 'success' : 'warning'}`}>
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
          <div className="sa-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h3>
                {editingPlan ? `Configure Tier: ${editingPlan.name}` : 'Create New Subscription Tier'}
              </h3>
              <button
                className="sa-modal-close"
                disabled={submitting}
                onClick={() => setModalOpen(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitPlan} className="sa-modal-form">
              {formError && (
                <div className="sa-error-banner" style={{ margin: '0 0 12px 0' }}>
                  {formError}
                </div>
              )}

              <div className="form-group">
                <label>Tier Plan Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Elite, Campus Pro"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Description & Value Proposition</label>
                <textarea
                  rows={2}
                  placeholder="Describe included features, SLA, and capacity"
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Max Student Limit *</label>
                  <input
                    type="number"
                    required
                    min={10}
                    value={planForm.max_students}
                    onChange={(e) => setPlanForm({ ...planForm, max_students: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Monthly Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={planForm.price_monthly}
                    onChange={(e) => {
                      const monthly = Number(e.target.value);
                      setPlanForm({
                        ...planForm,
                        price_monthly: monthly,
                        price_yearly: monthly * 12
                      });
                    }}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Annual Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={planForm.price_yearly}
                    onChange={(e) => setPlanForm({ ...planForm, price_yearly: Number(e.target.value) })}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Calculated as Monthly Price × 12 (₹{(Number(planForm.price_monthly || 0) * 12).toLocaleString('en-IN')})
                  </span>
                </div>
                <div className="form-group">
                  <label>Discount Option (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="e.g. 15 (0 = No discount)"
                    value={planForm.discount_percentage === 0 ? '' : planForm.discount_percentage}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : Math.min(100, Math.max(0, Number(e.target.value)));
                      setPlanForm({ ...planForm, discount_percentage: val });
                    }}
                  />
                  <span style={{ fontSize: '11px', color: planForm.discount_percentage > 0 ? '#059669' : '#64748b', marginTop: '4px', display: 'block', fontWeight: planForm.discount_percentage > 0 ? '600' : 'normal' }}>
                    {planForm.discount_percentage > 0
                      ? `🏷️ ${planForm.discount_percentage}% OFF will be shown on School Admin page`
                      : 'No discount (discount badge will be hidden on School Admin page)'}
                  </span>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '10px' }}>
                <label>Tier Availability Status</label>
                <select
                  value={planForm.is_active ? 'active' : 'inactive'}
                  onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.value === 'active' })}
                >
                  <option value="active">Active (Available to new schools)</option>
                  <option value="inactive">Archived / Hidden</option>
                </select>
              </div>

              <div className="sa-modal-actions">
                <button
                  type="button"
                  className="sa-btn-secondary"
                  disabled={submitting}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sa-btn-primary"
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
