import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  X,
  Layers,
  Phone,
  Mail,
  Calendar,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../api';

export interface CompletenessSummary {
  totalStudents: number;
  completeProfiles: number;
  incompleteProfiles: number;
  totalMissingFields: number;
  completenessScore: number;
}

export interface FieldBreakdownItem {
  key: string;
  label: string;
  category: 'Academic' | 'Personal' | 'Parent/Guardian' | 'Contact';
  required: boolean;
  formFieldId: string;
  missingCount: number;
  completedCount: number;
  completionPercentage: number;
}

export interface IncompleteStudent {
  id: string;
  name: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  roll_number?: string;
  admission_number?: string;
  admission_date?: string;
  date_of_birth?: string;
  gender?: string;
  student_email?: string;
  parent_name?: string;
  parent_sms_number?: string;
  parent_whatsapp?: string;
  parent_email?: string;
  father_name?: string;
  father_phone?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_phone?: string;
  mother_occupation?: string;
  guardian_name?: string;
  address?: string;
  photo_url?: string;
  is_active?: boolean;
  class_id?: string;
  class_number?: number;
  class_name?: string;
  section_id?: string;
  section_name?: string;
  academic_year_id?: string;
  session_name?: string;
  missingFields: {
    key: string;
    label: string;
    category: string;
    formFieldId: string;
    required: boolean;
  }[];
  missingCount: number;
  isComplete: boolean;
}

interface StudentCompletenessTabProps {
  activeSession: string;
  classes: any[];
  sections: any[];
  sessions: any[];
  refreshTrigger?: number;
  onEditStudent: (student: IncompleteStudent, targetFieldKey?: string) => void;
  onSelectSession?: (sessionName: string) => void;
}

