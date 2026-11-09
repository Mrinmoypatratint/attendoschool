import React, { useEffect, useState, useMemo, useRef } from 'react';
import { api } from '../../api';
import { PersonProfileLink } from '../../components/PersonProfileLink';
import {
  UniversalPreviewModal,
  PreviewSummaryCard,
  PreviewTableData
} from '../../components/preview';
import { TableSubToolbar, TablePaginationFooter } from '../../components/TablePagination';
import { Search, Filter, CheckSquare, Square, ArrowUpDown, Sparkles, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function StudentPromotion() {
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [years, setYears] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // Pagination & Filtering state (matching School Admin Students Directory)
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PROCESSED'>('ALL');
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);
  const tableTopRef = useRef<HTMLDivElement>(null);

  // Preview Modal State
  const [promotionPreview, setPromotionPreview] = useState<{
    isOpen: boolean;
    summaryCards: PreviewSummaryCard[];
    tableData?: PreviewTableData;
    selectedItems: any[];
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    summaryCards: [],
    selectedItems: [],
    loading: false,
    error: null,
  });

  async function loadYears() {
    try {
      const r = await api.get('/academic-years');
      setYears(r.data);
      if (!fromYear && r.data.length) {
        const activeYear = r.data.find((x: any) => x.is_active)?.id || r.data[0].id;
        setFromYear(activeYear);
        if (!toYear && r.data.length > 1) {
          const targetYear = r.data.find((x: any) => x.id !== activeYear && !x.is_archived)?.id;
          if (targetYear) setToYear(targetYear);
        }
      }
    } catch (e: any) {
      setMessage(e?.response?.data?.message || 'Unable to load academic sessions');
    }
  }

  async function loadCandidates() {
    if (!fromYear) return;
    setLoading(true);
    try {
      const r = await api.get('/student-promotions/candidates', { params: { fromYearId: fromYear } });
      setItems(r.data || []);
      setSelected({});
      setOutcome({});
      setLastFetchedAt(new Date());
      setPage(1);
    } catch (e: any) {
      setMessage(e?.response?.data?.message || 'Unable to load candidate roster');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadYears(); }, []);
  useEffect(() => { loadCandidates(); }, [fromYear]);

  // Distinct classes and sections from current candidates sorted in natural academic order
  const availableClasses = useMemo(() => {
    const parseClassRank = (className: string): number => {
      const norm = String(className || '').trim().toLowerCase();
      if (norm.includes('nursery') || norm.includes('pre-kg') || norm.includes('play')) return -3;
      if (norm.includes('l-kg') || norm.includes('lkg') || norm.includes('lower kg')) return -2;
      if (norm.includes('u-kg') || norm.includes('ukg') || norm.includes('upper kg')) return -1;
      if (norm.includes('kg')) return -1;
      const numMatch = norm.match(/\d+/);
      if (numMatch) return parseInt(numMatch[0], 10);
      const romanMap: Record<string, number> = {
        'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
        'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10,
        'xi': 11, 'xii': 12
      };
      const parts = norm.split(/[\s-]+/);
      for (const p of parts) {
        if (romanMap[p]) return romanMap[p];
      }
      return 999;
    };

    const s = new Set<string>();
    items.forEach(x => {
      if (x.from_class_name) s.add(x.from_class_name);
    });

    return Array.from(s).sort((a, b) => {
      const rankA = parseClassRank(a);
      const rankB = parseClassRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [items]);

  const availableSections = useMemo(() => {
    const s = new Set<string>();
    items.forEach(x => {
      if (!classFilter || x.from_class_name === classFilter) {
        if (x.from_section_name) s.add(x.from_section_name);
      }
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [items, classFilter]);

  // Filtered candidate list
  const filteredItems = useMemo(() => {
    return items.filter(x => {
      if (statusFilter === 'PENDING' && x.already_processed) return false;
      if (statusFilter === 'PROCESSED' && !x.already_processed) return false;
      if (classFilter && x.from_class_name !== classFilter) return false;
      if (sectionFilter && x.from_section_name !== sectionFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const str = [
          x.name,
          x.roll,
          x.roll_number,
          x.admission_number,
          x.admissionNumber,
          x.from_class_name,
          x.from_section_name,
          outcome[x.id] || 'PROMOTED'
        ].filter(Boolean).join(' ').toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, classFilter, sectionFilter, statusFilter, outcome]);

  // Pagination mathematics
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIdx = filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filteredItems.length);
  const displayedItems = filteredItems.slice(startIdx, endIdx);

  function scrollToTop() {
    if (tableTopRef.current) {
      tableTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function initiateProcess() {
    setMessage('');
    const candidateList = items
      .filter(x => selected[x.id] && !x.already_processed)
      .map(x => ({
        studentId: x.id,
        name: x.name,
        roll: x.roll || x.roll_number || '—',
        admissionNumber: x.admission_number || x.admissionNumber || '—',
        fromClass: x.from_class_name || '—',
        fromSection: x.from_section_name || '—',
        outcome: outcome[x.id] || 'PROMOTED'
      }));

    if (!toYear) {
      alert('Validation Error: Please select a target academic session.');
      return;
    }
    if (!candidateList.length) {
      alert('Validation Error: Please select at least one student to promote/process.');
      return;
    }

    const fromYearName = years.find(y => y.id === fromYear)?.name || 'Current Session';
    const toYearName = years.find(y => y.id === toYear)?.name || 'Target Session';

    const summaryCards: PreviewSummaryCard[] = [
      { label: 'Source Session', value: fromYearName, color: 'purple' },
      { label: 'Target Session', value: toYearName, color: 'blue' },
      { label: 'Total Candidates', value: candidateList.length, color: 'green' }
    ];

    const headers = ['Roll', 'Admission No.', 'Student Name', 'Current Class', 'Target Outcome'];
    const previewRows = candidateList.map(c => [
      c.roll || '—',
      c.admissionNumber || '—',
      c.name,
      `${c.fromClass} (${c.fromSection})`,
      c.outcome
    ]);

    setPromotionPreview({
      isOpen: true,
      summaryCards,
      tableData: { headers, rows: previewRows },
      selectedItems: candidateList.map(c => ({ studentId: c.studentId, outcome: c.outcome })),
      loading: false,
      error: null,
    });
  }

  async function executeConfirmPromotion() {
    setPromotionPreview(prev => ({ ...prev, loading: true, error: null }));
    try {
      const r = await api.post('/student-promotions/process', {
        fromYearId: fromYear,
        toYearId: toYear,
        items: promotionPreview.selectedItems
      });
      setPromotionPreview(prev => ({ ...prev, isOpen: false, loading: false }));
      setMessage(`${r.data.length || promotionPreview.selectedItems.length} student(s) processed and transitioned successfully.`);
      await loadCandidates();
    } catch (e: any) {
      setPromotionPreview(prev => ({
        ...prev,
        loading: false,
        error: e?.response?.data?.message || e?.message || 'Student promotion failed'
      }));
    }
  }

  function handleExportExcel() {
    // 1. Validation for particular Class and particular Section
    if (!classFilter && !sectionFilter) {
      alert('Please select both a Class and a Section using the filter dropdowns to export promoted students.');
      return;
    }
    if (!classFilter) {
      alert('Please select a Class using the filter dropdown to export promoted students.');
      return;
    }
    if (!sectionFilter) {
      alert('Please select a Section using the filter dropdown to export promoted students.');
      return;
    }

    // 2. Filter students strictly belonging to this particular class and section who are PROMOTED
    const targetPromoted = items.filter(x => {
      if (x.from_class_name !== classFilter) return false;
      if (x.from_section_name !== sectionFilter) return false;

      if (statusFilter === 'PENDING' && x.already_processed) return false;
      if (statusFilter === 'PROCESSED' && !x.already_processed) return false;

      const currentOutcome = x.promotion_outcome || outcome[x.id] || 'PROMOTED';
      return currentOutcome === 'PROMOTED';
    });

    if (targetPromoted.length === 0) {
      alert(`No promoted students found for ${classFilter} - Section ${sectionFilter}${statusFilter !== 'ALL' ? ` (${statusFilter} only)` : ''}.`);
      return;
    }

    // Sort by roll number naturally, then student name
    const sortedStudents = [...targetPromoted].sort((a, b) => {
      const rollA = parseInt(String(a.roll || a.roll_number || '0').replace(/\D/g, ''), 10) || 0;
      const rollB = parseInt(String(b.roll || b.roll_number || '0').replace(/\D/g, ''), 10) || 0;
      if (rollA !== rollB) return rollA - rollB;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    // Resolve academic session names
    const sourceYearObj = years.find(y => y.id === fromYear);
    const targetYearObj = years.find(y => y.id === toYear);
    const sourceSessionName = sourceYearObj ? sourceYearObj.name : 'Current Session';
    const targetSessionName = targetYearObj ? targetYearObj.name : 'Next Session';

    const excelRows = sortedStudents.map((st, idx) => ({
      'Sl. No.': idx + 1,
      'Roll No.': st.roll || st.roll_number || '—',
      'Admission No.': st.admission_number || st.admissionNumber || '—',
      'Student Name': st.name || '—',
      'Current Class': st.from_class_name || classFilter,
      'Current Section': st.from_section_name || sectionFilter,
      'Source Session (From)': sourceSessionName,
      'Target Session (To)': targetSessionName,
      'Promotion Outcome': 'PROMOTED (Next Class)',
      'Status': st.already_processed ? 'PROCESSED' : 'PENDING',
      'Parent Name': st.parent_name || '—',
      'Parent Contact': st.parent_sms_number || st.parentPhone || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 12 },
      { wch: 16 },
      { wch: 24 },
      { wch: 15 },
      { wch: 16 },
      { wch: 24 },
      { wch: 22 },
      { wch: 24 },
      { wch: 14 },
      { wch: 22 },
      { wch: 18 }
    ];

    const wb = XLSX.utils.book_new();
    const sheetName = `${classFilter.replace(/[^a-zA-Z0-9]/g, '_')}_Sec_${sectionFilter}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const cleanClass = classFilter.replace(/\s+/g, '_');
    const cleanSection = sectionFilter.replace(/\s+/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Promoted_Students_${cleanClass}_Sec_${cleanSection}_${dateStr}.xlsx`;

    XLSX.writeFile(wb, fileName);
  }

  const eligibleCount = items.filter(x => !x.already_processed).length;
  const filteredEligible = filteredItems.filter(x => !x.already_processed);
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allFilteredEligibleSelected = filteredEligible.length > 0 && filteredEligible.every(x => selected[x.id]);
  const allDisplayedEligibleSelected = displayedItems.filter(x => !x.already_processed).length > 0 &&
    displayedItems.filter(x => !x.already_processed).every(x => selected[x.id]);

  return (
    <div className="feature-page w-full max-w-none m-0 pb-10" ref={tableTopRef} style={{ width: '100%', maxWidth: 'none', margin: 0, padding: '0 0 40px 0' }}>
      <div className="flex justify-between items-start flex-wrap gap-3.5 mb-4">
        <div>
          <p className="eyebrow m-0 mb-1 text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">ACADEMIC TRANSITION</p>
          <h1 className="m-0 text-2xl font-bold text-slate-900 dark:text-white">Student Promotion</h1>
          <p className="muted m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">
            Transition students into a new academic session while preserving historical records and attendance.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="btn-secondary py-2 px-4 text-xs font-semibold inline-flex items-center gap-2 rounded-lg cursor-pointer bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-emerald-700 dark:text-emerald-400 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
            title={classFilter && sectionFilter 
              ? `Export promoted students of ${classFilter} - Section ${sectionFilter} to Excel`
              : 'Export promoted students to Excel for selected Class and Section'}
          >
            <FileSpreadsheet size={16} className="text-emerald-600" /> Export Excel
          </button>

          <button
            onClick={initiateProcess}
            disabled={selectedCount === 0 || !toYear}
            className={`btn-primary py-2 px-4.5 text-xs font-semibold inline-flex items-center gap-2 rounded-lg shadow-xs transition-colors ${
              (selectedCount === 0 || !toYear)
                ? 'bg-slate-400 text-white cursor-not-allowed opacity-60'
                : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
            }`}
          >
            <ArrowUpDown size={15} /> Review & Process Selected ({selectedCount})
          </button>
        </div>
      </div>

      {/* Session Selection Row */}
      <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-4 px-5 mb-4 flex gap-4 items-end flex-wrap shadow-xs">
        <label className="min-w-[240px] flex flex-col gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
          <span>Source Session (From) <span className="text-rose-500">*</span></span>
          <select
            value={fromYear}
            onChange={e => setFromYear(e.target.value)}
            className="py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:border-blue-500"
          >
            <option value="">Select Academic Session</option>
            {years.map(y => (
              <option key={y.id} value={y.id}>{y.name} {y.is_active ? '(Active)' : ''}</option>
            ))}
          </select>
        </label>

        <label className="min-w-[240px] flex flex-col gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
          <span>Target Session (To) <span className="text-rose-500">*</span></span>
          <select
            value={toYear}
            onChange={e => setToYear(e.target.value)}
            className="py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:border-blue-500"
          >
            <option value="">Select Target Academic Session</option>
            {years.filter(y => y.id !== fromYear && !y.is_archived).map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </label>

        <div className="text-xs text-slate-500 dark:text-slate-400 pb-1.5">
          {eligibleCount} pending eligible student(s) ready for transition
        </div>
      </div>

      {message && (
        <div className="success" style={{
          marginBottom: 16,
          padding: '12px 16px',
          borderRadius: 4,
          background: "var(--secondary)",
          border: "1px solid var(--border)",
          color: "var(--success)",
          fontSize: 13
        }}>
          {message}
        </div>
      )}

      {/* Directory Box Container with Toolbar, Table, and Pagination (Matching Students Directory) */}
      <div className="directory-box" style={{
        background: "var(--bg-card, var(--card))",
        border: "1px solid var(--border, var(--border))",
        borderRadius: 4,
        boxShadow: 'none',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        marginBottom: 24
      }}>
        {/* Top Header Filter Bar */}
        <div className="directory-box-header" style={{
          padding: '12px 18px',
          background: "var(--bg-card, var(--card))",
          borderBottom: "1px solid var(--border, var(--border))",
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: 260, maxWidth: 460, flex: '1 1 auto', height: 38, display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: "var(--muted-foreground)", pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search name, roll no, admission no, class..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: '100%',
                height: '100%',
                padding: '7px 12px 7px 32px',
                fontSize: 13,
                borderRadius: 4,
                border: "1px solid var(--border, var(--border))",
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Filters: Class, Section, Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={classFilter}
              onChange={e => {
                setClassFilter(e.target.value);
                setSectionFilter('');
                setPage(1);
              }}
              style={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}
            >
              <option value="">All Classes ({availableClasses.length})</option>
              {availableClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={sectionFilter}
              onChange={e => { setSectionFilter(e.target.value); setPage(1); }}
              style={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}
            >
              <option value="">All Sections ({availableSections.length})</option>
              {availableSections.map(s => (
                <option key={s} value={s}>Section {s}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
              style={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending Only ({eligibleCount})</option>
              <option value="PROCESSED">Processed Only ({items.length - eligibleCount})</option>
            </select>

            {/* Quick Bulk Selection Toggle */}
            {filteredEligible.length > 0 && (
              <button
                type="button"
                className="btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: 12.5,
                  borderRadius: 4,
                  border: "1px solid var(--border, var(--border))",
                  background: "var(--bg-card, var(--card))",
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: allFilteredEligibleSelected ? "var(--destructive)" : "var(--primary)"
                }}
                onClick={() => {
                  const next = { ...selected };
                  filteredEligible.forEach(x => {
                    next[x.id] = !allFilteredEligibleSelected;
                  });
                  setSelected(next);
                }}
              >
                {allFilteredEligibleSelected ? 'Deselect Filtered' : `Select Filtered (${filteredEligible.length})`}
              </button>
            )}

            {/* Quick Export Excel for selected Class & Section */}
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportExcel}
              style={{
                padding: '6px 12px',
                fontSize: 12.5,
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--secondary)",
                cursor: 'pointer',
                fontWeight: 600,
                color: "var(--success)",
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
              title={classFilter && sectionFilter 
                ? `Export promoted students of ${classFilter} - Section ${sectionFilter} to Excel` 
                : 'Select Class and Section to export promoted students to Excel'}
            >
              <FileSpreadsheet size={14} color="#03806a" /> Export Promoted (Excel)
            </button>
          </div>
        </div>

        {/* Sub-Toolbar (Matching User's Red Circle: Refresh, Last fetched, Rows per page, Showing X to Y of Z) */}
        <TableSubToolbar
          onRefresh={loadCandidates}
          loading={loading}
          lastFetchedAt={lastFetchedAt}
          pageSize={pageSize}
          onPageSizeChange={sz => { setPageSize(sz); setPage(1); scrollToTop(); }}
          totalCount={items.length}
          filteredCount={filteredItems.length}
          startIdx={startIdx}
          endIdx={endIdx}
          itemLabel="candidates"
          pageSizeOptions={[10, 25, 50, 100, 250, 500]}
        />

        {/* Scrollable Table Body */}
        <div className="directory-box-body" style={{
          overflowY: 'auto',
          overflowX: 'auto',
          maxHeight: 'min(65vh, 600px)',
          minHeight: 280,
          position: 'relative'
        }}>
          <table style={{ width: '100%', minWidth: 960, borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allDisplayedEligibleSelected}
                    disabled={displayedItems.filter(x => !x.already_processed).length === 0}
                    onChange={e => {
                      const allChecked = e.target.checked;
                      const next = { ...selected };
                      displayedItems.forEach(x => {
                        if (!x.already_processed) next[x.id] = allChecked;
                      });
                      setSelected(next);
                    }}
                    title="Select All on Current Page"
                  />
                </th>
                <th>Roll</th>
                <th>Admission No.</th>
                <th>Student Name</th>
                <th>Current Class</th>
                <th>Section</th>
                <th>Target Outcome</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: "var(--muted-foreground)" }}>
                    Loading candidate roster from database...
                  </td>
                </tr>
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: "var(--muted-foreground)" }}>
                    {items.length === 0
                      ? 'No students found for this academic session. Please select another source session.'
                      : 'No candidate students match the active search or filter criteria.'}
                  </td>
                </tr>
              ) : displayedItems.map(x => (
                <tr key={x.id} style={{ background: selected[x.id] ? "var(--accent)" : 'transparent' }}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      disabled={x.already_processed}
                      checked={!!selected[x.id]}
                      onChange={e => setSelected({ ...selected, [x.id]: e.target.checked })}
                    />
                  </td>
                  <td>
                    <span className="roll" style={{
                      fontWeight: 700,
                      background: "var(--accent)",
                      color: "var(--primary)",
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12
                    }}>
                      {x.roll || x.roll_number || '—'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: "var(--text, var(--muted-foreground))", background: "var(--card-subtle, var(--secondary))", padding: '2px 6px', borderRadius: 4, fontSize: '0.82rem' }}>
                      {x.admission_number || x.admissionNumber || '—'}
                    </span>
                  </td>
                  <td><PersonProfileLink kind="student" id={x.id} name={x.name} person={x as any}><b>{x.name}</b></PersonProfileLink></td>
                  <td>{x.from_class_name || '—'}</td>
                  <td>{x.from_section_name || '—'}</td>
                  <td>
                    <select
                      disabled={!selected[x.id]}
                      value={outcome[x.id] || 'PROMOTED'}
                      onChange={e => setOutcome({ ...outcome, [x.id]: e.target.value })}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: "1px solid var(--border, var(--border))",
                        fontSize: 12.5,
                        background: !selected[x.id] ? "var(--card)" : "var(--card)",
                        cursor: !selected[x.id] ? 'not-allowed' : 'pointer',
                        color: outcome[x.id] === 'RETAINED' ? "var(--destructive)" : outcome[x.id] === 'GRADUATED' ? "var(--success)" : "var(--foreground)"
                      }}
                    >
                      <option value="PROMOTED">PROMOTED (Next Class)</option>
                      <option value="RETAINED">RETAINED (Repeat Class)</option>
                      <option value="GRADUATED">GRADUATED (Alumni)</option>
                      <option value="TRANSFERRED">TRANSFERRED (Leaving)</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${x.already_processed ? 'sent' : 'queued'}`} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: x.already_processed ? "var(--secondary)" : "var(--secondary)",
                      color: x.already_processed ? "var(--success)" : "var(--warning)",
                      border: `1px solid ${x.already_processed ? "var(--border)" : "var(--border)"}`
                    }}>
                      {x.already_processed ? '✓ Processed' : '⏳ Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Footer (Matching User's Red Circle: Showing X to Y of Z, << First, < Prev, Page [1] of N, Next >, Last >>) */}
        <TablePaginationFooter
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={p => { setPage(p); scrollToTop(); }}
          startIdx={startIdx}
          endIdx={endIdx}
          filteredCount={filteredItems.length}
          totalCount={items.length}
          itemLabel="candidates"
          onScrollToTop={scrollToTop}
        />
      </div>

      {/* Universal Promotion Preview Modal */}
      <UniversalPreviewModal
        isOpen={promotionPreview.isOpen}
        onClose={() => setPromotionPreview(prev => ({ ...prev, isOpen: false }))}
        onEdit={() => setPromotionPreview(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeConfirmPromotion}
        title="Review Student Academic Promotion"
        subtitle="Verify target outcomes and candidate roster before executing promotions"
        operationType="submit"
        confirmText="Confirm & Process Promotions"
        editText="Back to Edit Roster"
        summaryCards={promotionPreview.summaryCards}
        tableData={promotionPreview.tableData}
        loading={promotionPreview.loading}
        error={promotionPreview.error}
      />
    </div>
  );
}
