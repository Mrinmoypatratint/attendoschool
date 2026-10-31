import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users, ShieldCheck, FileText, RefreshCw, AlertCircle, Loader2,
  Calendar, Info, Search, BookOpen, ChevronDown, ChevronUp,
  FileCheck2, Sparkles, Filter
} from 'lucide-react';
import { api } from '../../api';
import { PersonProfileLink } from '../../components/PersonProfileLink';
import AttendanceReports from '../admin/AttendanceReports';

interface MentoredClass {
  mentor_record_id: string;
  class_id: string;
  section_id: string;
  class_number: number;
  section_name: string;
  assigned_at?: string;
}

interface TeacherAssignmentItem {
  id: string;
  title: string;
  assigned_date: string;
  due_date?: string;
  created_at?: string;
}

interface TeacherAssignmentOverview {
  school_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  role_type: string;
  is_primary: boolean;
  is_alternate: boolean;
  assignment_count: number;
  assignments: TeacherAssignmentItem[];
}

function formatStrict4DigitDate(val: string): string {
  if (!val) return '';
  const parts = val.trim().split('-');
  if (parts.length === 3) {
    let [y, m, d] = parts;
    if (y.length > 4) {
      y = y.slice(0, 4);
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  return val.trim();
}

export function ClassMentorWorkspace() {
  const [mentoredClasses, setMentoredClasses] = useState<MentoredClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Active Selected Section
  const [selectedSection, setSelectedSection] = useState<MentoredClass | null>(null);
  const [activeTab, setActiveTab] = useState<'ASSIGNMENTS' | 'REPORTS'>(
    tabParam === 'REPORTS' ? 'REPORTS' : 'ASSIGNMENTS'
  );

  useEffect(() => {
    if (tabParam === 'REPORTS') {
      setActiveTab('REPORTS');
    } else if (tabParam === 'PERMISSIONS' || tabParam === 'ASSIGNMENTS') {
      setActiveTab('ASSIGNMENTS');
    }
  }, [tabParam]);

  // Date Filters for Teacher Assignments Tracking
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const firstDayOfMonthStr = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }, []);

  const [fromDate, setFromDate] = useState<string>(firstDayOfMonthStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [activePreset, setActivePreset] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');

  // Teacher Assignments List State
  const [teachers, setTeachers] = useState<TeacherAssignmentOverview[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [teachersError, setTeachersError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

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

  // 2. Fetch Teacher Assignments for Selected Section with Date Filters
  const loadTeacherAssignments = useCallback(async () => {
    if (!selectedSection) return;
    setLoadingTeachers(true);
    setTeachersError(null);
    try {
      const params = new URLSearchParams();
      params.set('class_id', selectedSection.class_id);
      params.set('section_id', selectedSection.section_id);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await api.get(`/teacher/mentor/teacher-assignments?${params.toString()}`);
      setTeachers(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to load teacher assignments:', err);
      // Fallback to legacy permissions endpoint if needed
      try {
        const fallbackRes = await api.get(`/teacher/mentor/permissions?class_id=${selectedSection.class_id}&section_id=${selectedSection.section_id}`);
        const fallbackData = Array.isArray(fallbackRes.data) ? fallbackRes.data.map((p: any) => ({
          ...p,
          role_type: p.is_primary ? 'Primary Teacher' : 'Alternate Teacher',
          assignment_count: 0,
          assignments: []
        })) : [];
        setTeachers(fallbackData);
      } catch {
        setTeachersError(err?.response?.data?.message || 'Unable to fetch teacher assignments for this section.');
      }
    } finally {
      setLoadingTeachers(false);
    }
  }, [selectedSection, fromDate, toDate]);

  useEffect(() => {
    if (selectedSection && activeTab === 'ASSIGNMENTS') {
      loadTeacherAssignments();
    }
  }, [selectedSection, activeTab, loadTeacherAssignments]);

  // Preset filter handlers
  const handlePreset = (preset: 'today' | 'week' | 'month' | 'all') => {
    setActivePreset(preset);
    if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'week') {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff)).toISOString().slice(0, 10);
      setFromDate(monday);
      setToDate(todayStr);
    } else if (preset === 'month') {
      setFromDate(firstDayOfMonthStr);
      setToDate(todayStr);
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Filtered teachers by search query
  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers;
    const q = searchQuery.toLowerCase();
    return teachers.filter(t =>
      (t.teacher_name && t.teacher_name.toLowerCase().includes(q)) ||
      (t.subject_name && t.subject_name.toLowerCase().includes(q)) ||
      (t.role_type && t.role_type.toLowerCase().includes(q))
    );
  }, [teachers, searchQuery]);

  const totalAssignmentsCount = useMemo(() => {
    return filteredTeachers.reduce((acc, t) => acc + (t.assignment_count || 0), 0);
  }, [filteredTeachers]);

  if (loadingClasses) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>
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
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid var(--border-focus, rgba(56, 189, 248, 0.3))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sidebar-accent)', margin: '0 auto 16px' }}>
          <Users size={28} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
          No Class Mentor Assignments
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 24px' }}>
          You are not currently assigned as a Class Mentor for any class or section. Class Mentors oversee section attendance reports and subject teacher assignment activity.
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
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              Class Mentor Workspace
            </h1>
            <span style={{ fontSize: 11.5, fontWeight: 700, background: 'rgba(37, 99, 235, 0.1)', color: 'var(--sidebar-accent)', border: '1px solid var(--border-focus)', padding: '2px 8px', borderRadius: 9999 }}>
              Mentor Access
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Inspect subject teacher assignments and section attendance reports.
          </p>
        </div>

        {/* Section Switcher (Supports multiple mentored sections) */}
        {mentoredClasses.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Select Section:</span>
            <select
              value={`${selectedSection?.class_id}:${selectedSection?.section_id}`}
              onChange={e => {
                const [cId, sId] = e.target.value.split(':');
                const found = mentoredClasses.find(m => m.class_id === cId && m.section_id === sId);
                if (found) setSelectedSection(found);
              }}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}
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
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(56, 189, 248, 0.05))', border: '1px solid var(--border-focus, rgba(56, 189, 248, 0.3))', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={18} style={{ color: 'var(--sidebar-accent)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              Assigned Mentor for Class {selectedSection.class_number} — Section {selectedSection.section_name}
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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

      {/* Sub-Tab Navigation: Assignments vs Reports */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-strong)', marginBottom: 20, paddingBottom: 2 }}>
        <button
          type="button"
          onClick={() => { setActiveTab('ASSIGNMENTS'); setSearchParams({ tab: 'ASSIGNMENTS' }); }}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'ASSIGNMENTS' ? 'var(--sidebar-accent)' : 'var(--text-muted)',
            borderBottom: activeTab === 'ASSIGNMENTS' ? '2px solid var(--sidebar-accent)' : '2px solid transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <BookOpen size={16} /> Teacher Assignments
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('REPORTS'); setSearchParams({ tab: 'REPORTS' }); }}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'REPORTS' ? 'var(--sidebar-accent)' : 'var(--text-muted)',
            borderBottom: activeTab === 'REPORTS' ? '2px solid var(--sidebar-accent)' : '2px solid transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <FileText size={16} /> Reports
        </button>
      </div>

      {/* SUB-TAB 1: TEACHER ASSIGNMENTS OVERVIEW */}
      {activeTab === 'ASSIGNMENTS' && (
        <div className="as-teacher-assignments-pane">
          {/* Header Callout & Filters Bar */}
          <div className="panel" style={{ padding: '16px 20px', marginBottom: 20, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookOpen size={18} style={{ color: 'var(--sidebar-accent)' }} />
                  Subject Teacher Assignment Tracking
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                  All teachers taking classes for <strong>Class {selectedSection?.class_number} Section {selectedSection?.section_name}</strong> can publish assignments. Filter by date to inspect daily assignments given.
                </p>
              </div>

              {/* Stats badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.2)', fontSize: 12.5, fontWeight: 600, color: 'var(--sidebar-accent)' }}>
                  {filteredTeachers.length} Subject Teachers
                </div>
                <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: 12.5, fontWeight: 600, color: '#059669' }}>
                  {totalAssignmentsCount} Total Assignments
                </div>
              </div>
            </div>

            {/* Filter Controls Row */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              {/* Date Filter Inputs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>From:</span>
                <input
                  type="date"
                  min="1900-01-01"
                  max="2099-12-31"
                  value={fromDate}
                  onChange={e => {
                    setFromDate(formatStrict4DigitDate(e.target.value));
                    setActivePreset('custom');
                  }}
                  onBlur={e => setFromDate(formatStrict4DigitDate(e.target.value))}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>To:</span>
                <input
                  type="date"
                  min="1900-01-01"
                  max="2099-12-31"
                  value={toDate}
                  onChange={e => {
                    setToDate(formatStrict4DigitDate(e.target.value));
                    setActivePreset('custom');
                  }}
                  onBlur={e => setToDate(formatStrict4DigitDate(e.target.value))}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                />
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => handlePreset('today')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: activePreset === 'today' ? 'var(--sidebar-accent)' : 'var(--bg)',
                    color: activePreset === 'today' ? '#ffffff' : 'var(--text-secondary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('week')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: activePreset === 'week' ? 'var(--sidebar-accent)' : 'var(--bg)',
                    color: activePreset === 'week' ? '#ffffff' : 'var(--text-secondary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('month')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: activePreset === 'month' ? 'var(--sidebar-accent)' : 'var(--bg)',
                    color: activePreset === 'month' ? '#ffffff' : 'var(--text-secondary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('all')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: activePreset === 'all' ? 'var(--sidebar-accent)' : 'var(--bg)',
                    color: activePreset === 'all' ? '#ffffff' : 'var(--text-secondary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  All Time
                </button>
              </div>

              {/* Search Teacher or Subject */}
              <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 10px' }}>
                <Search size={14} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search teacher or subject..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text)', fontSize: 13, width: '100%', padding: '6px 0' }}
                />
              </div>

              {/* Refresh button */}
              <button
                type="button"
                className="btn-secondary"
                onClick={loadTeacherAssignments}
                disabled={loadingTeachers}
                style={{ padding: '6px 12px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={13} className={loadingTeachers ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {loadingTeachers ? (
            <div className="panel" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <p>Loading subject teachers and assignment activity...</p>
            </div>
          ) : teachersError ? (
            <div className="panel" style={{ textAlign: 'center', padding: 30, color: '#ef4444' }}>
              <AlertCircle size={24} style={{ margin: '0 auto 10px' }} />
              <p>{teachersError}</p>
              <button type="button" className="btn-secondary" onClick={loadTeacherAssignments} style={{ marginTop: 12 }}>
                Retry Loading
              </button>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <Users size={28} style={{ margin: '0 auto 10px', opacity: 0.6 }} />
              <p>No subject teaching allocations found matching your search.</p>
            </div>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: 'hidden', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50, rgba(255,255,255,0.03))', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Subject</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Faculty Member</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Role Type</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Assignments Given</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((item) => {
                    const key = `${item.subject_id}:${item.teacher_id}`;
                    const isExpanded = expandedKeys.has(key);
                    const count = item.assignment_count || 0;

                    return (
                      <React.Fragment key={key}>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: isExpanded ? 'rgba(37, 99, 235, 0.02)' : 'transparent' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text)' }}>
                            {item.subject_name}
                          </td>
                          <td style={{ padding: '14px 16px', color: 'var(--text)', fontWeight: 500 }}>
                            <PersonProfileLink kind="teacher" id={item.teacher_id} name={item.teacher_name} person={item as any} />
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {item.is_primary ? (
                              <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'rgba(37, 99, 235, 0.1)', color: 'var(--sidebar-accent)', border: '1px solid var(--border-focus)' }}>
                                Primary Teacher
                              </span>
                            ) : item.is_alternate ? (
                              <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--gray-100, rgba(148, 163, 184, 0.12))', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                                Alternate Teacher
                              </span>
                            ) : (
                              <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                Subject Teacher
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 10px',
                                  borderRadius: 9999,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  background: count > 0 ? 'rgba(16, 185, 129, 0.12)' : 'var(--gray-100, rgba(148, 163, 184, 0.1))',
                                  color: count > 0 ? '#059669' : 'var(--text-muted)',
                                  border: count > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border)'
                                }}
                              >
                                {count} {count === 1 ? 'Assignment' : 'Assignments'}
                              </span>

                              {count > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(key)}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--sidebar-accent)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    padding: '4px 8px',
                                    borderRadius: 6
                                  }}
                                  title={isExpanded ? 'Hide assignments' : 'View assignments'}
                                >
                                  {isExpanded ? 'Hide' : 'View'}
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Collapsible Assignment Details Row */}
                        {isExpanded && count > 0 && (
                          <tr style={{ background: 'var(--gray-50, rgba(255, 255, 255, 0.02))', borderBottom: '1px solid var(--border)' }}>
                            <td colSpan={4} style={{ padding: '12px 20px 16px' }}>
                              <div style={{ background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', padding: '12px 16px' }}>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <FileCheck2 size={14} style={{ color: 'var(--sidebar-accent)' }} />
                                  Assignments Published by {item.teacher_name} ({item.subject_name}):
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {item.assignments.map((asg, idx) => (
                                    <div
                                      key={asg.id || idx}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '8px 12px',
                                        borderRadius: 6,
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border)',
                                        fontSize: 12.5
                                      }}
                                    >
                                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                                        {asg.title || 'Untitled Assignment'}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--text-muted)', fontSize: 11.5 }}>
                                        {asg.assigned_date && (
                                          <span>Assigned: <strong>{asg.assigned_date}</strong></span>
                                        )}
                                        {asg.due_date && (
                                          <span>Due: <strong>{asg.due_date}</strong></span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: ATTENDANCE REPORTS */}
      {activeTab === 'REPORTS' && (
        <div className="as-reports-pane">
          <AttendanceReports
            embedded={true}
            defaultClassId={selectedSection?.class_id}
            defaultSectionId={selectedSection?.section_id}
            defaultClassNumber={selectedSection?.class_number}
            defaultSectionName={selectedSection?.section_name}
          />
        </div>
      )}
    </div>
  );
}

export default ClassMentorWorkspace;
