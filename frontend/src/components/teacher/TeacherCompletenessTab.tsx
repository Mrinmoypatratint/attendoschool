import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  X,
  Sparkles,
  GraduationCap
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../api';
import { TeacherProfileHoverCard } from '../TeacherProfileHoverCard';

export interface TeacherCompletenessSummary {
  totalTeachers: number;
  completeProfiles: number;
  incompleteProfiles: number;
  totalMissingFields: number;
  completenessScore: number;
}

export interface TeacherFieldBreakdownItem {
  key: string;
  label: string;
  category: 'Personal' | 'Contact' | 'Professional' | 'Academic';
  required: boolean;
  formFieldId: string;
  missingCount: number;
  completedCount: number;
  completionPercentage: number;
}

export interface IncompleteTeacher {
  id: string;
  name: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email?: string;
  profile_id?: string;
  employee_id?: string;
  mobile?: string;
  phone?: string;
  gender?: string;
  designation?: string;
  qualification?: string;
  date_of_birth?: string;
  dob?: string;
  joining_date?: string;
  joiningDate?: string;
  address?: string;
  photo_url?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  class_mentor_id?: string;
  assigned_class_id?: string;
  assigned_class_number?: number;
  assigned_section_id?: string;
  assigned_section_name?: string;
  assigned_class_label?: string;
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

interface TeacherCompletenessTabProps {
  designations?: any[];
  refreshTrigger?: number;
  onEditTeacher: (teacher: IncompleteTeacher, targetFieldKey?: string) => void;
}

export const TeacherCompletenessTab: React.FC<TeacherCompletenessTabProps> = ({
  designations = [],
  refreshTrigger = 0,
  onEditTeacher
}) => {
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [summary, setSummary] = useState<TeacherCompletenessSummary | null>(null);
  const [fieldBreakdown, setFieldBreakdown] = useState<TeacherFieldBreakdownItem[]>([]);
  const [teachers, setTeachers] = useState<IncompleteTeacher[]>([]);
  const [totalTeachersCount, setTotalTeachersCount] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [selectedFieldFilter, setSelectedFieldFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<string>('');
  const [designationFilter, setDesignationFilter] = useState<string>('');
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
  }, [selectedFieldFilter, genderFilter, designationFilter, includeOptional]);

