import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, ShieldCheck, ClipboardCheck, BarChart3, RefreshCw, AlertTriangle,
  CheckCircle2, AlertCircle, Loader2, Check, Lock, Calendar, Info, Search
} from 'lucide-react';
import { api } from '../../api';

interface MentoredClass {
  mentor_record_id: string;
  class_id: string;
  section_id: string;
  class_number: number;
  section_name: string;
  assigned_at?: string;
}

interface TeacherPermission {
  school_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  is_primary: boolean;
  is_alternate: boolean;
  is_authorized: boolean;
}

interface AttendanceAnalysis {
  class_id: string;
  section_id: string;
  total_students: number;
  overall_percentage: number;
  students: Array<{
    student_id: string;
    student_name: string;
    roll: string | number;
    present_days: number;
    absent_days: number;
    marked_days: number;
    attendance_percentage: number;
  }>;
}

export function ClassMentorWorkspace() {
  const [mentoredClasses, setMentoredClasses] = useState<MentoredClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);

  // Active Selected Section
  const [selectedSection, setSelectedSection] = useState<MentoredClass | null>(null);
  const [activeTab, setActiveTab] = useState<'PERMISSIONS' | 'ATTENDANCE'>('PERMISSIONS');

  // Permissions Tab State
  const [permissions, setPermissions] = useState<TeacherPermission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [permissionFeedback, setPermissionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Attendance Tab State
  const [attendanceData, setAttendanceData] = useState<AttendanceAnalysis | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  // Date Range State for Attendance
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // 1. Fetch Mentored Classes for Logged-In Teacher
  const loadMyClasses = useCallback(async () => {
    setLoadingClasses(true);
    setClassesError(null);
    try {
      const res = await api.get('/teacher/mentor/my-classes');
      const data: MentoredClass[] = Array.isArray(res.data) ? res.data : [];
      setMentoredClasses(data);
      if (data.length > 0 && !selectedSection) {
        setSelectedSection(data[0]);
      } else if (data.length > 0 && selectedSection) {
        const stillExists = data.find(c => c.class_id === selectedSection.class_id && c.section_id === selectedSection.section_id);
        setSelectedSection(stillExists || data[0]);
      } else {
        setSelectedSection(null);
      }
    } catch (err: any) {
      console.error('Failed to load mentored classes:', err);
      setClassesError(err?.response?.data?.message || 'Unable to load your mentored class assignments.');
    } finally {
      setLoadingClasses(false);
    }
  }, [selectedSection]);

  useEffect(() => {
    loadMyClasses();
  }, []);

  // 2. Fetch Permissions for Selected Section
  const loadPermissions = useCallback(async () => {
    if (!selectedSection) return;
    setLoadingPermissions(true);
    setPermissionError(null);
    try {
      const res = await api.get(`/teacher/mentor/permissions?class_id=${selectedSection.class_id}&section_id=${selectedSection.section_id}`);
      setPermissions(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to load permissions:', err);
      setPermissionError(err?.response?.data?.message || 'Unable to fetch teacher permissions for this section.');
    } finally {
      setLoadingPermissions(false);
    }
  }, [selectedSection]);

  // 3. Fetch Attendance Analysis for Selected Section
  const loadAttendance = useCallback(async () => {
    if (!selectedSection) return;
    setLoadingAttendance(true);
    setAttendanceError(null);
    try {
      let url = `/teacher/mentor/attendance-analysis?class_id=${selectedSection.class_id}&section_id=${selectedSection.section_id}`;
      if (fromDate) url += `&from=${fromDate}`;
      if (toDate) url += `&to=${toDate}`;

      const res = await api.get(url);
      setAttendanceData(res.data || null);
    } catch (err: any) {
      console.error('Failed to load attendance analysis:', err);
      setAttendanceError(err?.response?.data?.message || 'Unable to generate attendance analysis for this section.');
    } finally {
      setLoadingAttendance(false);
    }
  }, [selectedSection, fromDate, toDate]);

  useEffect(() => {
    if (selectedSection) {
      if (activeTab === 'PERMISSIONS') {
        loadPermissions();
      } else if (activeTab === 'ATTENDANCE') {
        loadAttendance();
      }
    }
  }, [selectedSection, activeTab, loadPermissions, loadAttendance]);

  // Handle Toggle Permission
  const handleTogglePermission = async (item: TeacherPermission) => {
    if (!selectedSection || item.is_alternate) return;
    const targetKey = `${item.subject_id}:${item.teacher_id}`;
    setUpdatingId(targetKey);
    setPermissionFeedback(null);

    const newAuth = !item.is_authorized;
    try {
      await api.put('/teacher/mentor/permissions', {
        class_id: selectedSection.class_id,
        section_id: selectedSection.section_id,
        subject_id: item.subject_id,
        target_teacher_id: item.teacher_id,
        is_authorized: newAuth
      });

      setPermissionFeedback({
        type: 'success',
        message: `Publishing permission for ${item.teacher_name} (${item.subject_name}) set to ${newAuth ? 'ENABLED' : 'DISABLED'}.`
      });
      await loadPermissions();
    } catch (err: any) {
      setPermissionFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to update publishing permission.'
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtered Student Attendance Breakdown
  const filteredStudents = useMemo(() => {
    if (!attendanceData?.students) return [];
    if (!studentSearch.trim()) return attendanceData.students;
    const term = studentSearch.trim().toLowerCase();
    return attendanceData.students.filter(
      s => s.student_name.toLowerCase().includes(term) || String(s.roll).toLowerCase().includes(term)
    );
  }, [attendanceData, studentSearch]);

  if (loadingClasses) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}>
        <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
        <p>Loading your Class Mentor workspace...</p>
      </div>
    );
  }

  if (classesError) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 40, color: '#ef4444' }}>
        <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
        <p style={{ fontWeight: 600, fontSize: 16 }}>{classesError}</p>
        <button type="button" className="btn-secondary" onClick={loadMyClasses} style={{ marginTop: 16 }}>
          Retry Loading
        </button>
      </div>
    );
  }

  // EMPTY STATE: Logged-in teacher is not assigned as mentor for any section
  if (mentoredClasses.length === 0) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: '60px 20px', maxWidth: 640, margin: '40px auto' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', margin: '0 auto 16px' }}>
          <Users size={28} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main, #f8fafc)', margin: '0 0 8px' }}>
          No Class Mentor Assignments
        </h2>
        <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 24px' }}>
          You are not currently assigned as a Class Mentor for any class or section. Class Mentors are designated by your School Administration to oversee section attendance analytics and authorize subject teacher assignment publishing.
        </p>
        <button type="button" className="btn-secondary" onClick={loadMyClasses} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={15} /> Check For New Assignments
        </button>
      </div>
    );
  }

  return (
    <div className="as-mentor-workspace">
      {/* Workspace Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-main, #f8fafc)' }}>
              Class Mentor Workspace
            </h1>
            <span style={{ fontSize: 11.5, fontWeight: 700, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: 9999 }}>
              Mentor Access
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>
            Manage subject teacher assignment-publishing permissions and inspect section attendance analytics.
          </p>
        </div>

        {/* Section Switcher (Supports multiple mentored sections) */}
        {mentoredClasses.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card, #1e293b)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color, #334155)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#94a3b8' }}>Select Section:</span>
            <select
              value={`${selectedSection?.class_id}:${selectedSection?.section_id}`}
              onChange={e => {
                const [cId, sId] = e.target.value.split(':');
                const found = mentoredClasses.find(m => m.class_id === cId && m.section_id === sId);
                if (found) setSelectedSection(found);
              }}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color, #334155)', background: 'var(--bg-main, #0f172a)', color: 'var(--text-main, #f8fafc)', fontSize: 13, fontWeight: 600 }}
            >
              {mentoredClasses.map(m => (
                <option key={`${m.class_id}:${m.section_id}`} value={`${m.class_id}:${m.section_id}`}>
                  Class {m.class_number} — Section {m.section_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Single Section Badge Banner if only 1 section mentored */}
      {mentoredClasses.length === 1 && selectedSection && (
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(56, 189, 248, 0.05))', border: '1px solid rgba(56, 189, 248, 0.3)', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={18} style={{ color: '#38bdf8' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main, #f8fafc)' }}>
              Assigned Mentor for Class {selectedSection.class_number} — Section {selectedSection.section_name}
            </span>
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            Section ID: {selectedSection.section_id.slice(0, 8)}...
          </span>
        </div>
      )}

      {/* Multi-Section Tabs */}
      {mentoredClasses.length > 1 && (
        <div className="student-tab-bar" style={{ marginBottom: 16 }}>
          {mentoredClasses.map(m => (
            <button
              key={`${m.class_id}:${m.section_id}`}
              type="button"
              className={`student-tab-btn ${selectedSection?.class_id === m.class_id && selectedSection?.section_id === m.section_id ? 'active' : ''}`}
              onClick={() => setSelectedSection(m)}
            >
              Class {m.class_number} - Section {m.section_name}
            </button>
          ))}
        </div>
      )}

      {/* Sub-Tab Navigation: Permissions vs Attendance */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-color, #334155)', marginBottom: 20, paddingBottom: 2 }}>
        <button
          type="button"
          onClick={() => setActiveTab('PERMISSIONS')}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'PERMISSIONS' ? '#38bdf8' : '#94a3b8',
            borderBottom: activeTab === 'PERMISSIONS' ? '2px solid #38bdf8' : '2px solid transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <ShieldCheck size={16} /> Assignment Publishing Permissions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ATTENDANCE')}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'ATTENDANCE' ? '#38bdf8' : '#94a3b8',
            borderBottom: activeTab === 'ATTENDANCE' ? '2px solid #38bdf8' : '2px solid transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <BarChart3 size={16} /> Class Attendance Analytics
        </button>
      </div>

      {/* SUB-TAB 1: ASSIGNMENT PUBLISHING PERMISSIONS */}
      {activeTab === 'PERMISSIONS' && (
        <div className="as-permissions-pane">
          {/* Header Callout Notice */}
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color, #334155)', marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>
              <Info size={15} style={{ display: 'inline', marginRight: 6, color: '#38bdf8', verticalAlign: '-2px' }} />
              As Class Mentor for <strong>Class {selectedSection?.class_number} Section {selectedSection?.section_name}</strong>, you decide which <strong>Primary Subject Teachers</strong> are authorized to publish assignments for this section. Alternate teachers are strictly prohibited by system rule.
            </p>
          </div>

          {/* Feedback Notice */}
          {permissionFeedback && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 16,
                background: permissionFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: permissionFeedback.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                color: permissionFeedback.type === 'success' ? '#34d399' : '#f87171',
                fontSize: 13
              }}
            >
              {permissionFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{permissionFeedback.message}</span>
            </div>
          )}

          {loadingPermissions ? (
            <div className="panel" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <p>Loading subject teacher permissions...</p>
            </div>
          ) : permissionError ? (
            <div className="panel" style={{ textAlign: 'center', padding: 30, color: '#ef4444' }}>
              <AlertCircle size={24} style={{ margin: '0 auto 10px' }} />
              <p>{permissionError}</p>
              <button type="button" className="btn-secondary" onClick={loadPermissions} style={{ marginTop: 12 }}>
                Retry Loading
              </button>
            </div>
          ) : permissions.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <Users size={28} style={{ margin: '0 auto 10px', opacity: 0.6 }} />
              <p>No subject teaching allocations found for this class and section.</p>
            </div>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color, #334155)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#94a3b8' }}>Subject</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#94a3b8' }}>Faculty Member</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#94a3b8' }}>Role Type</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#94a3b8' }}>Publishing Permission</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#94a3b8', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((item) => {
                    const key = `${item.subject_id}:${item.teacher_id}`;
                    const isPending = updatingId === key;

                    return (
                      <tr key={key} style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.05))' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main, #f8fafc)' }}>
                          {item.subject_name}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-main, #f8fafc)', fontWeight: 500 }}>
                          {item.teacher_name}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {item.is_primary ? (
                            <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                              Primary Teacher
                            </span>
                          ) : (
                            <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'rgba(148, 163, 184, 0.12)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.25)' }}>
                              Alternate Teacher
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {item.is_alternate ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                              <Lock size={12} /> Strictly Blocked
                            </span>
                          ) : item.is_authorized ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                              <Check size={12} /> Authorized to Publish
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'rgba(148, 163, 184, 0.12)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.25)' }}>
                              <Lock size={12} /> Not Authorized
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          {item.is_alternate ? (
                            <span style={{ fontSize: 11.5, color: '#64748b', fontStyle: 'italic' }}>Blocked by System Rule</span>
                          ) : (
                            <button
                              type="button"
                              className={item.is_authorized ? 'btn-secondary' : 'btn-primary'}
                              disabled={isPending}
                              onClick={() => handleTogglePermission(item)}
                              style={{ padding: '5px 12px', fontSize: 12.5, minWidth: 110 }}
                            >
                              {isPending ? 'Updating...' : item.is_authorized ? 'Revoke Access' : 'Authorize Publish'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: CLASS ATTENDANCE ANALYTICS */}
      {activeTab === 'ATTENDANCE' && (
        <div className="as-attendance-pane">
          {/* Date Filter Bar */}
          <div className="panel" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={15} /> Date Range:
                </span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color, #334155)', background: 'var(--bg-main, #0f172a)', color: 'var(--text-main, #f8fafc)', fontSize: 13 }}
                />
                <span style={{ color: '#64748b' }}>to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color, #334155)', background: 'var(--bg-main, #0f172a)', color: 'var(--text-main, #f8fafc)', fontSize: 13 }}
                />
                {(fromDate || toDate) && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setFromDate(''); setToDate(''); }}
                    style={{ padding: '5px 10px', fontSize: 12 }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 220 }}>
                <Search size={15} style={{ color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Filter student name or roll..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color, #334155)', background: 'var(--bg-main, #0f172a)', color: 'var(--text-main, #f8fafc)', fontSize: 13 }}
                />
              </div>
            </div>
          </div>

          {loadingAttendance ? (
            <div className="panel" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <p>Calculating attendance metrics for Class {selectedSection?.class_number} Section {selectedSection?.section_name}...</p>
            </div>
          ) : attendanceError ? (
            <div className="panel" style={{ textAlign: 'center', padding: 30, color: '#ef4444' }}>
              <AlertCircle size={24} style={{ margin: '0 auto 10px' }} />
              <p>{attendanceError}</p>
              <button type="button" className="btn-secondary" onClick={loadAttendance} style={{ marginTop: 12 }}>
                Retry Analysis
              </button>
            </div>
          ) : attendanceData ? (
            <>
              {/* Summary Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div className="panel" style={{ padding: '16px 20px', margin: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Enrolled Students</span>
                  <h2 style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 0', color: 'var(--text-main, #f8fafc)' }}>
                    {attendanceData.total_students}
                  </h2>
                </div>
                <div className="panel" style={{ padding: '16px 20px', margin: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase' }}>Overall Attendance Rate</span>
                  <h2 style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 0', color: '#38bdf8' }}>
                    {attendanceData.overall_percentage}%
                  </h2>
                </div>
                <div className="panel" style={{ padding: '16px 20px', margin: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981', textTransform: 'uppercase' }}>Total Present Days</span>
                  <h2 style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 0', color: '#10b981' }}>
                    {attendanceData.students.reduce((acc, r) => acc + (Number(r.present_days) || 0), 0)}
                  </h2>
                </div>
                <div className="panel" style={{ padding: '16px 20px', margin: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#f43f5e', textTransform: 'uppercase' }}>Total Absent Days</span>
                  <h2 style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 0', color: '#f43f5e' }}>
                    {attendanceData.students.reduce((acc, r) => acc + (Number(r.absent_days) || 0), 0)}
                  </h2>
                </div>
              </div>

              {/* Student Attendance Breakdown Table */}
              <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color, #334155)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-main, #f8fafc)' }}>
                    Student Attendance Breakdown ({filteredStudents.length})
                  </h3>
                </div>
                {filteredStudents.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                    No student attendance records matching search filter.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color, #334155)' }}>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#94a3b8' }}>Roll No.</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#94a3b8' }}>Student Name</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#94a3b8' }}>Days Present</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#94a3b8' }}>Days Absent</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#94a3b8' }}>Total Marked</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#94a3b8', textAlign: 'right' }}>Attendance %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map(st => {
                        const pct = Number(st.attendance_percentage || 0);
                        const isLow = pct < 75;

                        return (
                          <tr key={st.student_id} style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.05))' }}>
                            <td style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600 }}>{st.roll || '—'}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-main, #f8fafc)' }}>{st.student_name}</td>
                            <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 600 }}>{st.present_days}</td>
                            <td style={{ padding: '12px 16px', color: '#f43f5e', fontWeight: 600 }}>{st.absent_days}</td>
                            <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{st.marked_days}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <span style={{ fontWeight: 700, color: isLow ? '#f43f5e' : '#34d399' }}>
                                {pct}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default ClassMentorWorkspace;
