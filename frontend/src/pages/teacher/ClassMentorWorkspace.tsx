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
        <div className="p-3 px-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-sky-500/5 border border-blue-500/20 mb-5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Assigned Mentor for Class {selectedSection.class_number} — Section {selectedSection.section_name}
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Section ID: {selectedSection.section_id.slice(0, 8)}...
          </span>
        </div>
      )}

      {/* Multi-Section Tabs */}
      {mentoredClasses.length > 1 && (
        <div className="student-tab-bar mb-4">
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
      <div className="flex gap-3 border-b border-slate-200 dark:border-slate-700 mb-5 pb-0.5">
        <button
          type="button"
          onClick={() => { setActiveTab('ASSIGNMENTS'); setSearchParams({ tab: 'ASSIGNMENTS' }); }}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold cursor-pointer border-b-2 transition-colors ${activeTab === 'ASSIGNMENTS' ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <BookOpen size={16} /> Teacher Assignments
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('REPORTS'); setSearchParams({ tab: 'REPORTS' }); }}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold cursor-pointer border-b-2 transition-colors ${activeTab === 'REPORTS' ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <FileText size={16} /> Reports
        </button>
      </div>

      {/* SUB-TAB 1: TEACHER ASSIGNMENTS OVERVIEW */}
      {activeTab === 'ASSIGNMENTS' && (
        <div className="as-teacher-assignments-pane">
          {/* Header Callout & Filters Bar */}
          <div className="panel p-4 md:p-5 mb-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-center flex-wrap gap-3.5 mb-3.5">
              <div>
                <h3 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BookOpen size={18} className="text-blue-600 dark:text-blue-400" />
                  Subject Teacher Assignment Tracking
                </h3>
                <p className="mt-1 m-0 text-xs text-slate-500 dark:text-slate-400">
                  All teachers taking classes for <strong>Class {selectedSection?.class_number} Section {selectedSection?.section_name}</strong> can publish assignments. Filter by date to inspect daily assignments given.
                </p>
              </div>

              {/* Stats badges */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {filteredTeachers.length} Subject Teachers
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {totalAssignmentsCount} Total Assignments
                </div>
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="flex items-center flex-wrap gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              {/* Date Filter Inputs */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">From:</span>
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
                  className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">To:</span>
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
                  className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePreset('today')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer border transition-colors ${activePreset === 'today' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('week')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer border transition-colors ${activePreset === 'week' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('month')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer border transition-colors ${activePreset === 'month' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer border transition-colors ${activePreset === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                >
                  All Time
                </button>
              </div>

              {/* Search Teacher or Subject */}
              <div className="flex-1 min-w-[200px] flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-2.5 py-1">
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Search teacher or subject..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="border-none bg-transparent outline-none text-slate-900 dark:text-slate-100 text-xs w-full py-0.5"
                />
              </div>

              {/* Refresh button */}
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                onClick={loadTeacherAssignments}
                disabled={loadingTeachers}
              >
                <RefreshCw size={13} className={loadingTeachers ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {loadingTeachers ? (
            <div className="panel p-10 text-center text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <Loader2 size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-xs">Loading subject teachers and assignment activity...</p>
            </div>
          ) : teachersError ? (
            <div className="panel p-8 text-center text-red-500 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <AlertCircle size={24} className="mx-auto mb-2" />
              <p className="text-xs">{teachersError}</p>
              <button
                type="button"
                className="btn-secondary mt-3 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-semibold cursor-pointer"
                onClick={loadTeacherAssignments}
              >
                Retry Loading
              </button>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="panel p-10 text-center text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <Users size={28} className="mx-auto mb-2 opacity-60" />
              <p className="text-xs">No subject teaching allocations found matching your search.</p>
            </div>
          ) : (
            <div className="panel p-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <table className="w-full border-collapse text-left text-xs md:text-sm">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Subject</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Faculty Member</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Role Type</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 text-right">Assignments Given</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((item) => {
                    const key = `${item.subject_id}:${item.teacher_id}`;
                    const isExpanded = expandedKeys.has(key);
                    const count = item.assignment_count || 0;

                    return (
                      <React.Fragment key={key}>
                        <tr className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors ${isExpanded ? 'bg-blue-50/20 dark:bg-blue-950/20' : ''}`}>
                          <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                            {item.subject_name}
                          </td>
                          <td className="px-4 py-3.5 text-slate-800 dark:text-slate-200 font-medium">
                            <PersonProfileLink kind="teacher" id={item.teacher_id} name={item.teacher_name} person={item as any} />
                          </td>
                          <td className="px-4 py-3.5">
                            {item.is_primary ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Primary Teacher
                              </span>
                            ) : item.is_alternate ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
                                Alternate Teacher
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Subject Teacher
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="inline-flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                  count > 0
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                }`}
                              >
                                {count} {count === 1 ? 'Assignment' : 'Assignments'}
                              </span>

                              {count > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(key)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer transition-colors border-0 bg-transparent"
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
                          <tr className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800">
                            <td colSpan={4} className="px-5 py-3">
                              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                                  <FileCheck2 size={14} className="text-blue-600 dark:text-blue-400" />
                                  Assignments Published by {item.teacher_name} ({item.subject_name}):
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  {item.assignments.map((asg, idx) => (
                                    <div
                                      key={asg.id || idx}
                                      className="flex justify-between items-center p-2 rounded-md bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-700/70 text-xs"
                                    >
                                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                                        {asg.title || 'Untitled Assignment'}
                                      </div>
                                      <div className="flex items-center gap-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
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