  /**
   * Fetch Dashboard Completeness Summary & Breakdown
   */
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (genderFilter) params.append('gender', genderFilter);
      if (designationFilter) params.append('designation', designationFilter);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/teachers/completeness/summary${qs}`);
      if (res.data) {
        setSummary(res.data.summary);
        setFieldBreakdown(res.data.fieldBreakdown || []);
      }
    } catch (err: any) {
      console.error('Failed to load teacher completeness summary:', err);
      setFetchError(err.response?.data?.message || err.message || 'Unable to connect to completeness service');
    } finally {
      setLoading(false);
    }
  }, [genderFilter, designationFilter]);

  /**
   * Fetch Incomplete Teachers List
   */
  const fetchTeachers = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedFieldFilter && selectedFieldFilter !== 'all') {
        params.append('missingField', selectedFieldFilter);
      }
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }
      if (genderFilter) {
        params.append('gender', genderFilter);
      }
      if (designationFilter) {
        params.append('designation', designationFilter);
      }
      if (includeOptional) {
        params.append('includeOptional', 'true');
      }
      params.append('page', String(page));
      params.append('limit', String(pageSize));

      const res = await api.get(`/teachers/completeness/missing-teachers?${params.toString()}`);
      if (res.data) {
        setTeachers(res.data.teachers || []);
        setTotalTeachersCount(res.data.pagination?.total || 0);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      console.error('Failed to load incomplete teachers:', err);
      if (!fetchError) {
        setFetchError(err.response?.data?.message || err.message || 'Unable to load incomplete teachers list');
      }
    } finally {
      setListLoading(false);
    }
  }, [selectedFieldFilter, debouncedSearch, genderFilter, designationFilter, includeOptional, page, pageSize, fetchError]);

  // Initial load and auto-refresh on refreshTrigger increment
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshTrigger]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers, refreshTrigger]);

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
   * Available designation options from props or breakdown
   */
  const availableDesignations = useMemo(() => {
    const set = new Set<string>();
    designations.forEach(d => {
      const name = typeof d === 'string' ? d : d.title || d.name;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [designations]);

  /**
   * Handle Exporting to CSV / Excel
   */
  const handleExport = async (format: 'xlsx' | 'csv' = 'csv') => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedFieldFilter && selectedFieldFilter !== 'all') {
        params.append('missingField', selectedFieldFilter);
      }
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }
      if (genderFilter) {
        params.append('gender', genderFilter);
      }
      if (designationFilter) {
        params.append('designation', designationFilter);
      }
      if (includeOptional) {
        params.append('includeOptional', 'true');
      }

      if (format === 'csv') {
        const res = await api.get(`/teachers/completeness/export?${params.toString()}`, {
          responseType: 'blob'
        });

        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const filenameBase = `Missing_Teacher_Information_${selectedFieldFilter || 'All'}_${new Date().toISOString().slice(0, 10)}.csv`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filenameBase);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } else {
        // Fetch up to 5000 records for client-side formatted Excel sheet
        params.set('limit', '5000');
        params.set('page', '1');
        const res = await api.get(`/teachers/completeness/missing-teachers?${params.toString()}`);
        const exportRows = (res.data?.teachers || []).map((t: IncompleteTeacher) => ({
          'Teacher Name': t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim(),
          'Employee / Savior ID': t.employee_id || '—',
          'Email Address': t.email || '—',
          'Mobile Number': t.mobile || t.phone || '—',
          'Designation': t.designation || 'Teacher',
          'Joining Date': t.joining_date || '—',
          'Gender': t.gender || '—',
          'Missing Fields Count': t.missingCount,
          'Missing Information': t.missingFields.map(f => f.label).join('; '),
          'Date of Birth': t.date_of_birth || '—',
          'Qualification': t.qualification || '—',
          'Assigned Class': t.assigned_class_label ? `${t.assigned_class_label}${t.assigned_section_name ? ` - Sec ${t.assigned_section_name}` : ''}` : '—',
          'Address': t.address || '—'
        }));

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Incomplete Teachers');
        const filename = `Missing_Teacher_Information_${selectedFieldFilter || 'All'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Error creating report'}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="teacher-completeness-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── TOP KPI SUMMARY CARDS ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14
        }}
      >
        {/* Total Faculty */}
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
            <GraduationCap size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #696e79)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Faculty
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text, #282c3f)', lineHeight: 1.2, marginTop: 2 }}>
              {loading ? '...' : (summary?.totalTeachers ?? 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted, #94969f)', marginTop: 2 }}>
              Active appointed staff
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
              {summary && summary.totalTeachers > 0 && (
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
              {summary && summary.totalTeachers > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#d97706', background: 'rgba(217, 119, 6, 0.12)', padding: '2px 6px', borderRadius: 4 }}>
                  {Math.round((summary.incompleteProfiles / summary.totalTeachers) * 100)}%
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
              Across all faculty profiles
            </div>
          </div>
        </div>
      </div>

      {/* ── OVERALL DATA HEALTH PROGRESS BAR ── */}
      {summary && summary.totalTeachers > 0 && (
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
              <Sparkles size={15} style={{ color: '#03806a' }} /> Overall Faculty Data Completeness Score
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
              Faculty Missing Information Breakdown
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary, #696e79)' }}>
              Click any field pill to filter faculty below. Missing counts reflect actual database records.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Category Filter Pills */}
            <div style={{ display: 'flex', background: 'var(--card-subtle, #f5f5f6)', padding: 3, borderRadius: 6, gap: 4 }}>
              {['ALL', 'Professional', 'Personal', 'Contact', 'Academic'].map(cat => (
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
                <X size={13} /> Reset Filter
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
                All Incomplete Faculty
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
                {summary?.incompleteProfiles ?? 0} Faculty
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #696e79)' }}>
              Any teacher missing 1 or more required fields
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
                    : '1px solid var(--border, #eaeaec)',
                  background: isSelected
                    ? 'rgba(225, 29, 85, 0.06)'
                    : 'var(--card-subtle, #f9f9fa)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'all 0.15s ease'
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

      {/* ── MISSING INFORMATION TEACHERS TABLE ── */}
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
                placeholder="Search teacher name, employee ID, email, or mobile..."
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

            {/* Gender Filter */}
            <select
              value={genderFilter}
              onChange={e => setGenderFilter(e.target.value)}
              style={{
                padding: '7px 10px',
                fontSize: 13,
                borderRadius: 'var(--radius-sm, 4px)',
                border: '1px solid var(--border, #d4d5d9)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text, #282c3f)'
              }}
            >
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>

            {/* Designation Filter */}
            <select
              value={designationFilter}
              onChange={e => setDesignationFilter(e.target.value)}
              style={{
                padding: '7px 10px',
                fontSize: 13,
                borderRadius: 'var(--radius-sm, 4px)',
                border: '1px solid var(--border, #d4d5d9)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text, #282c3f)'
              }}
            >
              <option value="">All Designations</option>
              {availableDesignations.map(d => (
                <option key={d} value={d}>
                  {d}
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
              onClick={() => { fetchSummary(); fetchTeachers(); }}
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
              title="Refresh teacher completeness data"
            >
              <RefreshCw size={14} className={listLoading || loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport('xlsx')}
              disabled={exporting || totalTeachersCount === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 'var(--radius-sm, 4px)',
                background: totalTeachersCount === 0 ? '#94969f' : '#03806a',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                cursor: totalTeachersCount === 0 ? 'not-allowed' : 'pointer',
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
              disabled={exporting || totalTeachersCount === 0}
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
                cursor: totalTeachersCount === 0 ? 'not-allowed' : 'pointer',
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
                Filtering faculty missing <b>{selectedFieldMeta.label}</b> ({selectedFieldMeta.missingCount} records in database)
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
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary, #696e79)' }}>Teacher Name</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary, #696e79)' }}>Employee ID</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary, #696e79)' }}>Designation</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary, #696e79)' }}>Contact</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary, #696e79)' }}>Joining Date</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary, #696e79)' }}>Gender</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary, #696e79)' }}>Missing Information</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary, #696e79)', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {listLoading && teachers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary, #696e79)' }}>
                    <RefreshCw size={24} className="spin" style={{ color: '#e11d55', marginBottom: 8 }} />
                    <div>Loading incomplete faculty records from database...</div>
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <AlertTriangle size={30} />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>
                      Failed to load faculty completeness data
                    </div>
                    <p style={{ margin: '6px 0 16px', fontSize: 13, color: 'var(--text-secondary, #696e79)', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
                      {fetchError}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        fetchSummary();
                        fetchTeachers();
                      }}
                      style={{
                        padding: '8px 16px',
                        background: '#e11d55',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      Retry Connection
                    </button>
                  </td>
                </tr>
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e6f4ea', color: '#03806a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <CheckCircle2 size={30} />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #282c3f)' }}>
                      {summary && summary.totalTeachers === 0
                        ? 'No faculty members found'
                        : 'All faculty profiles are complete!'}
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary, #696e79)', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
                      {summary && summary.totalTeachers === 0
                        ? 'No active faculty accounts exist for this institution yet.'
                        : selectedFieldFilter !== 'all'
                          ? `No teachers are missing "${selectedFieldMeta?.label || selectedFieldFilter}".`
                          : 'Every appointed faculty member has all required identity, employment, and contact details on record.'}
                    </p>
                  </td>
                </tr>
              ) : (
                teachers.map(t => {
                  return (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: '1px solid var(--border, #eaeaec)',
                        transition: 'background 0.1s ease'
                      }}
                      className="completeness-student-row"
                    >
                      {/* Teacher Name */}
                      <td style={{ padding: '12px 16px' }}>
                        <TeacherProfileHoverCard teacher={t}>
                          <div style={{ fontWeight: 600, color: 'var(--text, #282c3f)', textTransform: 'uppercase', cursor: 'pointer' }}>
                            {t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Teacher'}
                          </div>
                        </TeacherProfileHoverCard>
                        {t.assigned_class_label && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted, #94969f)', marginTop: 2 }}>
                            Class Teacher: {t.assigned_class_label} {t.assigned_section_name ? `(${t.assigned_section_name})` : ''}
                          </div>
                        )}
                      </td>

                      {/* Employee ID */}
                      <td style={{ padding: '12px 14px' }}>
                        <code style={{ background: 'var(--card-subtle, #f0f0f2)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
                          {t.employee_id || '—'}
                        </code>
                      </td>

                      {/* Designation */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-secondary, #535766)' }}>
                          {t.designation || 'Teacher'}
                        </span>
                      </td>

                      {/* Contact */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 12.5, color: 'var(--text, #282c3f)' }}>{t.email || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #696e79)', marginTop: 2 }}>{t.mobile || t.phone || '—'}</div>
                      </td>

                      {/* Joining Date */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontSize: 12.5 }}>
                        {t.joining_date || '—'}
                      </td>

                      {/* Gender */}
                      <td style={{ padding: '12px 14px' }}>
                        {t.gender ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontSize: 11.5,
                              fontWeight: 500,
                              background: t.gender === 'Female' ? '#fff2f4' : t.gender === 'Male' ? '#eef0f9' : '#f9f9fa',
                              color: t.gender === 'Female' ? '#e11d55' : t.gender === 'Male' ? '#5c6bc0' : '#696e79',
                              border: `1px solid ${t.gender === 'Female' ? '#fcc3d1' : t.gender === 'Male' ? '#c9cee9' : '#eaeaec'}`
                            }}
                          >
                            {t.gender}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted, #94969f)', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Missing Information Badges */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {t.missingFields.length === 0 ? (
                            <span style={{ fontSize: 11.5, color: '#03806a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={13} /> Complete
                            </span>
                          ) : (
                            t.missingFields.map(mf => {
                              const isTargetField = selectedFieldFilter === mf.key;

                              return (
                                <button
                                  key={mf.key}
                                  type="button"
                                  onClick={() => onEditTeacher(t, mf.key)}
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
                            const firstMissing = t.missingFields[0]?.key || (selectedFieldFilter !== 'all' ? selectedFieldFilter : undefined);
                            onEditTeacher(t, firstMissing);
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
                          title="Open Edit Teacher modal and focus missing information"
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
            Showing <b>{teachers.length === 0 ? 0 : (page - 1) * pageSize + 1}</b> to <b>{Math.min(page * pageSize, totalTeachersCount)}</b> of <b>{totalTeachersCount}</b> incomplete profiles
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

export default TeacherCompletenessTab;
