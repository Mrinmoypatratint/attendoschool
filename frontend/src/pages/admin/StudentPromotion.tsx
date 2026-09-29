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
        setFromYear(r.data.find((x: any) => x.is_active)?.id || r.data[0].id);
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
        roll: x.roll,
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

    const headers = ['Roll', 'Student Name', 'Current Class', 'Target Outcome'];
    const previewRows = candidateList.map(c => [
      c.roll || '—',
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

  return (
    <div className="feature-page">
      <h1>Student Promotion</h1>
      <p className="muted">Transition students into a new academic session while preserving historical records and attendance.</p>

      <div className="filter-row">
        <label>
          From
          <select value={fromYear} onChange={e => setFromYear(e.target.value)}>
            <option value="">Select Session</option>
            {years.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </label>
        <label>
          To
          <select value={toYear} onChange={e => setToYear(e.target.value)}>
            <option value="">Select Target Session</option>
            {years.filter(y => y.id !== fromYear && !y.is_archived).map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </label>
        <button onClick={initiateProcess}>
          Review & Process Selected
        </button>
      </div>

      {message && <div className="success" style={{ marginBottom: 16 }}>{message}</div>}

      {loading ? (
        <p className="muted">Loading students for promotion...</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Select', 'Student', 'Roll', 'Current Class', 'Section', 'Outcome', 'Status'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(x => (
                <tr key={x.id}>
                  <td>
                    <input
                      type="checkbox"
                      disabled={x.already_processed}
                      checked={!!selected[x.id]}
                      onChange={e => setSelected({ ...selected, [x.id]: e.target.checked })}
                    />
                  </td>
                  <td><b>{x.name}</b></td>
                  <td>{x.roll}</td>
                  <td>{x.from_class_name || '-'}</td>
                  <td>{x.from_section_name || '-'}</td>
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
                  <td colSpan={7} className="muted" style={{ padding: 20 }}>
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