export const StudentCompletenessTab: React.FC<StudentCompletenessTabProps> = ({
  activeSession,
  classes,
  sections,
  refreshTrigger = 0,
  onEditStudent
}) => {
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [summary, setSummary] = useState<CompletenessSummary | null>(null);
  const [fieldBreakdown, setFieldBreakdown] = useState<FieldBreakdownItem[]>([]);
  const [students, setStudents] = useState<IncompleteStudent[]>([]);
  const [totalStudentsCount, setTotalStudentsCount] = useState(0);

  // Filters
  const [selectedFieldFilter, setSelectedFieldFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [sectionFilter, setSectionFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [includeOptional, setIncludeOptional] = useState<boolean>(false);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Export State
  const [exporting, setExporting] = useState<boolean>(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedFieldFilter, classFilter, sectionFilter, includeOptional, activeSession]);

  /**
   * Fetch Dashboard Completeness Summary & Breakdown
   */
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const sessParam = activeSession
        ? `?session=${encodeURIComponent(activeSession)}`
        : '';
      const res = await api.get(`/students/completeness/summary${sessParam}`);
      if (res.data) {
        setSummary(res.data.summary);
        setFieldBreakdown(res.data.fieldBreakdown || []);
      }
    } catch (err) {
      console.error('Failed to load completeness summary:', err);
    } finally {
      setLoading(false);
    }
  }, [activeSession]);

  /**
   * Fetch Incomplete Students List
   */
  const fetchStudents = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeSession) {
        params.append('session', activeSession);
      }
      if (selectedFieldFilter && selectedFieldFilter !== 'all') {
        params.append('missingField', selectedFieldFilter);
      }
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }
      if (classFilter) {
        params.append('classId', classFilter);
      }
      if (sectionFilter) {
        params.append('sectionId', sectionFilter);
      }
      if (includeOptional) {
        params.append('includeOptional', 'true');
      }
      params.append('page', String(page));
      params.append('limit', String(pageSize));

      const res = await api.get(`/students/completeness/missing-students?${params.toString()}`);
      if (res.data) {
        setStudents(res.data.students || []);
        setTotalStudentsCount(res.data.pagination?.total || 0);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load incomplete students:', err);
    } finally {
      setListLoading(false);
    }
  }, [activeSession, selectedFieldFilter, debouncedSearch, classFilter, sectionFilter, includeOptional, page, pageSize]);

  // Initial load and auto-refresh on session change or refreshTrigger increment
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshTrigger]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents, refreshTrigger]);

  /**
   * Filtered breakdown list based on category filter
   */
  const displayedBreakdown = useMemo(() => {
    let items = fieldBreakdown;
    if (!includeOptional) {
      items = items.filter(f => f.required);
    }
    if (categoryFilter !== 'ALL') {
      items = items.filter(f => f.category === categoryFilter);
    }
    return items;
  }, [fieldBreakdown, includeOptional, categoryFilter]);

  /**
   * Selected Field Metadata for banner
   */
  const selectedFieldMeta = useMemo(() => {
    if (!selectedFieldFilter || selectedFieldFilter === 'all') return null;
    return fieldBreakdown.find(f => f.key === selectedFieldFilter) || null;
  }, [selectedFieldFilter, fieldBreakdown]);

  /**
   * Handle Exporting to CSV (direct server-side streaming without in-memory truncation)
   */
  const handleExport = async (_format: 'xlsx' | 'csv' = 'csv') => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (activeSession) {
        params.append('session', activeSession);
      }
      if (selectedFieldFilter && selectedFieldFilter !== 'all') {
        params.append('missingField', selectedFieldFilter);
      }
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }
      if (classFilter) {
        params.append('classId', classFilter);
      }
      if (sectionFilter) {
        params.append('sectionId', sectionFilter);
      }
      if (includeOptional) {
        params.append('includeOptional', 'true');
      }

      const res = await api.get(`/students/completeness/export?${params.toString()}`, {
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const filenameBase = `Missing_Student_Information_${selectedFieldFilter || 'All'}_${new Date().toISOString().slice(0, 10)}.csv`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filenameBase);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Error creating report'}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="student-completeness-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── TOP KPI SUMMARY CARDS ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14
        }}
      >
        {/* Total Students */}
        <div
          className="kpi-card"
          style={{
            padding: 16,
            background: 'var(--card-bg, #ffffff)',
            borderRadius: 'var(--radius-sm, 6px)',
            border: '1px solid var(--border, #eaeaec)',
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #696e79)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Students
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text, #282c3f)', lineHeight: 1.2, marginTop: 2 }}>
              {loading ? '...' : (summary?.totalStudents ?? 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted, #94969f)', marginTop: 2 }}>
              Active in {activeSession}
            </div>
          </div>
        </div>

        {/* Complete Profiles */}
        <div
          className="kpi-card"
          style={{
            padding: 16,
            background: 'var(--card-bg, #ffffff)',
            borderRadius: 'var(--radius-sm, 6px)',
            border: '1px solid var(--border, #eaeaec)',
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: 'rgba(3, 128, 106, 0.1)',
              color: '#03806a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #696e79)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Complete Profiles
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#03806a', lineHeight: 1.2 }}>
                {loading ? '...' : (summary?.completeProfiles ?? 0).toLocaleString()}
              </span>
              {summary && summary.totalStudents > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#03806a', background: 'rgba(3, 128, 106, 0.12)', padding: '2px 6px', borderRadius: 4 }}>
                  {summary.completenessScore}%
                </span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted, #94969f)', marginTop: 2 }}>
              100% required fields present
            </div>
          </div>
        </div>

        {/* Incomplete Profiles */}
        <div
          className="kpi-card"
          style={{
            padding: 16,
            background: 'var(--card-bg, #ffffff)',
            borderRadius: 'var(--radius-sm, 6px)',
            border: '1px solid var(--border, #eaeaec)',
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: 'rgba(217, 119, 6, 0.1)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #696e79)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Incomplete Profiles
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#d97706', lineHeight: 1.2 }}>
                {loading ? '...' : (summary?.incompleteProfiles ?? 0).toLocaleString()}
              </span>
              {summary && summary.totalStudents > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#d97706', background: 'rgba(217, 119, 6, 0.12)', padding: '2px 6px', borderRadius: 4 }}>
                  {Math.round((summary.incompleteProfiles / summary.totalStudents) * 100)}%
                </span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted, #94969f)', marginTop: 2 }}>
              Missing 1 or more required fields
            </div>
          </div>
        </div>

        {/* Total Missing Fields */}
        <div
          className="kpi-card"
          style={{
            padding: 16,
            background: 'var(--card-bg, #ffffff)',
            borderRadius: 'var(--radius-sm, 6px)',
            border: '1px solid var(--border, #eaeaec)',
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: 'rgba(225, 29, 85, 0.1)',
              color: '#e11d55',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ShieldAlert size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #696e79)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Missing Fields
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#e11d55', lineHeight: 1.2, marginTop: 2 }}>
              {loading ? '...' : (summary?.totalMissingFields ?? 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted, #94969f)', marginTop: 2 }}>
              Across all student profiles
            </div>
          </div>
        </div>
      </div>

      {/* ── OVERALL DATA HEALTH PROGRESS BAR ── */}
      {summary && summary.totalStudents > 0 && (
        <div
          style={{
            background: 'var(--card-bg, #ffffff)',
            padding: '14px 18px',
            borderRadius: 'var(--radius-sm, 6px)',
            border: '1px solid var(--border, #eaeaec)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: 'var(--text, #282c3f)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={15} style={{ color: '#03806a' }} /> Overall Data Completeness Score
            </span>
            <span style={{ fontWeight: 700, color: summary.completenessScore >= 80 ? '#03806a' : summary.completenessScore >= 50 ? '#d97706' : '#e11d55' }}>
              {summary.completenessScore}% Complete
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: 8,
              background: 'var(--card-subtle, #f0f0f2)',
              borderRadius: 999,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${summary.completenessScore}%`,
                background: summary.completenessScore >= 80 ? '#03806a' : summary.completenessScore >= 50 ? '#d97706' : '#e11d55',
                transition: 'width 0.4s ease-out'
              }}
            />
          </div>
        </div>
      )}

      {/* ── MISSING INFORMATION BREAKDOWN BY FIELD ── */}
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: 'var(--radius-sm, 6px)',
          border: '1px solid var(--border, #eaeaec)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border, #eaeaec)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text, #282c3f)' }}>
              Missing Information Breakdown by Field
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary, #696e79)' }}>
              Click any field to filter the students list below. Missing counts reflect actual database records.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Category Filter Pills */}
            <div style={{ display: 'flex', background: 'var(--card-subtle, #f5f5f6)', padding: 3, borderRadius: 6, gap: 4 }}>
              {['ALL', 'Academic', 'Personal', 'Parent/Guardian', 'Contact'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  style={{
                    background: categoryFilter === cat ? 'var(--card-bg, #ffffff)' : 'transparent',
                    color: categoryFilter === cat ? 'var(--text, #282c3f)' : 'var(--text-secondary, #696e79)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: categoryFilter === cat ? 600 : 500,
                    cursor: 'pointer',
                    boxShadow: categoryFilter === cat ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cat === 'ALL' ? 'All Categories' : cat}
                </button>
              ))}
            </div>

            {/* Optional Fields Toggle */}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary, #696e79)' }}>
              <input
                type="checkbox"
                checked={includeOptional}
                onChange={e => setIncludeOptional(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Include Optional Fields</span>
            </label>

            {/* Reset Filter Button */}
            {selectedFieldFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedFieldFilter('all')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  background: 'rgba(225, 29, 85, 0.1)',
                  color: '#e11d55',
                  border: '1px solid rgba(225, 29, 85, 0.25)',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                <X size={13} /> Reset Filter (Show All Incomplete)
              </button>
            )}
          </div>
        </div>

        {/* Interactive Field Breakdown Grid */}
        <div
          style={{
            padding: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 10
          }}
        >
          {/* "All Incomplete Profiles" Card */}
          <button
            type="button"
            onClick={() => setSelectedFieldFilter('all')}
            style={{
              padding: '12px 14px',
              borderRadius: 6,
              textAlign: 'left',
              border: selectedFieldFilter === 'all'
                ? '2px solid #2563eb'
                : '1px solid var(--border, #eaeaec)',
              background: selectedFieldFilter === 'all'
                ? 'rgba(37, 99, 235, 0.06)'
                : 'var(--card-subtle, #f9f9fa)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #282c3f)' }}>
                All Incomplete Profiles
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: (summary?.incompleteProfiles ?? 0) > 0 ? '#fef3c7' : '#e6f4ea',
                  color: (summary?.incompleteProfiles ?? 0) > 0 ? '#b45309' : '#03806a'
                }}
              >
                {summary?.incompleteProfiles ?? 0} Students
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #696e79)' }}>
              Any student missing 1 or more required fields
            </div>
          </button>

          {/* Individual Field Breakdown Cards */}
          {displayedBreakdown.map(field => {
            const isSelected = selectedFieldFilter === field.key;
            const hasMissing = field.missingCount > 0;

            return (
              <button
                key={field.key}
                type="button"
                onClick={() => setSelectedFieldFilter(field.key)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 6,
                  textAlign: 'left',
                  border: isSelected
                    ? '2px solid #e11d55'
                    : hasMissing
                      ? '1px solid var(--border, #eaeaec)'
                      : '1px solid var(--border, #eaeaec)',
                  background: isSelected
                    ? 'rgba(225, 29, 85, 0.06)'
                    : 'var(--card-subtle, #f9f9fa)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #282c3f)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {field.label}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      flexShrink: 0,
                      background: hasMissing ? '#fee2e2' : '#e6f4ea',
                      color: hasMissing ? '#dc2626' : '#03806a'
                    }}
                  >
                    {hasMissing ? `${field.missingCount} Missing` : 'Complete'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-secondary, #696e79)' }}>
                  <span>{field.category} {!field.required && '(Optional)'}</span>
                  <span style={{ fontWeight: 600, color: hasMissing ? '#d97706' : '#03806a' }}>
                    {field.completionPercentage}% present
                  </span>
                </div>

                {/* Progress bar per field */}
                <div style={{ width: '100%', height: 4, background: 'var(--border, #eaeaec)', borderRadius: 2, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${field.completionPercentage}%`,
                      height: '100%',
                      background: hasMissing ? (field.completionPercentage > 80 ? '#d97706' : '#e11d55') : '#03806a'
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MISSING INFORMATION STUDENTS TABLE ── */}
      <div
        className="directory-box"
        style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: 'var(--radius-sm, 6px)',
          border: '1px solid var(--border, #eaeaec)',
          overflow: 'hidden'
        }}
      >
        {/* Table Header / Toolbar */}
        <div
          className="directory-box-header"
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border, #eaeaec)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: 220, flex: '1 1 auto', maxWidth: 360 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary, #696e79)'
                }}
              />
              <input
                type="text"
                placeholder="Search by student name, roll, or admission no..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: 30,
                  paddingRight: 10,
                  paddingTop: 7,
                  paddingBottom: 7,
                  fontSize: 13,
                  borderRadius: 'var(--radius-sm, 4px)',
                  border: '1px solid var(--border, #d4d5d9)'
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: 'var(--text-secondary, #696e79)'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Class Filter */}
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              style={{
                padding: '7px 10px',
                fontSize: 13,
                borderRadius: 'var(--radius-sm, 4px)',
                border: '1px solid var(--border, #d4d5d9)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text, #282c3f)'
              }}
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.label || (c.class_number === -1 ? 'Class L KG' : c.class_number === 0 ? 'Class U KG' : `Class ${c.class_number}`)}
                </option>
              ))}
            </select>

            {/* Section Filter */}
            <select
              value={sectionFilter}
              onChange={e => setSectionFilter(e.target.value)}
              style={{
                padding: '7px 10px',
                fontSize: 13,
                borderRadius: 'var(--radius-sm, 4px)',
                border: '1px solid var(--border, #d4d5d9)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text, #282c3f)'
              }}
            >
              <option value="">All Sections</option>
              {['A', 'B', 'C', 'D'].map(sec => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>

            {/* Missing Field Filter Dropdown */}
            <select
              value={selectedFieldFilter}
              onChange={e => setSelectedFieldFilter(e.target.value)}
              style={{
                padding: '7px 10px',
                fontSize: 13,
                borderRadius: 'var(--radius-sm, 4px)',
                border: '1px solid var(--border, #d4d5d9)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text, #282c3f)',
                fontWeight: selectedFieldFilter !== 'all' ? 600 : 400
              }}
            >
              <option value="all">Missing: Any Required Field</option>
              {fieldBreakdown.map(f => (
                <option key={f.key} value={f.key}>
                  Missing: {f.label} ({f.missingCount})
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons: Refresh & Export */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => { fetchSummary(); fetchStudents(); }}
              disabled={listLoading || loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 'var(--radius-sm, 4px)',
                border: '1px solid var(--border, #d4d5d9)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text, #282c3f)',
                fontSize: 13,
                cursor: 'pointer'
              }}
              title="Refresh completeness data"
            >
              <RefreshCw size={14} className={listLoading || loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport('xlsx')}
              disabled={exporting || totalStudentsCount === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 'var(--radius-sm, 4px)',
                background: totalStudentsCount === 0 ? '#94969f' : '#03806a',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                cursor: totalStudentsCount === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
              title="Export report as Excel"
            >
              <FileSpreadsheet size={15} />
              <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport('csv')}
              disabled={exporting || totalStudentsCount === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 'var(--radius-sm, 4px)',
                background: '#5c6bc0',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                cursor: totalStudentsCount === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
              title="Export report as CSV"
            >
              <Download size={15} />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Active Filter Banner */}
        {selectedFieldMeta && (
          <div
            style={{
              padding: '10px 16px',
              background: 'rgba(225, 29, 85, 0.08)',
              borderBottom: '1px solid rgba(225, 29, 85, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} style={{ color: '#e11d55', flexShrink: 0 }} />
              <span>
                Filtering students missing <b>{selectedFieldMeta.label}</b> ({selectedFieldMeta.missingCount} records in database)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFieldFilter('all')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#e11d55',
                fontWeight: 600,
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              Clear filter <X size={13} />
            </button>
          </div>
        )}

        {/* Loading Progress Bar */}
        {listLoading && (
          <div style={{ width: '100%', height: 3, background: 'rgba(225, 29, 85, 0.1)', overflow: 'hidden' }}>
            <div style={{ width: '40%', height: '100%', background: '#e11d55', animation: 'progressIndeterminate 1.2s infinite ease-in-out' }} />
          </div>
        )}

        {/* Table Content */}
        <div className="table-wrap" style={{ overflowX: 'auto', minHeight: 280 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--card-subtle, #f9f9fa)', borderBottom: '1px solid var(--border, #eaeaec)' }}>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary, #696e79)' }}>Student Name</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary, #696e79)' }}>Admission No.</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary, #696e79)' }}>Roll No.</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary, #696e79)' }}>Class & Section</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary, #696e79)' }}>Missing Information</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary, #696e79)', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {listLoading && students.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary, #696e79)' }}>
                    <RefreshCw size={24} className="spin" style={{ color: '#e11d55', marginBottom: 8 }} />
                    <div>Loading incomplete student records from database...</div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e6f4ea', color: '#03806a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <CheckCircle2 size={30} />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #282c3f)' }}>
                      All student profiles are complete!
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary, #696e79)', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
                      {selectedFieldFilter !== 'all'
                        ? `No students are missing "${selectedFieldMeta?.label || selectedFieldFilter}".`
                        : 'Every enrolled student has all required academic, personal, and parent details on record.'}
                    </p>
                  </td>
                </tr>
              ) : (
                students.map(st => {
                  const studentClassDisplay = st.class_name || (st.class_number !== undefined && st.class_number !== null ? `Class ${st.class_number}` : '—');
                  const sectionDisplay = st.section_name ? `Section ${st.section_name}` : '';

                  return (
                    <tr
                      key={st.id}
                      style={{
                        borderBottom: '1px solid var(--border, #eaeaec)',
                        transition: 'background 0.1s ease'
                      }}
                      className="completeness-student-row"
                    >
                      {/* Student Name */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text, #282c3f)' }}>
                          {st.name || `${st.first_name || ''} ${st.last_name || ''}`.trim() || 'Student'}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted, #94969f)', marginTop: 2 }}>
                          {st.session_name || activeSession}
                        </div>
                      </td>

                      {/* Admission No. */}
                      <td style={{ padding: '12px 14px' }}>
                        <code style={{ background: 'var(--card-subtle, #f0f0f2)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
                          {st.admission_number || '—'}
                        </code>
                      </td>

                      {/* Roll No. */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontWeight: 500 }}>
                          {st.roll_number || '—'}
                        </span>
                      </td>

                      {/* Class & Section */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 500 }}>{studentClassDisplay}</div>
                        {sectionDisplay && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #696e79)' }}>{sectionDisplay}</div>
                        )}
                      </td>

                      {/* Missing Information Badges */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {st.missingFields.length === 0 ? (
                            <span style={{ fontSize: 11.5, color: '#03806a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={13} /> Complete
                            </span>
                          ) : (
                            st.missingFields.map(mf => {
                              const isTargetField = selectedFieldFilter === mf.key;

                              return (
                                <button
                                  key={mf.key}
                                  type="button"
                                  onClick={() => onEditStudent(st, mf.key)}
                                  title={`Click to edit ${mf.label} in Edit modal`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11.5,
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    background: isTargetField ? '#fee2e2' : 'rgba(217, 119, 6, 0.1)',
                                    color: isTargetField ? '#dc2626' : '#b45309',
                                    border: isTargetField ? '1px solid #f87171' : '1px solid rgba(217, 119, 6, 0.25)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                                >
                                  <span>{mf.label}</span>
                                  <Pencil size={10} style={{ opacity: 0.7 }} />
                                </button>
                              );
                            })
                          )}
                        </div>
                      </td>

                      {/* Action: One-Click Edit */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => {
                            // Target first missing field or general
                            const firstMissing = st.missingFields[0]?.key || (selectedFieldFilter !== 'all' ? selectedFieldFilter : undefined);
                            onEditStudent(st, firstMissing);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-sm, 4px)',
                            background: '#e11d55',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(225, 29, 85, 0.2)',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#c0174a'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#e11d55'; }}
                          title="Open Edit Student modal and focus missing information"
                        >
                          <Pencil size={13} />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Box Footer (Pagination Bar) */}
        <div
          className="directory-box-footer"
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border, #eaeaec)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            background: 'var(--card-subtle, #f9f9fa)',
            fontSize: 12.5
          }}
        >
          <div style={{ color: 'var(--text-secondary, #696e79)' }}>
            Showing <b>{students.length === 0 ? 0 : (page - 1) * pageSize + 1}</b> to <b>{Math.min(page * pageSize, totalStudentsCount)}</b> of <b>{totalStudentsCount}</b> incomplete profiles
            {selectedFieldFilter !== 'all' && (
              <span style={{ marginLeft: 6, fontWeight: 500, color: '#e11d55' }}>
                (filtered by missing: {selectedFieldMeta?.label || selectedFieldFilter})
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary, #696e79)', marginRight: 4 }}>Per page:</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              style={{
                padding: '4px 8px',
                fontSize: 12,
                borderRadius: 4,
                border: '1px solid var(--border, #d4d5d9)',
                background: 'var(--card-bg, #ffffff)'
              }}
            >
              <option value="15">15</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>

            <button
              type="button"
              disabled={page <= 1 || listLoading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                borderRadius: 4,
                border: '1px solid var(--border, #d4d5d9)',
                background: 'var(--card-bg, #ffffff)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.6 : 1,
                fontSize: 12
              }}
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <span style={{ padding: '0 6px', fontWeight: 600, color: 'var(--text, #282c3f)' }}>
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages || listLoading}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                borderRadius: 4,
                border: '1px solid var(--border, #d4d5d9)',
                background: 'var(--card-bg, #ffffff)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                opacity: page >= totalPages ? 0.6 : 1,
                fontSize: 12
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentCompletenessTab;
