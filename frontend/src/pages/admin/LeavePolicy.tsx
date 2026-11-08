import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Check,
  X,
  FileCheck,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api } from '../../api';

export interface LeavePolicy {
  id: string;
  school_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  days_count: number;
  accrual_cycle: 'YEARLY' | 'HALF_YEARLY';
  applicable_to: 'TEACHER' | 'STAFF' | 'STUDENT' | 'ALL';
  paid: boolean;
  carry_forward: boolean;
  max_carry_forward_days?: number;
  requires_document: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function LeavePolicy() {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [cycleFilter, setCycleFilter] = useState<'ALL' | 'YEARLY' | 'HALF_YEARLY'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'TEACHER' | 'STAFF' | 'STUDENT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null);
  const [deleteConfirmPolicy, setDeleteConfirmPolicy] = useState<LeavePolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    days_count: 10 as number | string,
    accrual_cycle: 'YEARLY' as 'YEARLY' | 'HALF_YEARLY',
    applicable_to: 'ALL' as 'TEACHER' | 'STAFF' | 'STUDENT' | 'ALL',
    paid: true,
    carry_forward: false,
    max_carry_forward_days: 0 as number | string,
    requires_document: false,
    is_active: true
  });

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (/^0\d/.test(val)) {
      val = val.replace(/^0+/, '');
      e.target.value = val;
    }
    setFormData(prev => ({ ...prev, days_count: val }));
  };

  const handleMaxCarryForwardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (/^0\d/.test(val)) {
      val = val.replace(/^0+/, '');
      e.target.value = val;
    }
    setFormData(prev => ({ ...prev, max_carry_forward_days: val }));
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchPolicies = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get('/leave-policies');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setPolicies(res.data.data);
      } else if (Array.isArray(res.data)) {
        setPolicies(res.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch leave policies:', err);
      showToast(err.response?.data?.message || 'Failed to load leave policies', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingPolicy(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      days_count: 10,
      accrual_cycle: 'YEARLY',
      applicable_to: 'TEACHER',
      paid: true,
      carry_forward: false,
      max_carry_forward_days: 0,
      requires_document: false,
      is_active: true
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (p: LeavePolicy) => {
    setEditingPolicy(p);
    setFormData({
      name: p.name,
      code: p.code || '',
      description: p.description || '',
      days_count: p.days_count,
      accrual_cycle: p.accrual_cycle || 'YEARLY',
      applicable_to: p.applicable_to || 'ALL',
      paid: p.paid !== false,
      carry_forward: p.carry_forward === true,
      max_carry_forward_days: p.max_carry_forward_days || 0,
      requires_document: p.requires_document === true,
      is_active: p.is_active !== false
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Policy Name is required.');
      return;
    }
    const days = Number(formData.days_count);
    if (isNaN(days) || days <= 0) {
      setFormError('Leave days count must be a positive number.');
      return;
    }

    const payload = {
      ...formData,
      days_count: days,
      max_carry_forward_days: Number(formData.max_carry_forward_days) || 0
    };

    setSaving(true);
    setFormError(null);
    try {
      if (editingPolicy) {
        const res = await api.put(`/leave-policies/${editingPolicy.id}`, payload);
        showToast(res.data?.message || `Leave policy "${formData.name}" updated successfully.`);
      } else {
        const res = await api.post('/leave-policies', payload);
        showToast(res.data?.message || `Leave policy "${formData.name}" created successfully.`);
      }
      setModalOpen(false);
      fetchPolicies();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Error saving leave policy.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (p: LeavePolicy) => {
    try {
      const res = await api.patch(`/leave-policies/${p.id}/toggle-status`);
      showToast(res.data?.message || `Policy updated`);
      fetchPolicies();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to toggle status', 'error');
    }
  };

  const handleDeletePolicy = async () => {
    if (!deleteConfirmPolicy) return;
    try {
      const res = await api.delete(`/leave-policies/${deleteConfirmPolicy.id}`);
      showToast(res.data?.message || `Policy deleted successfully.`);
      setDeleteConfirmPolicy(null);
      fetchPolicies();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete policy', 'error');
    }
  };

  // Filtered List
  const filteredPolicies = useMemo(() => {
    return policies.filter(p => {
      const matchSearch =
        search.trim() === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(search.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase()));

      const matchCycle =
        cycleFilter === 'ALL' || p.accrual_cycle === cycleFilter;

      const matchRole =
        roleFilter === 'ALL' || p.applicable_to === roleFilter || p.applicable_to === 'ALL';

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && p.is_active) ||
        (statusFilter === 'INACTIVE' && !p.is_active);

      return matchSearch && matchCycle && matchRole && matchStatus;
    });
  }, [policies, search, cycleFilter, roleFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: policies.length,
      yearly: policies.filter(p => p.accrual_cycle === 'YEARLY').length,
      halfYearly: policies.filter(p => p.accrual_cycle === 'HALF_YEARLY').length,
      active: policies.filter(p => p.is_active).length
    };
  }, [policies]);

  return (
    <div className="leave-policy-container" style={{ width: '100%', maxWidth: 'none', margin: 0, padding: '0 0 40px 0' }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 28,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: toastMsg.type === 'success' ? '#03806a' : '#d32f2f',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: 4,
          boxShadow: 'none',
          fontWeight: 600,
          fontSize: 13.5,
          animation: 'fadeInDown 0.25s ease'
        }}>
          {toastMsg.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header Row */}
      <div className="flex justify-between items-start flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="m-0 text-2xl font-bold text-slate-900 dark:text-white">
              Leave Policy
            </h1>
            <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold py-1 px-2.5 rounded-full tracking-wider">
              ADMIN CONFIGURATION
            </span>
          </div>
          <p className="m-0 mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Define school leave types, allowed entitlement counts, and renewal frequency on a <b>Yearly</b> or <b>Half-Yearly</b> basis. All rules are fully dynamic.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchPolicies(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
            title="Refresh policies from database"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4.5 py-2 rounded-lg border-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Leave Policy</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Policies */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4.5 flex items-center gap-3.5 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Layers size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              Total Policies
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {stats.total}
            </div>
          </div>
        </div>

        {/* Yearly Cycle */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4.5 flex items-center gap-3.5 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Calendar size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              Yearly Accrual
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {stats.yearly}
            </div>
          </div>
        </div>

        {/* Half-Yearly Cycle */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4.5 flex items-center gap-3.5 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              Half-Yearly Accrual
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {stats.halfYearly}
            </div>
          </div>
        </div>

        {/* Active Policies */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4.5 flex items-center gap-3.5 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              Active Rules
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {stats.active}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 px-4 mb-4.5 flex items-center gap-3 flex-wrap shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search policy name, code, description..."
            className="w-full py-2 pl-8 pr-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Accrual Cycle Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">CYCLE:</span>
          <select
            value={cycleFilter}
            onChange={e => setCycleFilter(e.target.value as any)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs cursor-pointer outline-none"
          >
            <option value="ALL">All Cycles</option>
            <option value="YEARLY">Yearly Only</option>
            <option value="HALF_YEARLY">Half-Yearly Only</option>
          </select>
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">APPLICABLE TO:</span>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as any)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs cursor-pointer outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value="TEACHER">Faculty / Teachers</option>
            <option value="STAFF">Administrative Staff</option>
            <option value="STUDENT">Students</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">STATUS:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs cursor-pointer outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {(search || cycleFilter !== 'ALL' || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCycleFilter('ALL');
              setRoleFilter('ALL');
              setStatusFilter('ALL');
            }}
            className="py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent text-slate-500 dark:text-slate-400 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Table Card */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border, #eaeaec)',
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: 'none'
      }}>
        {loading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#696e79' }}>
            <RefreshCw size={28} style={{ animation: 'spinAnim 0.8s linear infinite', color: '#e11d55', margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 600, fontSize: 14 }}>Loading leave policies...</div>
          </div>
        ) : filteredPolicies.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(225, 29, 85, 0.1)',
              color: '#e11d55',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Calendar size={28} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text, #1c1f2e)' }}>
              No Leave Policies Found
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--text-muted, #696e79)', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
              {policies.length === 0
                ? "You haven't configured any leave policies yet. Create dynamic leave types such as Casual Leave, Medical Leave, etc. with customized yearly or half-yearly counts."
                : "No leave policies matched your active search and filter criteria."}
            </p>
            {policies.length === 0 && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 18px',
                  borderRadius: 4,
                  border: 'none',
                  background: '#e11d55',
                  color: '#ffffff',
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} /> Create First Policy
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
              <thead>
                <tr style={{ background: 'var(--card-subtle, #f9f9fa)', borderBottom: '1px solid var(--border, #eaeaec)' }}>
                  <th style={{ padding: '12px 18px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #535766)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Leave Policy Name
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #535766)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Allowed Days
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #535766)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Accrual / Renewal Cycle
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #535766)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Applicable To
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #535766)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Rules & Pay
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #535766)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
                    Status
                  </th>
                  <th style={{ padding: '12px 18px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #535766)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPolicies.map(p => (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: '1px solid var(--border, #f5f5f6)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {/* Policy Name & Code */}
                    <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 4,
                          background: p.accrual_cycle === 'YEARLY' ? 'rgba(225, 29, 85, 0.12)' : 'rgba(92, 107, 192, 0.12)',
                          color: p.accrual_cycle === 'YEARLY' ? '#e11d55' : '#5c6bc0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 12,
                          flexShrink: 0
                        }}>
                          {p.code || p.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text, #1c1f2e)' }}>
                            {p.name}
                          </div>
                          {p.description && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted, #696e79)', marginTop: 2, maxWidth: 300 }}>
                              {p.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Allowed Days */}
                    <td style={{ padding: '14px 14px', verticalAlign: 'middle' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 4,
                        background: 'rgba(225, 29, 85, 0.08)',
                        color: '#c0174a',
                        fontWeight: 700,
                        fontSize: 13.5
                      }}>
                        {p.days_count} {p.days_count === 1 ? 'Day' : 'Days'}
                      </span>
                    </td>

                    {/* Cycle (Yearly vs Half-Yearly) */}
                    <td style={{ padding: '14px 14px', verticalAlign: 'middle' }}>
                      {p.accrual_cycle === 'YEARLY' ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: 'rgba(92, 107, 192, 0.12)',
                          color: '#5c6bc0',
                          fontWeight: 600,
                          fontSize: 12
                        }}>
                          <Calendar size={13} />
                          Yearly (Annual)
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: 'rgba(92, 107, 192, 0.12)',
                          color: '#5c6bc0',
                          fontWeight: 600,
                          fontSize: 12
                        }}>
                          <Clock size={13} />
                          Half-Yearly (Bi-Annual)
                        </span>
                      )}
                    </td>

                    {/* Applicable To */}
                    <td style={{ padding: '14px 14px', verticalAlign: 'middle' }}>
                      <span style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: 'var(--text-secondary, #535766)',
                        background: 'var(--card-subtle, #f5f5f6)',
                        padding: '3px 8px',
                        borderRadius: 4
                      }}>
                        {p.applicable_to === 'ALL' ? 'All Staff & Teachers' :
                         p.applicable_to === 'TEACHER' ? 'Faculty / Teachers' :
                         p.applicable_to === 'STAFF' ? 'Administrative Staff' : 'Students'}
                      </span>
                    </td>

                    {/* Rules & Pay */}
                    <td style={{ padding: '14px 14px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: p.paid ? 'rgba(3, 128, 106, 0.12)' : 'rgba(211, 47, 47, 0.12)',
                          color: p.paid ? '#03806a' : '#d32f2f'
                        }}>
                          {p.paid ? 'Paid Leave' : 'Unpaid'}
                        </span>
                        {p.carry_forward && (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: 'rgba(225, 29, 85, 0.1)',
                            color: '#e11d55'
                          }} title={`Max carry forward: ${p.max_carry_forward_days || 'Unlimited'} days`}>
                            Carry Forward
                          </span>
                        )}
                        {p.requires_document && (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: 'rgba(233, 162, 59, 0.12)',
                            color: '#b8781c'
                          }} title="Supporting document / certificate required">
                            Doc Req.
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Toggle */}
                    <td style={{ padding: '14px 14px', verticalAlign: 'middle', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(p)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '4px 9px',
                          borderRadius: 999,
                          border: 'none',
                          cursor: 'pointer',
                          background: p.is_active ? 'rgba(3, 128, 106, 0.12)' : 'rgba(148, 150, 159, 0.15)',
                          color: p.is_active ? '#03806a' : '#696e79',
                          fontWeight: 600,
                          fontSize: 12
                        }}
                        title="Click to toggle policy active/inactive"
                      >
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: p.is_active ? '#03806a' : '#94969f'
                        }}></span>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(p)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 4,
                            border: '1px solid var(--border, #d4d5d9)',
                            background: 'var(--bg, #ffffff)',
                            color: '#e11d55',
                            cursor: 'pointer'
                          }}
                          title="Edit Policy"
                        >
                          <Edit2 size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmPolicy(p)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 4,
                            border: '1px solid rgba(211, 47, 47, 0.25)',
                            background: 'rgba(211, 47, 47, 0.06)',
                            color: '#d32f2f',
                            cursor: 'pointer'
                          }}
                          title="Delete Policy"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CREATE / EDIT LEAVE POLICY MODAL ── */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(28, 31, 46, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: 4,
            border: '1px solid var(--border, #eaeaec)',
            width: '100%',
            maxWidth: 580,
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: 'none',
            boxSizing: 'border-box'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border, #eaeaec)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--card-subtle, #f9f9fa)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text, #1c1f2e)' }}>
                  {editingPolicy ? 'Edit Leave Policy' : 'Create Dynamic Leave Policy'}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-muted, #696e79)' }}>
                  Configure leave name, entitlement count, and Yearly or Half-Yearly renewal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#696e79', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSavePolicy} style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {formError && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 4,
                  background: '#fbeaea',
                  border: '1px solid #f2c0c0',
                  color: '#7e1b1b',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Policy Name & Code */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text, #3e4152)', marginBottom: 5 }}>
                    Policy Name <span style={{ color: '#d32f2f' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Casual Leave, Sick Leave, Earned Leave..."
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 4,
                      border: '1px solid var(--border, #d4d5d9)',
                      background: 'var(--bg, #ffffff)',
                      color: 'var(--text, #1c1f2e)',
                      fontSize: 13.5,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text, #3e4152)', marginBottom: 5 }}>
                    Code / Tag
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. CL, SL, EL"
                    maxLength={10}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 4,
                      border: '1px solid var(--border, #d4d5d9)',
                      background: 'var(--bg, #ffffff)',
                      color: 'var(--text, #1c1f2e)',
                      fontSize: 13.5,
                      boxSizing: 'border-box',
                      textTransform: 'uppercase'
                    }}
                  />
                </div>
              </div>

              {/* Accrual / Renewal Cycle Selection (Yearly vs Half-Yearly) */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text, #3e4152)', marginBottom: 6 }}>
                  Accrual & Renewal Cycle <span style={{ color: '#d32f2f' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div
                    onClick={() => setFormData({ ...formData, accrual_cycle: 'YEARLY' })}
                    style={{
                      border: formData.accrual_cycle === 'YEARLY' ? '2px solid #e11d55' : '1px solid var(--border, #d4d5d9)',
                      background: formData.accrual_cycle === 'YEARLY' ? 'rgba(225, 29, 85, 0.08)' : 'var(--bg, #ffffff)',
                      borderRadius: 4,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: formData.accrual_cycle === 'YEARLY' ? '#e11d55' : 'var(--text, #1c1f2e)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={15} /> Yearly Cycle
                      </span>
                      {formData.accrual_cycle === 'YEARLY' && (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#e11d55', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={12} />
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted, #696e79)' }}>
                      Count applies once per entire academic year.
                    </span>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, accrual_cycle: 'HALF_YEARLY' })}
                    style={{
                      border: formData.accrual_cycle === 'HALF_YEARLY' ? '2px solid #5c6bc0' : '1px solid var(--border, #d4d5d9)',
                      background: formData.accrual_cycle === 'HALF_YEARLY' ? 'rgba(92, 107, 192, 0.08)' : 'var(--bg, #ffffff)',
                      borderRadius: 4,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: formData.accrual_cycle === 'HALF_YEARLY' ? '#5c6bc0' : 'var(--text, #1c1f2e)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={15} /> Half-Yearly Cycle
                      </span>
                      {formData.accrual_cycle === 'HALF_YEARLY' && (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#5c6bc0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={12} />
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted, #696e79)' }}>
                      Count applies per 6 months / semester.
                    </span>
                  </div>
                </div>
              </div>

              {/* Leave Days Count & Applicable To */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text, #3e4152)', marginBottom: 5 }}>
                    Allowed Leave Count (Days) <span style={{ color: '#d32f2f' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="365"
                    required
                    value={formData.days_count}
                    onFocus={e => e.target.select()}
                    onChange={handleDaysChange}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 4,
                      border: '1px solid var(--border, #d4d5d9)',
                      background: 'var(--bg, #ffffff)',
                      color: 'var(--text, #1c1f2e)',
                      fontSize: 13.5,
                      boxSizing: 'border-box',
                      fontWeight: 700
                    }}
                  />
                  <span style={{ fontSize: 11.5, color: '#696e79', marginTop: 4, display: 'block' }}>
                    {formData.days_count || 0} {Number(formData.days_count) === 1 ? 'day' : 'days'} per {formData.accrual_cycle === 'YEARLY' ? 'year' : 'half-year (6 months)'}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text, #3e4152)', marginBottom: 5 }}>
                    Applicable Audience
                  </label>
                  <select
                    value={formData.applicable_to}
                    onChange={e => setFormData({ ...formData, applicable_to: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 4,
                      border: '1px solid var(--border, #d4d5d9)',
                      background: 'var(--bg, #ffffff)',
                      color: 'var(--text, #1c1f2e)',
                      fontSize: 13.5,
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="ALL">All Staff & Faculty (Default)</option>
                    <option value="TEACHER">Faculty / Teachers Only</option>
                    <option value="STAFF">Administrative Staff Only</option>
                    <option value="STUDENT">Students Only</option>
                  </select>
                </div>
              </div>

              {/* Toggles (Paid, Carry Forward, Document Required) */}
              <div style={{
                background: 'var(--card-subtle, #f9f9fa)',
                border: '1px solid var(--border, #eaeaec)',
                borderRadius: 4,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text, #282c3f)' }}>
                  <div>
                    <div>Paid Leave</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted, #696e79)', fontWeight: 400 }}>Salary is maintained without deduction during this leave.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.paid}
                    onChange={e => setFormData({ ...formData, paid: e.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </label>

                <div style={{ height: 1, background: 'var(--border, #eaeaec)' }}></div>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text, #282c3f)' }}>
                  <div>
                    <div>Carry Forward Unused Leaves</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted, #696e79)', fontWeight: 400 }}>Allow remaining days to rollover into the next period.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.carry_forward}
                    onChange={e => setFormData({ ...formData, carry_forward: e.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </label>

                {formData.carry_forward && (
                  <div style={{ paddingLeft: 8, paddingTop: 4 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#535766', marginBottom: 4 }}>
                      Max Carry Forward Limit (0 = Unlimited)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.max_carry_forward_days}
                      onFocus={e => e.target.select()}
                      onChange={handleMaxCarryForwardChange}
                      style={{
                        width: 140,
                        padding: '6px 10px',
                        borderRadius: 4,
                        border: '1px solid #d4d5d9',
                        fontSize: 13
                      }}
                    />
                  </div>
                )}

                <div style={{ height: 1, background: 'var(--border, #eaeaec)' }}></div>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text, #282c3f)' }}>
                  <div>
                    <div>Require Supporting Document / Proof</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted, #696e79)', fontWeight: 400 }}>Mandatory medical slip or certificate upload during application.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.requires_document}
                    onChange={e => setFormData({ ...formData, requires_document: e.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </label>

                <div style={{ height: 1, background: 'var(--border, #eaeaec)' }}></div>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text, #282c3f)' }}>
                  <div>
                    <div>Active Status</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted, #696e79)', fontWeight: 400 }}>Available for staff/teachers to select when applying.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </label>
              </div>

              {/* Description / Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text, #3e4152)', marginBottom: 5 }}>
                  Description / Institutional Rules
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional guidelines for staff regarding notice period, approval workflow, or restrictions..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 4,
                    border: '1px solid var(--border, #d4d5d9)',
                    background: 'var(--bg, #ffffff)',
                    color: 'var(--text, #1c1f2e)',
                    fontSize: 13,
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 4,
                    border: '1px solid var(--border, #d4d5d9)',
                    background: 'transparent',
                    color: 'var(--text, #535766)',
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 20px',
                    borderRadius: 4,
                    border: 'none',
                    background: '#e11d55',
                    color: '#ffffff',
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving && <RefreshCw size={14} style={{ animation: 'spinAnim 0.8s linear infinite' }} />}
                  <span>{editingPolicy ? 'Update Policy' : 'Save Policy'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteConfirmPolicy && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(28, 31, 46, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: 4,
            border: '1px solid var(--border, #eaeaec)',
            width: '100%',
            maxWidth: 440,
            padding: 24,
            boxShadow: 'none'
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#f7d5d5',
              color: '#d32f2f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <Trash2 size={22} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--text, #1c1f2e)' }}>
              Delete Leave Policy?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--text-muted, #696e79)', lineHeight: 1.5 }}>
              Are you sure you want to delete <b>"{deleteConfirmPolicy.name}"</b>? Any existing leave requests associated with this category will remain, but users will no longer be able to select it.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmPolicy(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: '1px solid #d4d5d9',
                  background: 'transparent',
                  color: '#535766',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePolicy}
                style={{
                  padding: '8px 18px',
                  borderRadius: 4,
                  border: 'none',
                  background: '#d32f2f',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Delete Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
