import React, { useEffect, useState, useMemo, useRef } from 'react';
import { api } from '../../api';
import {
  UniversalPreviewModal,
  PreviewSummaryCard,
  PreviewTableData
} from '../../components/preview';
import { TableSubToolbar, TablePaginationFooter } from '../../components/TablePagination';
import { Search, Filter, CheckSquare, Square, ArrowUpDown, Sparkles } from 'lucide-react';

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

  // Distinct classes and sections from current candidates
  const availableClasses = useMemo(() => {
    const s = new Set<string>();
    items.forEach(x => {
      if (x.from_class_name) s.add(x.from_class_name);
    });
    return Array.from(s).sort();
  }, [items]);

  const availableSections = useMemo(() => {
    const s = new Set<string>();
    items.forEach(x => {
      if (x.from_section_name) s.add(x.from_section_name);
    });
    return Array.from(s).sort();
  }, [items]);

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

  const eligibleCount = items.filter(x => !x.already_processed).length;
  const filteredEligible = filteredItems.filter(x => !x.already_processed);
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allFilteredEligibleSelected = filteredEligible.length > 0 && filteredEligible.every(x => selected[x.id]);
  const allDisplayedEligibleSelected = displayedItems.filter(x => !x.already_processed).length > 0 &&
    displayedItems.filter(x => !x.already_processed).every(x => selected[x.id]);

  return (
    <div className="feature-page" ref={tableTopRef}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
        <div>
          <p className="eyebrow" style={{ margin: '0 0 4px', color: '#6366f1', fontWeight: 700 }}>ACADEMIC TRANSITION</p>
          <h1 style={{ margin: 0, fontSize: 24 }}>Student Promotion</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Transition students into a new academic session while preserving historical records and attendance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={initiateProcess}
            disabled={selectedCount === 0 || !toYear}
            className="btn-primary"
            style={{
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: (selectedCount === 0 || !toYear) ? 'var(--btn-disabled-bg, #94a3b8)' : '#2563eb',
              color: '#ffffff',
              borderRadius: 8,
              cursor: (selectedCount === 0 || !toYear) ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <ArrowUpDown size={15} /> Review & Process Selected ({selectedCount})
          </button>
        </div>
      </div>

      {/* Session Selection Row */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border, #cbd5e1)',
        borderRadius: 10,
        padding: '16px 20px',
        marginBottom: 16,
        display: 'flex',
        gap: 16,
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
      }}>
        <label style={{ minWidth: 240, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
          <span>Source Session (From) <span style={{ color: '#ef4444' }}>*</span></span>
          <select
            value={fromYear}
            onChange={e => setFromYear(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', fontSize: 13 }}
          >
            <option value="">Select Academic Session</option>
            {years.map(y => (
              <option key={y.id} value={y.id}>{y.name} {y.is_active ? '(Active)' : ''}</option>
            ))}
          </select>
        </label>

        <label style={{ minWidth: 240, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
          <span>Target Session (To) <span style={{ color: '#ef4444' }}>*</span></span>
          <select
            value={toYear}
            onChange={e => setToYear(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', fontSize: 13 }}
          >
            <option value="">Select Target Academic Session</option>
            {years.filter(y => y.id !== fromYear && !y.is_archived).map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </label>

        <div style={{ fontSize: 12.5, color: 'var(--text-muted, #64748b)', paddingBottom: 6 }}>
          {eligibleCount} pending eligible student(s) ready for transition
        </div>
      </div>

      {message && (
        <div className="success" style={{
          marginBottom: 16,
          padding: '12px 16px',
          borderRadius: 8,
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          color: '#10b981',
          fontSize: 13
        }}>
          {message}
        </div>
      )}

      {/* Directory Box Container with Toolbar, Table, and Pagination (Matching Students Directory) */}
      <div className="directory-box" style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        marginBottom: 24
      }}>
        {/* Top Header Filter Bar */}
        <div className="directory-box-header" style={{
          padding: '12px 18px',
          background: 'var(--bg-card, #ffffff)',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: 220, maxWidth: 380, flex: '1 1 auto', height: 38, display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search name, roll, admission number, class..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: '100%',
                height: '100%',
                padding: '7px 12px 7px 32px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid var(--border, #cbd5e1)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Filters: Class, Section, Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={classFilter}
              onChange={e => { setClassFilter(e.target.value); setPage(1); }}
              style={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border, #cbd5e1)' }}
            >
              <option value="">All Classes ({availableClasses.length})</option>
              {availableClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={sectionFilter}
              onChange={e => { setSectionFilter(e.target.value); setPage(1); }}
              style={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border, #cbd5e1)' }}
            >
              <option value="">All Sections ({availableSections.length})</option>
              {availableSections.map(s => (
                <option key={s} value={s}>Section {s}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
              style={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border, #cbd5e1)' }}
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
                  borderRadius: 6,
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'var(--bg-card, #ffffff)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: allFilteredEligibleSelected ? '#dc2626' : '#2563eb'
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
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    Loading candidate roster from database...
                  </td>
                </tr>
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    {items.length === 0
                      ? 'No students found for this academic session. Please select another source session.'
                      : 'No candidate students match the active search or filter criteria.'}
                  </td>
                </tr>
              ) : displayedItems.map(x => (
                <tr key={x.id} style={{ background: selected[x.id] ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }}>
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
                      background: 'rgba(37, 99, 235, 0.12)',
                      color: '#3b82f6',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12
                    }}>
                      {x.roll || x.roll_number || '—'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text, #334155)', background: 'var(--card-subtle, #f1f5f9)', padding: '2px 6px', borderRadius: 4, fontSize: '0.82rem' }}>
                      {x.admission_number || x.admissionNumber || '—'}
                    </span>
                  </td>
                  <td><b>{x.name}</b></td>
                  <td>{x.from_class_name || '—'}</td>
                  <td>{x.from_section_name || '—'}</td>
                  <td>
                    <select
                      disabled={!selected[x.id]}
                      value={outcome[x.id] || 'PROMOTED'}
                      onChange={e => setOutcome({ ...outcome, [x.id]: e.target.value })}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border, #cbd5e1)',
                        fontSize: 12.5,
                        background: !selected[x.id] ? '#f8fafc' : '#ffffff',
                        cursor: !selected[x.id] ? 'not-allowed' : 'pointer',
                        color: outcome[x.id] === 'RETAINED' ? '#dc2626' : outcome[x.id] === 'GRADUATED' ? '#059669' : '#1e293b'
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
                      background: x.already_processed ? '#dcfce7' : '#fef3c7',
                      color: x.already_processed ? '#166534' : '#b45309',
                      border: `1px solid ${x.already_processed ? '#bbf7d0' : '#fde68a'}`
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
