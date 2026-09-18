import React, { useState, useEffect, useMemo } from 'react';
import { UserRecord } from './types';
import { apiRequest } from '../api';

export const PeopleDirectory: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Action status
  const [actionId, setActionId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ users: UserRecord[]; total: number }>('/super-admin/users')
        .catch(() => ({ users: [], total: 0 }));
      setUsers(res.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load user directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleStatus = async (user: UserRecord) => {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setActionId(user.id);
    try {
      await apiRequest(`/super-admin/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
      );
      setSuccessToast(`User ${user.name} (${user.email}) marked as ${nextStatus}.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update user account status.');
    } finally {
      setActionId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        search === '' ||
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.schoolName?.toLowerCase().includes(search.toLowerCase());

      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  // Aggregate user statistics
  const adminCount = users.filter((u) => u.role === 'SCHOOL_ADMIN' || u.role === 'SUPER_ADMIN').length;
  const teacherCount = users.filter((u) => u.role === 'TEACHER').length;
  const studentCount = users.filter((u) => u.role === 'STUDENT').length;
  const parentCount = users.filter((u) => u.role === 'PARENT').length;

  return (
    <div className="super-admin-content-inner">
      {/* Header */}
      <div className="section-header-row">
        <div>
          <h2 className="section-title">Multi-Tenant People & Identity Directory</h2>
          <p className="section-subtitle">
            Centralized directory of all platform administrators, school principals, teachers, students, and parents.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={loadUsers} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {successToast && (
        <div style={{ margin: '14px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {successToast}
        </div>
      )}

      {error && (
        <div className="error-banner" style={{ margin: '16px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {/* KPI Cards Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', margin: '20px 0' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
            Total User Accounts
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {users.length}
          </div>
          <div style={{ fontSize: '12px', color: '#10b981', marginTop: '2px' }}>
            Active authentication identities
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
            Institutional Admins
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#6366f1', marginTop: '4px' }}>
            {adminCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            School & Super Admins
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
            Faculty & Teachers
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {teacherCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Instructors & Roll callers
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
            Students & Parents
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
            {studentCount + parentCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Portal & Mobile app users
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
              placeholder="Search by name, email, or institutional campus..."
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
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Role Filter:</span>
            <select
              className="form-control"
              style={{ width: '160px' }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">SUPER ADMIN</option>
              <option value="SCHOOL_ADMIN">SCHOOL ADMIN</option>
              <option value="TEACHER">TEACHER</option>
              <option value="STUDENT">STUDENT</option>
              <option value="PARENT">PARENT</option>
            </select>
          </div>

          {(search || roleFilter !== 'ALL') && (
            <button
              className="btn-secondary"
              style={{ padding: '8px 14px' }}
              onClick={() => {
                setSearch('');
                setRoleFilter('ALL');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* User Directory Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Platform Role</th>
                <th>Assigned Institution</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Last Active</th>
                <th style={{ textAlign: 'right' }}>Security Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px', width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Loading platform identities...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isActive = u.status === 'ACTIVE';

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: u.role === 'SUPER_ADMIN' ? '#4f46e5' : u.role === 'SCHOOL_ADMIN' ? '#0f172a' : '#e2e8f0',
                            color: u.role === 'SUPER_ADMIN' || u.role === 'SCHOOL_ADMIN' ? '#fff' : '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            fontSize: '12px'
                          }}>
                            {(u.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>{u.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: u.role === 'SUPER_ADMIN' ? '#eff6ff' : u.role === 'SCHOOL_ADMIN' ? '#f5f3ff' : '#f8fafc',
                            color: u.role === 'SUPER_ADMIN' ? '#2563eb' : u.role === 'SCHOOL_ADMIN' ? '#7c3aed' : '#475569',
                            border: `1px solid ${u.role === 'SUPER_ADMIN' ? '#bfdbfe' : u.role === 'SCHOOL_ADMIN' ? '#ddd6fe' : '#e2e8f0'}`
                          }}
                        >
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', color: '#334155' }}>
                          {u.schoolName || 'Platform Global'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {u.phone || '—'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${isActive ? 'badge-active' : 'badge-suspended'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {u.lastLogin || 'Recent'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {u.role !== 'SUPER_ADMIN' && (
                          <button
                            className="btn-secondary"
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              color: isActive ? '#ef4444' : '#10b981'
                            }}
                            disabled={actionId === u.id}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {actionId === u.id ? 'Updating...' : isActive ? 'Suspend' : 'Activate'}
                          </button>
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
