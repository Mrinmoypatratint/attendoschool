import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, ShieldCheck, ClipboardCheck, BarChart3, RefreshCw, AlertTriangle,
  CheckCircle2, AlertCircle, Loader2, Check, Lock, Calendar, Info, Search
} from 'lucide-react';
import { api } from '../../api';
import { PersonProfileLink } from '../../components/PersonProfileLink';

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
      <div className="panel p-12 text-center text-slate-500">
        <Loader2 size={28} className="animate-spin mx-auto mb-3 text-blue-600" />
        <p className="m-0 text-sm">Loading your Class Mentor workspace...</p>
      </div>
    );
  }

  if (classesError) {
    return (
      <div className="panel p-10 text-center text-red-500">
        <AlertCircle size={32} className="mx-auto mb-3" />
        <p className="font-semibold text-base m-0">{classesError}</p>
        <button type="button" className="btn-secondary mt-4 px-4 py-2 text-xs font-semibold rounded" onClick={loadMyClasses}>
          Retry Loading
        </button>
      </div>
    );
  }

  // EMPTY STATE: Logged-in teacher is not assigned as mentor for any section
  if (mentoredClasses.length === 0) {
    return (
      <div className="panel text-center p-14 max-w-xl mx-auto my-10">
        <div className="w-14 h-14 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 flex items-center justify-center text-sky-600 mx-auto mb-4">
          <Users size={28} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 m-0 mb-2">
          No Class Mentor Assignments
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed m-0 mb-6">
          You are not currently assigned as a Class Mentor for any class or section. Class Mentors are designated by your School Administration to oversee section attendance analytics and authorize subject teacher assignment publishing.
        </p>
        <button type="button" className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded" onClick={loadMyClasses}>
          <RefreshCw size={15} /> Check For New Assignments
        </button>
      </div>
    );
  }

  return (
    <div className="as-mentor-workspace">
      {/* Workspace Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold m-0 text-slate-900 dark:text-slate-100">
              Class Mentor Workspace
            </h1>
            <span className="text-[11.5px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full">
              Mentor Access
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-1">
            Manage subject teacher assignment-publishing permissions and inspect section attendance analytics.
          </p>
        </div>

        {/* Section Switcher (Supports multiple mentored sections) */}
        {mentoredClasses.length > 1 && (
          <div className="flex items-center gap-2.5 bg-white dark:bg-slate-800 p-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select Section:</span>
            <select
              value={`${selectedSection?.class_id}:${selectedSection?.section_id}`}
              onChange={e => {
                const [cId, sId] = e.target.value.split(':');
                const found = mentoredClasses.find(m => m.class_id === cId && m.section_id === sId);
                if (found) setSelectedSection(found);
              }}
              className="py-1 px-2.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold"
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
        <div className="p-3 px-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-sky-500/5 border border-sky-300 dark:border-sky-800/60 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Assigned Mentor for Class {selectedSection.class_number} — Section {selectedSection.section_name}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Section ID: {selectedSection.section_id.slice(0, 8)}...
          </span>
        </div>
      )}

      {/* Multi-Section Tabs */}
      {mentoredClasses.length > 1 && (
        <div className="student-tab-bar mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {mentoredClasses.map(m => (
            <button
              key={`${m.class_id}:${m.section_id}`}
              type="button"
              className={`student-tab-btn px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                selectedSection?.class_id === m.class_id && selectedSection?.section_id === m.section_id
                  ? 'active border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              onClick={() => setSelectedSection(m)}
            >
              Class {m.class_number} - Section {m.section_name}
            </button>
          ))}
        </div>
      )}

      {/* Sub-Tab Navigation: Permissions vs Attendance */}
      <div className="flex gap-3 border-b border-slate-200 dark:border-slate-700 mb-5 pb-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('PERMISSIONS')}
          className={`bg-transparent border-none py-2 px-4 text-sm font-semibold cursor-pointer inline-flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'PERMISSIONS'
              ? 'text-blue-600 dark:text-blue-400 border-blue-600'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 border-transparent'
          }`}
        >
          <ShieldCheck size={16} /> Assignment Publishing Permissions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ATTENDANCE')}
          className={`bg-transparent border-none py-2 px-4 text-sm font-semibold cursor-pointer inline-flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'ATTENDANCE'
              ? 'text-blue-600 dark:text-blue-400 border-blue-600'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 border-transparent'
          }`}
        >
          <BarChart3 size={16} /> Class Attendance Analytics
        </button>
      </div>

      {/* SUB-TAB 1: ASSIGNMENT PUBLISHING PERMISSIONS */}
      {activeTab === 'PERMISSIONS' && (
        <div className="as-permissions-pane">
          {/* Header Callout Notice */}
          <div className="p-3 px-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 mb-5">
            <p className="m-0 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <Info size={15} className="inline mr-1.5 text-blue-600 align-[-2px]" />
              As Class Mentor for <strong>Class {selectedSection?.class_number} Section {selectedSection?.section_name}</strong>, you decide which <strong>Primary Subject Teachers</strong> are authorized to publish assignments for this section. Alternate teachers are strictly prohibited by system rule.
            </p>
          </div>

          {/* Feedback Notice */}
          {permissionFeedback && (
            <div
              className={`flex items-center gap-2.5 p-2.5 px-3.5 rounded-lg mb-4 text-xs font-medium ${
                permissionFeedback.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/25 text-red-500'
              }`}
            >
              {permissionFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{permissionFeedback.message}</span>
            </div>
          )}

          {loadingPermissions ? (
            <div className="panel p-10 text-center text-slate-500">
              <Loader2 size={24} className="animate-spin mx-auto mb-2.5 text-blue-600" />
              <p className="m-0 text-xs">Loading subject teacher permissions...</p>
            </div>
          ) : permissionError ? (
            <div className="panel p-8 text-center text-red-500">
              <AlertCircle size={24} className="mx-auto mb-2.5" />
              <p className="m-0 text-xs">{permissionError}</p>
              <button type="button" className="btn-secondary mt-3 px-3 py-1.5 text-xs font-semibold rounded" onClick={loadPermissions}>
                Retry Loading
              </button>
            </div>
          ) : permissions.length === 0 ? (
            <div className="panel p-10 text-center text-slate-500">
              <Users size={28} className="mx-auto mb-2.5 opacity-60" />
              <p className="m-0 text-xs">No subject teaching allocations found for this class and section.</p>
            </div>
          ) : (
            <div className="panel p-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Subject</th>
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Faculty Member</th>
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Role Type</th>
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Publishing Permission</th>
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissions.map((item) => {
                      const key = `${item.subject_id}:${item.teacher_id}`;
                      const isPending = updatingId === key;

                      return (
                        <tr key={key} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="p-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                            {item.subject_name}
                          </td>
                          <td className="p-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                            <PersonProfileLink kind="teacher" id={item.teacher_id} name={item.teacher_name} person={item as any} />
                          </td>
                          <td className="p-3.5 px-4">
                            {item.is_primary ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                Primary Teacher
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                Alternate Teacher
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 px-4">
                            {item.is_alternate ? (
                              <span className="badge rejected normal-case rounded-md text-[11px] font-semibold px-2.5 py-1 inline-flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400">
                                <Lock size={12} /> Strictly Blocked
                              </span>
                            ) : item.is_authorized ? (
                              <span className="badge approved normal-case rounded-md text-[11px] font-semibold px-2.5 py-1 inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                <Check size={12} /> Authorized to Publish
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                <Lock size={12} /> Not Authorized
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 px-4 text-right">
                            {item.is_alternate ? (
                              <span className="text-[11px] text-slate-400 italic">Blocked by System Rule</span>
                            ) : (
                              <button
                                type="button"
                                className={`${item.is_authorized ? 'btn-secondary' : 'btn-primary'} px-3 py-1.5 text-xs font-semibold rounded cursor-pointer min-w-[110px] transition-colors`}
                                disabled={isPending}
                                onClick={() => handleTogglePermission(item)}
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
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: CLASS ATTENDANCE ANALYTICS */}
      {activeTab === 'ATTENDANCE' && (
        <div className="as-attendance-pane">
          {/* Date Filter Bar */}
          <div className="panel p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 mb-5 shadow-sm">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar size={15} /> Date Range:
                </span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="py-1 px-2.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="py-1 px-2.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                />
                {(fromDate || toDate) && (
                  <button
                    type="button"
                    className="btn-secondary px-2.5 py-1 text-xs rounded"
                    onClick={() => { setFromDate(''); setToDate(''); }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 min-w-[220px]">
                <Search size={15} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Filter student name or roll..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="w-full py-1.5 px-2.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {loadingAttendance ? (
            <div className="panel p-10 text-center text-slate-500">
              <Loader2 size={24} className="animate-spin mx-auto mb-2.5 text-blue-600" />
              <p className="m-0 text-xs">Calculating attendance metrics for Class {selectedSection?.class_number} Section {selectedSection?.section_name}...</p>
            </div>
          ) : attendanceError ? (
            <div className="panel p-8 text-center text-red-500">
              <AlertCircle size={24} className="mx-auto mb-2.5" />
              <p className="m-0 text-xs">{attendanceError}</p>
              <button type="button" className="btn-secondary mt-3 px-3.5 py-1.5 text-xs font-semibold rounded" onClick={loadAttendance}>
                Retry Analysis
              </button>
            </div>
          ) : attendanceData ? (
            <>
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <div className="panel p-4 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm m-0">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Enrolled Students</span>
                  <h2 className="text-2xl font-bold m-0 mt-1 text-slate-900 dark:text-slate-100">
                    {attendanceData.total_students}
                  </h2>
                </div>
                <div className="panel p-4 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm m-0">
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase">Overall Attendance Rate</span>
                  <h2 className="text-2xl font-bold m-0 mt-1 text-blue-600 dark:text-blue-400">
                    {attendanceData.overall_percentage}%
                  </h2>
                </div>
                <div className="panel p-4 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm m-0">
                  <span className="text-[11px] font-semibold text-emerald-600 uppercase">Total Present Days</span>
                  <h2 className="text-2xl font-bold m-0 mt-1 text-emerald-600">
                    {attendanceData.students.reduce((acc, r) => acc + (Number(r.present_days) || 0), 0)}
                  </h2>
                </div>
                <div className="panel p-4 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm m-0">
                  <span className="text-[11px] font-semibold text-red-600 uppercase">Total Absent Days</span>
                  <h2 className="text-2xl font-bold m-0 mt-1 text-red-600">
                    {attendanceData.students.reduce((acc, r) => acc + (Number(r.absent_days) || 0), 0)}
                  </h2>
                </div>
              </div>

              {/* Student Attendance Breakdown Table */}
              <div className="panel p-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                <div className="p-3.5 px-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="m-0 text-sm font-bold text-slate-900 dark:text-slate-100">
                    Student Attendance Breakdown ({filteredStudents.length})
                  </h3>
                </div>
                {filteredStudents.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No student attendance records matching search filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                          <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Roll No.</th>
                          <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Student Name</th>
                          <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Days Present</th>
                          <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Days Absent</th>
                          <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Total Marked</th>
                          <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-right">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map(st => {
                          const pct = Number(st.attendance_percentage || 0);
                          const isLow = pct < 75;

                          return (
                            <tr key={st.student_id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                              <td className="p-3 px-4 text-slate-500 font-semibold">{st.roll || '—'}</td>
                              <td className="p-3 px-4 font-semibold text-slate-900 dark:text-slate-100"><PersonProfileLink kind="student" id={st.student_id} name={st.student_name} person={st as any} /></td>
                              <td className="p-3 px-4 text-emerald-600 font-semibold">{st.present_days}</td>
                              <td className="p-3 px-4 text-red-600 font-semibold">{st.absent_days}</td>
                              <td className="p-3 px-4 text-slate-500">{st.marked_days}</td>
                              <td className="p-3 px-4 text-right">
                                <span className={`font-bold ${isLow ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {pct}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
