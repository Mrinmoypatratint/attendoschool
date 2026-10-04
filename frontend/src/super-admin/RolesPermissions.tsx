import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';

interface PermissionMatrixRow {
  module: string;
  description: string;
  superAdmin: boolean;
  schoolAdmin: boolean;
  teacher: boolean;
  student: boolean;
  parent: boolean;
}

export const RolesPermissions: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'matrix' | 'roles'>('matrix');

  const matrixRows: PermissionMatrixRow[] = [
    {
      module: 'Tenant Management (Schools, Subscriptions, Tiers)',
      description: 'Create, suspend, renew educational tenants and modify pricing plans',
      superAdmin: true,
      schoolAdmin: false,
      teacher: false,
      student: false,
      parent: false
    },
    {
      module: 'Financials & Tax Invoicing (GST, Settlements)',
      description: 'Audit transactions, reconcile bank deposits, and generate tax invoices',
      superAdmin: true,
      schoolAdmin: true,
      teacher: false,
      student: false,
      parent: false
    },
    {
      module: 'Cross-Tenant Identity & User Directory',
      description: 'Global search and status control across all tenant accounts',
      superAdmin: true,
      schoolAdmin: false,
      teacher: false,
      student: false,
      parent: false
    },
    {
      module: 'School Student Roster & Classroom Enrollment',
      description: 'Enroll, promote, and manage student and parent profile records',
      superAdmin: true,
      schoolAdmin: true,
      teacher: false,
      student: false,
      parent: false
    },
    {
      module: 'Daily Attendance Roll Marking',
      description: 'Mark present/absent/leave records via web portal or biometric device',
      superAdmin: true,
      schoolAdmin: true,
      teacher: true,
      student: false,
      parent: false
    },
    {
      module: 'Attendance Correction Requests',
      description: 'Submit, review, and approve retrospective attendance alterations',
      superAdmin: true,
      schoolAdmin: true,
      teacher: true,
      student: false,
      parent: false
    },
    {
      module: 'Academic Routines & Period Timetables',
      description: 'Configure class periods, subject allocations, and teacher schedules',
      superAdmin: true,
      schoolAdmin: true,
      teacher: true,
      student: true,
      parent: false
    },
    {
      module: 'Parent Communication & Broadcast Alerts',
      description: 'Dispatch SMS, WhatsApp, and email announcements to parent contacts',
      superAdmin: true,
      schoolAdmin: false,
      teacher: true,
      student: false,
      parent: false
    },
    {
      module: 'Student Personal Portal & Grade Reports',
      description: 'View individual attendance history, academic marks, and calendar',
      superAdmin: true,
      schoolAdmin: true,
      teacher: true,
      student: true,
      parent: false
    },
    {
      module: 'Parent Ward Portal & Leave Applications',
      description: 'Check ward live attendance check-ins and submit leave excuses',
      superAdmin: true,
      schoolAdmin: true,
      teacher: false,
      student: false,
      parent: true
    },
    {
      module: 'System Telemetry, Audit Logs & Platform Settings',
      description: 'Inspect security events, SMS gateway credentials, and system health',
      superAdmin: true,
      schoolAdmin: false,
      teacher: false,
      student: false,
      parent: false
    }
  ];

  const loadPermissions = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/permissions').catch(() => null);
    } catch (err: any) {
      setError(err.message || 'Failed to load permissions registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  return (
    <div className="super-admin-content-inner">
      {/* Header */}
      <div className="section-header-row">
        <div>
          <h2 className="section-title">Role-Based Access Control (RBAC) Matrix</h2>
          <p className="section-subtitle">
            Audit system permission boundaries, security capabilities, and functional access across platform roles.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={loadPermissions} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh Matrix
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ margin: '16px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', margin: '20px 0', borderBottom: '1px solid #e2e8f0' }}>
        <button
          className="btn-tab"
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'matrix' ? '700' : '500',
            color: activeTab === 'matrix' ? '#4f46e5' : '#64748b',
            borderBottom: activeTab === 'matrix' ? '2px solid #4f46e5' : '2px solid transparent'
          }}
          onClick={() => setActiveTab('matrix')}
        >
          Functional RBAC Matrix
        </button>
        <button
          className="btn-tab"
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'roles' ? '700' : '500',
            color: activeTab === 'roles' ? '#4f46e5' : '#64748b',
            borderBottom: activeTab === 'roles' ? '2px solid #4f46e5' : '2px solid transparent'
          }}
          onClick={() => setActiveTab('roles')}
        >
          Role Security Profiles
        </button>
      </div>

      {activeTab === 'matrix' ? (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '280px' }}>Platform Capability / Module</th>
                  <th style={{ textAlign: 'center' }}>Super Admin</th>
                  <th style={{ textAlign: 'center' }}>School Admin</th>
                  <th style={{ textAlign: 'center' }}>Teacher</th>
                  <th style={{ textAlign: 'center' }}>Student</th>
                  <th style={{ textAlign: 'center' }}>Parent</th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{row.module}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{row.description}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.superAdmin ? (
                        <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '16px' }}>&check;</span>
                      ) : (
                        <span style={{ color: '#cbd5e1' }}>&mdash;</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.schoolAdmin ? (
                        <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '16px' }}>&check;</span>
                      ) : (
                        <span style={{ color: '#cbd5e1' }}>&mdash;</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.teacher ? (
                        <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '16px' }}>&check;</span>
                      ) : (
                        <span style={{ color: '#cbd5e1' }}>&mdash;</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.student ? (
                        <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '16px' }}>&check;</span>
                      ) : (
                        <span style={{ color: '#cbd5e1' }}>&mdash;</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.parent ? (
                        <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '16px' }}>&check;</span>
                      ) : (
                        <span style={{ color: '#cbd5e1' }}>&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge badge-active">SUPER_ADMIN</span>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Platform Super Administrator</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              Global tenant manager with unrestricted authority across all database shards, payment gateways, and system infrastructure.
            </p>
            <div style={{ fontSize: '12px', color: '#334155', marginTop: '12px', lineHeight: 1.5 }}>
              <strong>Scope:</strong> Cross-tenant, Multi-tenant global
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge" style={{ background: '#f5f3ff', color: '#7c3aed' }}>SCHOOL_ADMIN</span>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>School Principal / Admin</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              Institutional tenant administrator with authority over school enrollment, teacher assignments, routines, and fee status.
            </p>
            <div style={{ fontSize: '12px', color: '#334155', marginTop: '12px', lineHeight: 1.5 }}>
              <strong>Scope:</strong> Single tenant (scoped to schoolId)
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge" style={{ background: '#eff6ff', color: '#2563eb' }}>TEACHER</span>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Classroom Teacher</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              Faculty member authorized to conduct daily roll calls, manage classroom routines, and request attendance corrections.
            </p>
            <div style={{ fontSize: '12px', color: '#334155', marginTop: '12px', lineHeight: 1.5 }}>
              <strong>Scope:</strong> Assigned classes & sections
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge" style={{ background: '#f8fafc', color: '#475569' }}>PARENT</span>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Parent</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              Parent access to live attendance check-ins, leave applications, daily notifications, and academic notices.
            </p>
            <div style={{ fontSize: '12px', color: '#334155', marginTop: '12px', lineHeight: 1.5 }}>
              <strong>Scope:</strong> Enrolled wards only
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
