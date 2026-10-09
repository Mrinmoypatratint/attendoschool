import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  UniversalPreviewModal,
  PreviewSummaryCard,
  PreviewTableData
} from '../../components/preview';

export default function StudentPromotion() {
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [years, setYears] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

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
      setItems(r.data);
      setSelected({});
      setOutcome({});
    } catch (e: any) {
      setMessage(e?.response?.data?.message || 'Unable to load candidate roster');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadYears(); }, []);
  useEffect(() => { loadCandidates(); }, [fromYear]);

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

    const outcomeCounts = candidateList.reduce((acc: any, cur) => {
      acc[cur.outcome] = (acc[cur.outcome] || 0) + 1;
      return acc;
    }, {});

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
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allEligibleSelected = eligibleCount > 0 && items.filter(x => !x.already_processed).every(x => selected[x.id]);

  return (
    <div className="feature-page">
      <h1>Student Promotion</h1>
      <p className="muted">Transition students into a new academic session while preserving historical records and attendance.</p>

      <div className="filter-row" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ minWidth: 220 }}>
          From
          <select value={fromYear} onChange={e => setFromYear(e.target.value)}>
            <option value="">Select Session</option>
            {years.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </label>
        <label style={{ minWidth: 220 }}>
          To
          <select value={toYear} onChange={e => setToYear(e.target.value)}>
            <option value="">Select Target Session</option>
            {years.filter(y => y.id !== fromYear && !y.is_archived).map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </label>
        <button onClick={initiateProcess} disabled={selectedCount === 0 || !toYear}>
          Review & Process Selected ({selectedCount})
        </button>
      </div>

      {message && <div className="success" style={{ marginBottom: 16 }}>{message}</div>}

      {loading ? (
        <p className="muted">Loading students for promotion...</p>
      ) : (
        <div className="table-wrap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '4px 8px' }}>
            <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
              Showing <strong>{items.length}</strong> candidate(s) ({eligibleCount} pending, {items.length - eligibleCount} processed)
            </span>
            {eligibleCount > 0 && (
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.82rem', padding: '4px 10px' }}
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  items.forEach(x => {
                    if (!x.already_processed) next[x.id] = !allEligibleSelected;
                  });
                  setSelected(next);
                }}
              >
                {allEligibleSelected ? 'Deselect All' : 'Select All Eligible'}
              </button>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allEligibleSelected}
                    disabled={eligibleCount === 0}
                    onChange={e => {
                      const allChecked = e.target.checked;
                      const next: Record<string, boolean> = {};
                      items.forEach(x => {
                        if (!x.already_processed) next[x.id] = allChecked;
                      });
                      setSelected(next);
                    }}
                    title="Select All Eligible"
                  />
                </th>
                {['Student', 'Roll', 'Admission No.', 'Current Class', 'Section', 'Outcome', 'Status'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(x => (
                <tr key={x.id}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      disabled={x.already_processed}
                      checked={!!selected[x.id]}
                      onChange={e => setSelected({ ...selected, [x.id]: e.target.checked })}
                    />
                  </td>
                  <td><b>{x.name}</b></td>
                  <td>{x.roll || x.roll_number || '—'}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: '0.82rem' }}>
                      {x.admission_number || x.admissionNumber || '—'}
                    </span>
                  </td>
                  <td>{x.from_class_name || '—'}</td>
                  <td>{x.from_section_name || '—'}</td>
                  <td>
                    <select
                      disabled={!selected[x.id]}
                      value={outcome[x.id] || 'PROMOTED'}
                      onChange={e => setOutcome({ ...outcome, [x.id]: e.target.value })}
                    >
                      <option>PROMOTED</option>
                      <option>RETAINED</option>
                      <option>GRADUATED</option>
                      <option>TRANSFERRED</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${x.already_processed ? 'sent' : 'queued'}`}>
                      {x.already_processed ? 'Processed' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={8} className="muted" style={{ padding: 20 }}>
                    No students found for this academic year.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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
