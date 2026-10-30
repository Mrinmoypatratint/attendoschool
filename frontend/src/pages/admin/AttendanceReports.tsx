import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  Users,
  BarChart3,
  Search,
  ChevronDown,
  Edit2,
  RefreshCw
} from 'lucide-react';
import { TableSubToolbar, TablePaginationFooter } from '../../components/TablePagination';
import { PersonProfileLink } from '../../components/PersonProfileLink';

type Row = {
  student_id: string;
  student_name: string;
  roll: string | number;
  class_name?: string;
  class_id?: string;
  section_name?: string;
  section_id?: string;
  academic_year_id?: string;
  session_name?: string;
  session?: string;
  present_days: number;
  absent_days: number;
  left_early_days?: number;
  marked_days: number;
  attendance_percentage: number;
};

export default function AttendanceReports() {
  const { user } = useAuth();
  if (user?.role === 'SUPER_ADMIN') {
    return <Navigate to="/super-admin/reports" replace />;
  }

  // Dates
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setDate(1);
  const [from, setFrom] = useState(fromDate.toISOString().slice(0, 10));
  const [toDate, setTo] = useState(to);

  // Multi-Dimensional Filters
  const [selectedSession, setSelectedSession] = useState('ALL');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Metadata Options
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);

  // Report Data
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastNotice, setToastNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(new Date());
  const tableTopRef = useRef<HTMLDivElement>(null);

  // Combined Export Dropdown State
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Submit Pop Screen / Preview Modal State
  const [showSubmitPop, setShowSubmitPop] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  // Offline Attendance Import Modal State
  const [importOpen, setImportOpen] = useState(false);
  const [importClass, setImportClass] = useState('');
  const [importSection, setImportSection] = useState('A');
  const [importDate, setImportDate] = useState(to);
  const [parsedRecords, setParsedRecords] = useState<any[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load Sessions, Classes, Sections, Students
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const [dashRes, clsRes, secRes, stRes, ayRes] = await Promise.all([
          api.get('/dashboard/school').catch(() => ({ data: {} })),
          api.get('/classes').catch(() => ({ data: [] })),
          api.get('/sections').catch(() => ({ data: [] })),
          api.get('/students').catch(() => ({ data: [] })),
          api.get('/academic-years').catch(() => ({ data: [] }))
        ]);

        if (Array.isArray(ayRes.data) && ayRes.data.length > 0) {
          setSessions(ayRes.data);
        } else if (dashRes.data?.academicYears && Array.isArray(dashRes.data.academicYears)) {
          setSessions(dashRes.data.academicYears);
        } else {
          setSessions([
            { id: 'ay-2025-26', name: '2025–26 Academic Session' },
            { id: 'ay-2026-27', name: '2026–27 Academic Session' }
          ]);
        }

        const rawCls = Array.isArray(clsRes.data) && clsRes.data.length > 0 ? clsRes.data : [
          { id: 'cls-lkg', class_number: -1, label: 'Class L KG' },
          { id: 'cls-ukg', class_number: 0, label: 'Class U KG' },
          ...Array.from({ length: 12 }, (_, i) => ({ id: `cls-${i + 1}`, class_number: i + 1, label: `Class ${i + 1}` }))
        ];
        const clsList = [...rawCls].sort((a: any, b: any) => {
          const aNum = a.class_number !== undefined ? Number(a.class_number) : Number(a.id);
          const bNum = b.class_number !== undefined ? Number(b.class_number) : Number(b.id);
          if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
          return 0;
        });
        setClasses(clsList);
        if (clsList.length > 0 && !importClass) {
          setImportClass(clsList[0].id || 'cls-10');
        }

        const secList = Array.isArray(secRes.data) && secRes.data.length > 0 ? secRes.data : [
          { id: 'sec-a', name: 'A' },
          { id: 'sec-b', name: 'B' }
        ];
        setSections(secList);

        if (Array.isArray(stRes.data)) {
          setEnrolledStudents(stRes.data);
        }
      } catch (err) {
        console.warn('Failed to load filter metadata:', err);
      }
    }
    fetchMetadata();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [s, r] = await Promise.all([
        api.get('/attendance-reports/summary', { params: { from, to: toDate } }),
        api.get('/attendance-reports/students', { params: { from, to: toDate } })
      ]);
      setSummary(s.data);
      setRows(Array.isArray(r.data) ? r.data : []);
      setLastFetchedAt(new Date());
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Unable to load report');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedClass, selectedSection, selectedSession, from, toDate]);

  useEffect(() => {
    load();
  }, [from, toDate]);

  // Quick Preset Handlers
  const handleQuickPreset = (preset: 'today' | 'this_week' | 'this_month' | 'last_30') => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (preset === 'today') {
      setFrom(todayStr);
      setTo(todayStr);
    } else if (preset === 'this_week') {
      const first = new Date(now.setDate(now.getDate() - now.getDay()));
      setFrom(first.toISOString().slice(0, 10));
      setTo(new Date().toISOString().slice(0, 10));
    } else if (preset === 'this_month') {
      setFrom(todayStr.slice(0, 8) + '01');
      setTo(todayStr);
    } else if (preset === 'last_30') {
      const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      setFrom(past.toISOString().slice(0, 10));
      setTo(todayStr);
    }
  };

  // Helper to extract numeric class index or normalized label
  const extractClassNumber = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    const s = String(val).trim().toLowerCase();
    if (s === 'l-kg' || s === 'lkg') return -1;
    if (s === 'u-kg' || s === 'ukg') return 0;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return null;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    const m = s.match(/^(?:class|cls|grade)[-\s]*(\d+)$/i);
    return m ? parseInt(m[1], 10) : null;
  };

  // Helper to normalize section to single uppercase letter or name
  const normalizeSection = (val: any): string => {
    return String(val || '')
      .replace(/^sec(tion)?[-_\s]*/i, '')
      .trim()
      .toUpperCase();
  };

  const isClassMatch = (selectedCls: string, r: any): boolean => {
    if (!selectedCls || selectedCls === 'ALL') return true;

    const selectedClsObj = classes.find(c => c.id === selectedCls || String(c.class_number) === String(selectedCls));

    // Target class number
    let targetNum: number | null = null;
    if (selectedClsObj?.class_number !== undefined && selectedClsObj?.class_number !== null && !isNaN(Number(selectedClsObj.class_number))) {
      targetNum = Number(selectedClsObj.class_number);
    } else {
      targetNum = extractClassNumber(selectedCls);
    }

    // Row class number
    let rowNum: number | null = null;
    if (r.class_number !== undefined && r.class_number !== null && !isNaN(Number(r.class_number))) {
      rowNum = Number(r.class_number);
    } else if (r.class_id) {
      const rowClsObj = classes.find(c => c.id === r.class_id);
      if (rowClsObj?.class_number !== undefined && rowClsObj?.class_number !== null && !isNaN(Number(rowClsObj.class_number))) {
        rowNum = Number(rowClsObj.class_number);
      }
    }
    if (rowNum === null) {
      rowNum = extractClassNumber(r.class_name || r.className);
    }

    // 1. Direct ID match
    if (r.class_id && (r.class_id === selectedCls || (selectedClsObj && r.class_id === selectedClsObj.id))) {
      return true;
    }

    // 2. Strict numeric comparison (Class 1 must never match Class 12, Class 10, etc.)
    if (targetNum !== null && rowNum !== null) {
      return targetNum === rowNum;
    }

    // 3. Exact normalized label match for special classes (e.g. "L-KG", "U-KG")
    const targetLabel = (selectedClsObj?.label || (targetNum !== null ? `Class ${targetNum}` : selectedCls)).trim().toLowerCase();
    const rowLabel = String(r.class_name || r.className || '').trim().toLowerCase();
    if (targetLabel && rowLabel && targetLabel === rowLabel) {
      return true;
    }

    return false;
  };

  const isSectionMatch = (selectedSec: string, r: any): boolean => {
    if (!selectedSec || selectedSec === 'ALL') return true;

    if (r.section_id && (r.section_id === selectedSec || sections.some(s => s.id === selectedSec && s.id === r.section_id))) {
      return true;
    }

    const targetSec = normalizeSection(selectedSec);
    const rowSec = normalizeSection(r.section_name || r.section);
    return targetSec !== '' && rowSec !== '' && targetSec === rowSec;
  };

  // Multi-dimensional filtering logic
  const filteredRows = useMemo(() => {
    return rows.filter((r: any) => {
      // 1. Class filter
      if (!isClassMatch(selectedClass, r)) return false;

      // 2. Section filter
      if (!isSectionMatch(selectedSection, r)) return false;

      // 3. Academic Session filter
      if (selectedSession !== 'ALL') {
        const selectedSessObj = sessions.find(s => s.id === selectedSession);
        const sessName = (selectedSessObj?.name || selectedSession).toLowerCase();
        if (r.academic_year_id) {
          const directMatch = r.academic_year_id === selectedSession || (selectedSessObj && r.academic_year_id === selectedSessObj.id);
          if (!directMatch) {
            const rSessName = String(r.session || r.academic_year_name || '').toLowerCase();
            if (rSessName) {
              const sessYears: string[] = sessName.match(/\d{4}/g) || [];
              const sharesYear = sessYears.some(y => rSessName.includes(y));
              if (!sharesYear && !rSessName.includes(sessName)) return false;
            } else {
              return false;
            }
          }
        } else if (r.session) {
          if (!String(r.session).toLowerCase().includes(sessName)) return false;
        }
      }

      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (r.student_name || '').toLowerCase().includes(q);
        const rollMatch = String(r.roll || '').toLowerCase().includes(q);
        if (!nameMatch && !rollMatch) return false;
      }

      return true;
    });
  }, [rows, selectedClass, selectedSection, selectedSession, searchQuery, classes, sections, sessions]);

  // Compute 4 KPI totals dynamically from filtered rows
  const totalPresent = useMemo(() => {
    if (summary && summary.present > 0 && selectedClass === 'ALL' && selectedSection === 'ALL' && selectedSession === 'ALL' && !searchQuery.trim()) {
      return summary.present;
    }
    return filteredRows.reduce((acc, r) => acc + (Number(r.present_days) || 0), 0);
  }, [summary, filteredRows, selectedClass, selectedSection, selectedSession, searchQuery]);

  const totalAbsent = useMemo(() => {
    if (summary && summary.absent > 0 && selectedClass === 'ALL' && selectedSection === 'ALL' && selectedSession === 'ALL' && !searchQuery.trim()) {
      return summary.absent;
    }
    return filteredRows.reduce((acc, r) => acc + (Number(r.absent_days) || 0), 0);
  }, [summary, filteredRows, selectedClass, selectedSection, selectedSession, searchQuery]);

  const totalLeftEarly = useMemo(() => {
    if (summary && (summary.left_early !== undefined || summary.leftEarly !== undefined) && selectedClass === 'ALL' && selectedSection === 'ALL' && selectedSession === 'ALL' && !searchQuery.trim()) {
      return Number(summary.left_early ?? summary.leftEarly ?? 0);
    }
    return filteredRows.reduce((acc, r: any) => acc + (Number(r.left_early_days || r.leftEarlyDays || r.left_early || r.leftEarly) || 0), 0);
  }, [summary, filteredRows, selectedClass, selectedSection, selectedSession, searchQuery]);

  const totalMarked = useMemo(() => {
    if (summary && summary.marked > 0 && selectedClass === 'ALL' && selectedSection === 'ALL' && selectedSession === 'ALL' && !searchQuery.trim()) {
      return summary.marked;
    }
    return filteredRows.reduce((acc, r) => acc + (Number(r.marked_days) || 0), 0);
  }, [summary, filteredRows, selectedClass, selectedSection, selectedSession, searchQuery]);

  const overallPercentage = useMemo(() => {
    if (totalMarked > 0) {
      return Number(((totalPresent / totalMarked) * 100).toFixed(1));
    }
    return 0;
  }, [totalPresent, totalMarked]);

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / (pageSize || 25)));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = filteredRows.length === 0 ? 0 : (safeCurrentPage - 1) * (pageSize || 25);
  const endIdx = Math.min(startIdx + (pageSize || 25), filteredRows.length);
  const displayedRows = useMemo(() => {
    return filteredRows.slice(startIdx, endIdx);
  }, [filteredRows, startIdx, endIdx]);

  const scrollToTableTop = () => {
    if (tableTopRef.current) {
      tableTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Combined Export Handlers
  function getRowsForExport() {
    if (filteredRows.length > 0) return filteredRows;
    if (enrolledStudents.length > 0) {
      return enrolledStudents
        .filter(st => {
          if (!isClassMatch(selectedClass, st)) return false;
          if (!isSectionMatch(selectedSection, st)) return false;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const nameMatch = (st.name || st.fullName || '').toLowerCase().includes(q);
            const rollMatch = String(st.roll_number || st.roll || '').toLowerCase().includes(q);
            if (!nameMatch && !rollMatch) return false;
          }
          return true;
        })
        .map(st => ({
          student_name: st.name || st.fullName || 'Student',
          roll: st.roll_number || st.roll || '—',
          class_name: st.className || st.class_name || (st.class_number ? `Class ${st.class_number}` : '—'),
          section_name: st.section_name || st.section || '—',
          present_days: 0,
          absent_days: 0,
          left_early_days: 0,
          marked_days: 0,
          attendance_percentage: 0
        }));
    }
    return [];
  }

  function downloadCsv() {
    setExportDropdownOpen(false);
    const header = ['Student Name', 'Roll Number', 'Class', 'Section', 'Present Days', 'Absent Days', 'Left Early Days', 'Total Marked', 'Attendance Rate (%)'];
    const exportData = getRowsForExport();

    const body = exportData.length > 0
      ? exportData.map((r: any) => [
          r.student_name,
          r.roll,
          r.class_name || '—',
          r.section_name || '—',
          r.present_days || 0,
          r.absent_days || 0,
          r.left_early_days || 0,
          r.marked_days || 0,
          `${r.attendance_percentage || 0}%`
        ])
      : [['No attendance records found matching this criteria', '', '', '', 0, 0, 0, 0, '0%']];

    const totalRow = [
      'Total / Average',
      '',
      '',
      '',
      totalPresent,
      totalAbsent,
      totalLeftEarly,
      totalMarked,
      `${overallPercentage}%`
    ];

    const csv = [header, ...body, totalRow].map(line => line.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${from}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadExcel() {
    setExportDropdownOpen(false);
    const exportData = getRowsForExport();

    const data = exportData.length > 0
      ? exportData.map((r: any) => ({
          'Student Name': r.student_name,
          'Roll Number': r.roll,
          'Class': r.class_name || '—',
          'Section': r.section_name || '—',
          'Present Days': r.present_days || 0,
          'Absent Days': r.absent_days || 0,
          'Left Early Days': r.left_early_days || 0,
          'Total Marked': r.marked_days || 0,
          'Attendance Rate (%)': `${r.attendance_percentage || 0}%`
        }))
      : [{
          'Student Name': 'No attendance records found matching this criteria',
          'Roll Number': '',
          'Class': '',
          'Section': '',
          'Present Days': 0,
          'Absent Days': 0,
          'Left Early Days': 0,
          'Total Marked': 0,
          'Attendance Rate (%)': '0%'
        }];

    data.push({
      'Student Name': 'TOTAL / INSTITUTIONAL AVERAGE',
      'Roll Number': '',
      'Class': '',
      'Section': '',
      'Present Days': totalPresent,
      'Absent Days': totalAbsent,
      'Left Early Days': totalLeftEarly,
      'Total Marked': totalMarked,
      'Attendance Rate (%)': `${overallPercentage}%`
    } as any);

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 26 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
    XLSX.writeFile(wb, `attendance-report-${from}-to-${toDate}.xlsx`);
  }

  // Final Confirmation from Popup Screen
  async function handleFinalSubmitFromPop() {
    setSubmittingReport(true);
    try {
      await load();
      setShowSubmitPop(false);
      setToastNotice({
        type: 'success',
        message: `Attendance report verified and confirmed for period ${from} to ${toDate} (${filteredRows.length} students).`
      });
    } catch {
      // handled in load()
    } finally {
      setSubmittingReport(false);
    }
  }

  // Download Sample Offline Attendance Template (.xlsx)
  function downloadOfflineTemplate() {
    const sample = [
      { 'Admission Number': 'ADM-2026-001', 'Student Name': 'Aarav Sharma', 'Status': 'P', 'Date': to },
      { 'Admission Number': 'ADM-2026-002', 'Student Name': 'Ananya Verma', 'Status': 'A', 'Date': to },
      { 'Admission Number': 'ADM-2026-003', 'Student Name': 'Rohan Gupta', 'Status': 'L', 'Date': to },
      { 'Admission Number': 'ADM-2026-004', 'Student Name': 'Diya Sen', 'Status': 'HD', 'Date': to }
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    ws['!cols'] = [{ wch: 20 }, { wch: 24 }, { wch: 12 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Offline Attendance');
    XLSX.writeFile(wb, 'offline_attendance_template.xlsx');
  }

  // Handle Offline Attendance File Parse
  function handleOfflineFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet);

        if (!rawJson.length) {
          alert('Uploaded file is empty.');
          return;
        }

        const validated = rawJson.map((row, idx) => {
          const admNo = String(row['Admission Number'] || row['Admission No'] || row['Roll Number'] || row.admissionNumber || row.roll || '').trim();
          const name = String(row['Student Name'] || row.studentName || row.name || '').trim();
          const rawStatus = String(row['Status'] || row.status || 'P').trim().toUpperCase();
          const recDate = String(row['Date'] || row.date || importDate).trim();

          let status = 'P';
          let statusLabel = 'Present';
          if (rawStatus === 'A' || rawStatus.startsWith('ABS')) {
            status = 'A';
            statusLabel = 'Absent';
          } else if (rawStatus === 'L' || rawStatus.startsWith('LAT')) {
            status = 'L';
            statusLabel = 'Late';
          } else if (rawStatus === 'HD' || rawStatus.includes('HALF')) {
            status = 'HD';
            statusLabel = 'Half Day';
          }

          const studentMatch = enrolledStudents.find(st =>
            (admNo && (st.admission_number === admNo || String(st.roll_number) === admNo)) ||
            (name && st.name && st.name.toLowerCase() === name.toLowerCase())
          );

          return {
            rowNum: idx + 1,
            admissionNumber: admNo || (studentMatch?.admission_number || '—'),
            studentName: name || (studentMatch?.name || 'Student'),
            status,
            statusLabel,
            date: recDate,
            isValid: Boolean(admNo || name),
            isMatched: Boolean(studentMatch)
          };
        });

        setParsedRecords(validated);
        setShowImportPreview(true);
      } catch (err: any) {
        alert('Failed to parse spreadsheet: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Attendance Breakdown Computed
  const importBreakdown = useMemo(() => {
    const total = parsedRecords.length;
    const present = parsedRecords.filter(r => r.status === 'P').length;
    const absent = parsedRecords.filter(r => r.status === 'A').length;
    const late = parsedRecords.filter(r => r.status === 'L').length;
    const halfDay = parsedRecords.filter(r => r.status === 'HD').length;
    return { total, present, absent, late, halfDay };
  }, [parsedRecords]);

  // Submit Offline Attendance
  async function submitOfflineAttendance() {
    if (!parsedRecords.length) return;
    const invalidRow = parsedRecords.find(r => !r.isValid);
    if (invalidRow) {
      alert(`Cannot submit attendance: Row #${invalidRow.rowNum} is missing admission number and student name.\n\nAll records must have valid student identification. No partial attendance will be stored.`);
      return;
    }
    setImporting(true);
    try {
      const payload = {
        classId: importClass,
        sectionId: importSection,
        date: importDate,
        records: parsedRecords.map(r => ({
          admissionNumber: r.admissionNumber,
          studentName: r.studentName,
          status: r.status,
          date: r.date
        }))
      };

      await api.post('/attendance-reports/import-offline', payload);
      setToastNotice({
        type: 'success',
        message: `Offline attendance successfully recorded for ${parsedRecords.length} students on ${importDate}. Daily attendance records upserted.`
      });
      setImportOpen(false);
      setParsedRecords([]);
      setShowImportPreview(false);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to submit offline attendance';
      alert(`Import Failed: ${msg}\n\nThe entire operation was cancelled and no attendance records were saved in the database.`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="feature-page" style={{ padding: '24px 28px', maxWidth: 1380, margin: '0 auto' }}>
      {/* ─── Header: Title & Right Corner Controls ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text, #0f172a)' }}>Attendance Reports</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
            Student-wise attendance verified from institutional Firestore logs.
          </p>
        </div>

        {/* Right Corner Buttons: Combined Export Report & Import Excel/CSV */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Refresh Button */}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              padding: '7px 14px',
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>

          {/* Combined Export Button with Dropdown */}
          <div ref={exportDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              id="export-report-btn"
              onClick={() => setExportDropdownOpen(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                padding: '7px 14px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: exportDropdownOpen ? '#eff6ff' : '#ffffff',
                border: '1px solid #2563eb',
                color: '#2563eb',
                borderRadius: 6,
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#eff6ff';
                e.currentTarget.style.borderColor = '#1d4ed8';
              }}
              onMouseLeave={e => {
                if (!exportDropdownOpen) {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#2563eb';
                }
              }}
              title="Export report in Excel (.xlsx) or CSV (.csv) format"
            >
              <Download size={15} color="#2563eb" /> Export Report <ChevronDown size={14} />
            </button>

            {exportDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                backgroundColor: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: 8,
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                zIndex: 100,
                minWidth: 200,
                overflow: 'hidden'
              }}>
                <button
                  type="button"
                  onClick={downloadExcel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '10px 14px',
                    border: 'none',
                    background: 'none',
                    fontSize: 13,
                    color: 'var(--text, #1e293b)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--card-subtle, #f8fafc)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FileSpreadsheet size={16} color="#10b981" />
                  <span>Export as Excel (.xlsx)</span>
                </button>
                <div style={{ height: 1, backgroundColor: 'var(--border, #f1f5f9)' }} />
                <button
                  type="button"
                  onClick={downloadCsv}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '10px 14px',
                    border: 'none',
                    background: 'none',
                    fontSize: 13,
                    color: 'var(--text, #1e293b)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--card-subtle, #f8fafc)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Download size={16} color="#3b82f6" />
                  <span>Export as CSV (.csv)</span>
                </button>
              </div>
            )}
          </div>

          {/* Import Excel / CSV Button */}
          <button
            type="button"
            onClick={() => { setShowImportPreview(false); setImportOpen(true); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#10b981',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              padding: '7px 14px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer'
            }}
            title="Upload offline attendance spreadsheet"
          >
            <UploadCloud size={16} /> Import Excel / CSV
          </button>
        </div>
      </div>

      {toastNotice && (
        <div style={{
          padding: '10px 14px',
          marginBottom: 16,
          backgroundColor: toastNotice.type === 'error' ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${toastNotice.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
          borderRadius: 6,
          color: toastNotice.type === 'error' ? '#991b1b' : '#166534',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{toastNotice.message}</span>
          <button onClick={() => setToastNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* ─── Multi-Dimensional Filter Bar ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 12,
        backgroundColor: 'var(--card-subtle, #f8fafc)',
        padding: '14px 16px',
        borderRadius: 8,
        border: '1px solid var(--border, #e2e8f0)',
        marginBottom: 20
      }}>
        {/* Academic Session */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
          <span>Academic Session</span>
          <select
            value={selectedSession}
            onChange={e => setSelectedSession(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', fontSize: 13, backgroundColor: 'var(--bg-card, #ffffff)', color: 'var(--text, #0f172a)' }}
          >
            <option value="ALL">All Academic Sessions</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        {/* Class Grade */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
          <span>Class Grade</span>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', fontSize: 13, backgroundColor: 'var(--bg-card, #ffffff)', color: 'var(--text, #0f172a)' }}
          >
            <option value="ALL">All Classes</option>
            {classes.map(c => {
              const num = c.class_number !== undefined ? Number(c.class_number) : (c.classNumber !== undefined ? Number(c.classNumber) : null);
              const label = num === -1 || /l.?kg/i.test(String(c.label || c.id || '')) ? 'Class L KG' :
                num === 0 || /u.?kg/i.test(String(c.label || c.id || '')) ? 'Class U KG' :
                (c.label || (num !== null ? `Class ${num}` : c.id));
              return <option key={c.id} value={c.id}>{label}</option>;
            })}
          </select>
        </label>

        {/* Section */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
          <span>Section</span>
          <select
            value={selectedSection}
            onChange={e => setSelectedSection(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', fontSize: 13, backgroundColor: 'var(--bg-card, #ffffff)', color: 'var(--text, #0f172a)' }}
          >
            <option value="ALL">All Sections</option>
            {Array.from(new Set(['A', 'B', ...sections.map(s => String(s.name || s.section_name || '').replace(/^sec(tion)?[-_\s]*/i, '').trim().toUpperCase()).filter(Boolean)])).map(sec => (
              <option key={sec} value={sec}>Section {sec}</option>
            ))}
          </select>
        </label>

        {/* Search */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
          <span>Search Student</span>
          <div style={{ position: 'relative' }}>
            <input
              placeholder="Name or roll number…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '7px 10px 7px 28px', borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', fontSize: 13, backgroundColor: 'var(--bg-card, #ffffff)', color: 'var(--text, #0f172a)', boxSizing: 'border-box' }}
            />
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        </label>

        {/* From Date */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
          <span>From Date</span>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', fontSize: 13, backgroundColor: 'var(--bg-card, #ffffff)', color: 'var(--text, #0f172a)' }}
          />
        </label>

        {/* To Date */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
          <span>To Date</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setTo(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', fontSize: 13, backgroundColor: 'var(--bg-card, #ffffff)', color: 'var(--text, #0f172a)' }}
          />
        </label>
      </div>

      {/* Quick Date Presets */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>Quick Presets:</span>
        {(['today', 'this_week', 'this_month', 'last_30'] as const).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => handleQuickPreset(p)}
            style={{
              padding: '3px 10px',
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid var(--border, #cbd5e1)',
              backgroundColor: 'var(--card-subtle, #f8fafc)',
              color: 'var(--text, #334155)',
              cursor: 'pointer'
            }}
          >
            {p === 'today' ? 'Today' : p === 'this_week' ? 'This Week' : p === 'this_month' ? 'This Month' : 'Last 30 Days'}
          </button>
        ))}
      </div>

      {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ─── 5 Separate KPI Cards Side-by-Side ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 20
      }}>
        {/* Present Card */}
        <div style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: 8,
          border: '1px solid var(--border, #bbf7d0)',
          borderLeft: '4px solid #10b981',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', letterSpacing: '0.04em' }}>PRESENT</span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #0f172a)' }}>{totalPresent}</div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>Total present days recorded</span>
        </div>

        {/* Absent Card */}
        <div style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: 8,
          border: '1px solid var(--border, #fecaca)',
          borderLeft: '4px solid #ef4444',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', letterSpacing: '0.04em' }}>ABSENT</span>
            <AlertCircle size={18} color="#ef4444" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #0f172a)' }}>{totalAbsent}</div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>Total absent days recorded</span>
        </div>

        {/* Left Early Card */}
        <div style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: 8,
          border: '1px solid var(--border, #fed7aa)',
          borderLeft: '4px solid #f97316',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316', letterSpacing: '0.04em' }}>LEFT EARLY</span>
            <Clock size={18} color="#f97316" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #0f172a)' }}>{totalLeftEarly}</div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>Total early departures recorded</span>
        </div>

        {/* Marked Attendance Card */}
        <div style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: 8,
          border: '1px solid var(--border, #bae6fd)',
          borderLeft: '4px solid #0284c7',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0284c7', letterSpacing: '0.04em' }}>MARKED ATTENDANCE</span>
            <Users size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #0f172a)' }}>{totalMarked}</div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>Total student sessions evaluated</span>
        </div>

        {/* Attendance % Card */}
        <div style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: 8,
          border: '1px solid var(--border, #c7d2fe)',
          borderLeft: '4px solid #6366f1',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', letterSpacing: '0.04em' }}>ATTENDANCE %</span>
            <BarChart3 size={18} color="#6366f1" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #0f172a)' }}>{overallPercentage}%</div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>Overall institutional rate</span>
        </div>
      </div>

      {/* ─── Table with Sub-Toolbar & Pagination ─── */}
      <div ref={tableTopRef} className="directory-box" style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, overflow: 'hidden', backgroundColor: 'var(--bg-card, #ffffff)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <TableSubToolbar
          onRefresh={load}
          loading={loading}
          lastFetchedAt={lastFetchedAt}
          pageSize={pageSize}
          onPageSizeChange={sz => { setPageSize(sz); setCurrentPage(1); scrollToTableTop(); }}
          totalCount={rows.length}
          filteredCount={filteredRows.length}
          startIdx={startIdx}
          endIdx={endIdx}
          itemLabel="students"
          pageSizeOptions={[10, 25, 50, 100, 250, 500]}
        />
        <div className="table-wrap" style={{ overflowX: 'auto', minHeight: 280 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--table-header, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>STUDENT</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>ROLL</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>CLASS</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>SECTION</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>PRESENT</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>ABSENT</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>LEFT EARLY</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>MARKED</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>ATTENDANCE %</th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((r, idx) => (
              <tr key={r.student_id || idx} style={{ borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                <td style={{ padding: '12px 14px', fontSize: 13.5, fontWeight: 600, color: 'var(--text, #1e293b)' }}><PersonProfileLink kind="student" id={r.student_id} name={r.student_name} person={{ ...r, roll_number: r.roll, roll: r.roll } as any} activeSession={sessions.find(s => s.id === selectedSession)?.name || sessions[0]?.name} /></td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted, #64748b)' }}>{r.roll}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary, #475569)' }}>{r.class_name || '-'}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary, #475569)' }}>{r.section_name || '-'}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: '#16a34a', fontWeight: 600 }}>{r.present_days}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: '#dc2626', fontWeight: 600 }}>{r.absent_days}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: '#ea580c', fontWeight: 600 }}>{r.left_early_days || 0}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text, #334155)' }}>{r.marked_days}</td>
                <td style={{ padding: '12px 14px', fontSize: 13.5, fontWeight: 700, color: 'var(--text, #0f172a)' }}>{r.attendance_percentage}%</td>
              </tr>
            ))}
            {!filteredRows.length && !loading && (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                  No attendance records found matching this criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

        {/* Bottom Pagination Footer (Matching User Screenshot 2: Showing X to Y of Z, << First, < Previous, Page [1] of N, Next >, Last >>) */}
        <TablePaginationFooter
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={p => { setCurrentPage(p); scrollToTableTop(); }}
          startIdx={startIdx}
          endIdx={endIdx}
          filteredCount={filteredRows.length}
          totalCount={rows.length}
          itemLabel="students"
          onScrollToTop={scrollToTableTop}
        />
      </div>

      {/* ─── Bottom Action Controls ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 16,
        gap: 12
      }}>
        {/* Bottom Right Submit Button: Opens Preview Pop Screen */}
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowSubmitPop(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            padding: '8px 22px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderRadius: 6,
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer'
          }}
          title="Open attendance preview and confirmation screen"
        >
          <Check size={15} /> Submit
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ─── POPUP SCREEN (PREVIEW WITH ATTENDANCE COUNT & EDIT/SUBMIT) ─── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {showSubmitPop && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div className="modal" style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: 10,
            maxWidth: 840,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            {/* Pop Screen Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                  Attendance Report Submission Preview
                </h2>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
                  Review attendance counts and student breakdown before finalizing submission.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSubmitPop(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted, #94a3b8)', padding: 0 }}
              >
                ×
              </button>
            </div>

            {/* Scope / Filter Details Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
              backgroundColor: 'var(--card-subtle, #f8fafc)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 16
            }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Period</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginTop: 2 }}>{from} to {toDate}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Academic Session</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginTop: 2 }}>
                  {selectedSession === 'ALL' ? 'All Sessions' : (sessions.find(s => s.id === selectedSession)?.name || selectedSession)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Class & Section</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #1e293b)', marginTop: 2 }}>
                  {selectedClass === 'ALL' ? 'All Classes' : (classes.find(c => c.id === selectedClass)?.label || selectedClass)}
                  {' — '}
                  {selectedSection === 'ALL' ? 'All Sections' : `Sec ${selectedSection}`}
                </div>
              </div>
            </div>

            {/* Attendance Count Breakdown in Pop Screen */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 12,
              marginBottom: 18
            }}>
              {/* Total Present Count */}
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 8,
                padding: '12px 14px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#10b981', letterSpacing: '0.04em' }}>PRESENT COUNT</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', marginTop: 2 }}>{totalPresent}</div>
                <span style={{ fontSize: 11, color: '#10b981' }}>Total Present Days</span>
              </div>

              {/* Total Absent Count */}
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                padding: '12px 14px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#ef4444', letterSpacing: '0.04em' }}>ABSENT COUNT</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', marginTop: 2 }}>{totalAbsent}</div>
                <span style={{ fontSize: 11, color: '#ef4444' }}>Total Absent Days</span>
              </div>

              {/* Total Marked Count */}
              <div style={{
                backgroundColor: 'rgba(2, 132, 199, 0.12)',
                border: '1px solid rgba(2, 132, 199, 0.3)',
                borderRadius: 8,
                padding: '12px 14px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0284c7', letterSpacing: '0.04em' }}>MARKED ATTENDANCE</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>{totalMarked}</div>
                <span style={{ fontSize: 11, color: '#0284c7' }}>Total Recorded Instances</span>
              </div>

              {/* Overall Attendance Percentage */}
              <div style={{
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 8,
                padding: '12px 14px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6366f1', letterSpacing: '0.04em' }}>ATTENDANCE RATE</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#6366f1', marginTop: 2 }}>{overallPercentage}%</div>
                <span style={{ fontSize: 11, color: '#6366f1' }}>Institutional Average</span>
              </div>
            </div>

            {/* Student Preview List in Pop Screen */}
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #0f172a)', marginBottom: 8 }}>
              Student Attendance Records ({filteredRows.length} Enrolled)
            </div>

            <div style={{
              maxHeight: 260,
              overflowY: 'auto',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: 6,
              marginBottom: 20
            }}>
              <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--table-header, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary, #475569)' }}>Student</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary, #475569)' }}>Roll</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary, #475569)' }}>Class</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary, #475569)' }}>Section</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary, #475569)' }}>Present</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary, #475569)' }}>Absent</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary, #475569)' }}>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => (
                    <tr key={r.student_id || i} style={{ borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text, #0f172a)' }}><PersonProfileLink kind="student" id={r.student_id} name={r.student_name} person={{ ...r, roll_number: r.roll, roll: r.roll } as any} activeSession={sessions.find(s => s.id === selectedSession)?.name || sessions[0]?.name} /></td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted, #64748b)' }}>{r.roll}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary, #475569)' }}>{r.class_name || '-'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary, #475569)' }}>{r.section_name || '-'}</td>
                      <td style={{ padding: '8px 12px', color: '#16a34a', fontWeight: 600 }}>{r.present_days}</td>
                      <td style={{ padding: '8px 12px', color: '#dc2626', fontWeight: 600 }}>{r.absent_days}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text, #0f172a)' }}>{r.attendance_percentage}%</td>
                    </tr>
                  ))}
                  {!filteredRows.length && (
                    <tr>
                      <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                        No attendance records for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Exactly Two Buttons at Bottom: Edit and Submit */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              borderTop: '1px solid var(--border, #e2e8f0)',
              paddingTop: 16
            }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowSubmitPop(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  padding: '9px 20px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Edit2 size={14} /> Edit
              </button>
              <button
                type="button"
                onClick={handleFinalSubmitFromPop}
                disabled={submittingReport}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  padding: '9px 24px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  borderRadius: 6,
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Check size={15} /> {submittingReport ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ─── OFFLINE ATTENDANCE SPREADSHEET IMPORT MODAL ─── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {importOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div className="modal" style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: 10,
            maxWidth: 780,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text, #0f172a)' }}>Import Offline Attendance Spreadsheet</h2>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-muted, #64748b)' }}>
                  Expected Columns: <code>Admission Number (or Roll Number), Student Name, Status (P, A, L, HD), Date (YYYY-MM-DD)</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setImportOpen(false); setParsedRecords([]); setShowImportPreview(false); }}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted, #94a3b8)', padding: 0 }}
              >
                ×
              </button>
            </div>

            {/* Target Class & Section Controls */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              backgroundColor: 'var(--card-subtle, #f8fafc)',
              padding: 14,
              borderRadius: 8,
              border: '1px solid var(--border, #e2e8f0)',
              marginBottom: 16
            }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
                <span>Target Class</span>
                <select
                  value={importClass}
                  onChange={e => setImportClass(e.target.value)}
                  style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', fontSize: 13, backgroundColor: 'var(--bg-card, #ffffff)', color: 'var(--text, #0f172a)' }}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.label || `Class ${c.class_number}`}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
                <span>Target Section</span>
                <select
                  value={importSection}
                  onChange={e => setImportSection(e.target.value)}
                  style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', fontSize: 13, backgroundColor: 'var(--bg-card, #ffffff)', color: 'var(--text, #0f172a)' }}
                >
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
                <span>Default Attendance Date</span>
                <input
                  type="date"
                  value={importDate}
                  onChange={e => setImportDate(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', fontSize: 13, backgroundColor: 'var(--bg-card, #ffffff)', color: 'var(--text, #0f172a)' }}
                />
              </label>
            </div>

            {/* Template Download Notice */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16
            }}>
              <span style={{ fontSize: 12.5, color: 'var(--text, #1e40af)' }}>
                Need the standard offline spreadsheet layout?
              </span>
              <button
                type="button"
                onClick={downloadOfflineTemplate}
                className="btn-secondary"
                style={{ fontSize: 12, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Download size={13} /> Download Sample Template (.xlsx)
              </button>
            </div>

            {/* Dropzone */}
            <label style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed var(--border, #cbd5e1)',
              borderRadius: 8,
              padding: '24px 16px',
              cursor: 'pointer',
              backgroundColor: 'var(--card-subtle, #f8fafc)',
              marginBottom: 16,
              textAlign: 'center'
            }}>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleOfflineFile}
                style={{ display: 'none' }}
              />
              <UploadCloud size={28} color="#0284c7" style={{ marginBottom: 8 }} />
              <strong style={{ fontSize: 14, color: 'var(--text, #0f172a)' }}>Click to select offline attendance file</strong>
              <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginTop: 4 }}>Supports Excel (.xlsx, .xls) and CSV (.csv)</span>
            </label>

            {/* ─── Interactive Staging Preview ─── */}
            {showImportPreview && parsedRecords.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #0f172a)', marginBottom: 8 }}>
                  Attendance Breakdown Preview
                </div>

                {/* Breakdown Mini Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 8,
                  marginBottom: 14
                }}>
                  <div style={{ padding: '8px 10px', borderRadius: 6, backgroundColor: 'var(--card-subtle, #f1f5f9)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>Total</div>
                    <strong style={{ fontSize: 16, color: 'var(--text, #0f172a)' }}>{importBreakdown.total}</strong>
                  </div>
                  <div style={{ padding: '8px 10px', borderRadius: 6, backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Present (P)</div>
                    <strong style={{ fontSize: 16, color: '#10b981' }}>{importBreakdown.present}</strong>
                  </div>
                  <div style={{ padding: '8px 10px', borderRadius: 6, backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>Absent (A)</div>
                    <strong style={{ fontSize: 16, color: '#ef4444' }}>{importBreakdown.absent}</strong>
                  </div>
                  <div style={{ padding: '8px 10px', borderRadius: 6, backgroundColor: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Late (L)</div>
                    <strong style={{ fontSize: 16, color: '#f59e0b' }}>{importBreakdown.late}</strong>
                  </div>
                  <div style={{ padding: '8px 10px', borderRadius: 6, backgroundColor: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#a855f7', fontWeight: 600 }}>Half Day (HD)</div>
                    <strong style={{ fontSize: 16, color: '#a855f7' }}>{importBreakdown.halfDay}</strong>
                  </div>
                </div>

                {/* Staging Records Table */}
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border, #e2e8f0)', borderRadius: 6, marginBottom: 16 }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--table-header, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-secondary, #475569)' }}>#</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-secondary, #475569)' }}>Adm / Roll</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-secondary, #475569)' }}>Student Name</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-secondary, #475569)' }}>Status</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-secondary, #475569)' }}>Date</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-secondary, #475569)' }}>Roster Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRecords.map(r => (
                        <tr key={r.rowNum} style={{ borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                          <td style={{ padding: '6px 10px', color: 'var(--text-muted, #64748b)' }}>{r.rowNum}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: 'var(--text, #0f172a)' }}>{r.admissionNumber}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text, #0f172a)' }}><PersonProfileLink kind="student" id={r.studentId} name={r.studentName} person={r as any} /></td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: r.status === 'P' ? '#dcfce7' : r.status === 'A' ? '#fee2e2' : r.status === 'L' ? '#fef9c3' : '#f3e8ff',
                              color: r.status === 'P' ? '#15803d' : r.status === 'A' ? '#b91c1c' : r.status === 'L' ? '#854d0e' : '#7e22ce'
                            }}>
                              {r.statusLabel} ({r.status})
                            </span>
                          </td>
                          <td style={{ padding: '6px 10px', color: '#64748b' }}>{r.date}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ fontSize: 11, color: r.isMatched ? '#16a34a' : '#d97706' }}>
                              {r.isMatched ? '✓ Enrolled' : '● Auto-map'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Submit / Confirm Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setParsedRecords([]); setShowImportPreview(false); }}
                  >
                    Clear Preview
                  </button>
                  <button
                    type="button"
                    onClick={submitOfflineAttendance}
                    disabled={importing}
                    style={{
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {importing ? 'Submitting…' : `Confirm & Submit Offline Attendance (${parsedRecords.length})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
