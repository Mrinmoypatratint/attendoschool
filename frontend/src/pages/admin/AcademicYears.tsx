import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  UniversalPreviewModal,
  DestructiveConfirmModal,
  PreviewSectionData,
  PreviewSummaryCard
} from '../../components/preview';

export default function AcademicYears() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Preview State for Session Creation
  const [createPreview, setCreatePreview] = useState<{
    isOpen: boolean;
    sections: PreviewSectionData[];
    summaryCards: PreviewSummaryCard[];
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    sections: [],
    summaryCards: [],
    loading: false,
    error: null,
  });

  // Action Confirmation State
  const [actionConfirm, setActionConfirm] = useState<{
    isOpen: boolean;
    id: string;
    type: 'activate' | 'archive';
    title: string;
    sessionName: string;
    warningMessage: string;
    confirmText: string;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    id: '',
    type: 'activate',
    title: '',
    sessionName: '',
    warningMessage: '',
    confirmText: 'Confirm',
    loading: false,
    error: null,
  });

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/academic-years-v15');
      setItems(r.data);
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e?.message || 'Unable to load academic sessions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function initiateCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');

    if (!name.trim()) {
      alert('Validation Error: Please enter session name (e.g. 2026–27).');
      return;
    }
    if (!startDate || !endDate) {
      alert('Validation Error: Both start date and end date are mandatory.');
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      alert('Validation Error: Start date must precede end date.');
      return;
    }

    const willBeActive = items.length === 0;

    const sections: PreviewSectionData[] = [
      {
        title: 'Academic Session Coordinates',
        fields: [
          { label: 'Session Name', value: name.trim(), color: 'blue' },
          { label: 'Start Date', value: startDate, type: 'date' },
          { label: 'End Date', value: endDate, type: 'date' },
          { label: 'Initial Activation', value: willBeActive ? 'Active (Initial Default Session)' : 'Inactive (Draft Session)', type: 'badge', color: willBeActive ? 'green' : 'slate' }
        ]
      }
    ];

    const summaryCards: PreviewSummaryCard[] = [
      { label: 'Session Title', value: name.trim(), color: 'blue' },
      { label: 'Duration', value: `${startDate.slice(0, 7)} → ${endDate.slice(0, 7)}`, color: 'purple' },
      { label: 'Initial State', value: willBeActive ? 'Active' : 'Inactive', color: willBeActive ? 'green' : 'amber' }
    ];

    setCreatePreview({
      isOpen: true,
      sections,
      summaryCards,
      loading: false,
      error: null,
    });
  }

  async function executeConfirmCreate() {
    setCreatePreview(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.post('/academic-years-v15', {
        name: name.trim(),
        startDate,
        endDate,
        makeActive: items.length === 0
      });
      setName('');
      setStartDate('');
      setEndDate('');
      setCreatePreview(prev => ({ ...prev, isOpen: false, loading: false }));
      await load();
    } catch (e: any) {
      setCreatePreview(prev => ({
        ...prev,
        loading: false,
        error: e?.response?.data?.message || e?.message || 'Create session failed'
      }));
    }
  }

  function promptAction(item: any, type: 'activate' | 'archive') {
    setActionConfirm({
      isOpen: true,
      id: item.id,
      type,
      title: type === 'activate' ? 'Activate Academic Session' : 'Archive Academic Session',
      sessionName: item.name,
      warningMessage: type === 'activate'
        ? `Setting "${item.name}" as the active academic year will switch current school attendance and roster defaults to this session.`
        : `Archiving "${item.name}" will make historical records read-only. No further daily attendance modifications will be permitted for this session.`,
      confirmText: type === 'activate' ? 'Set as Active Session' : 'Archive Session',
      loading: false,
      error: null,
    });
  }

  async function executeConfirmAction() {
    setActionConfirm(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.post(`/academic-years-v15/${actionConfirm.id}/${actionConfirm.type}`);
      setActionConfirm(prev => ({ ...prev, isOpen: false, loading: false }));
      await load();
    } catch (e: any) {
      setActionConfirm(prev => ({
        ...prev,
        loading: false,
        error: e?.response?.data?.message || e?.message || 'Action failed'
      }));
    }
  }

  return (
    <div className="feature-page">
      <h1>Academic Years</h1>
      <p className="muted">Manage school sessions while preserving historical attendance and audit trails.</p>

      <div className="form-card">
        <h3>Create Academic Year</h3>
        <form onSubmit={initiateCreate} className="form-inline">
          <input
            placeholder="e.g. 2026–27"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <label>
            Start date
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
            />
          </label>
          <label>
            End date
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              required
            />
          </label>
          <button type="submit">Review & Create</button>
        </form>
      </div>

      {message && <div className="error">{message}</div>}
      {loading ? (
        <p className="muted">Loading academic years...</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Year', 'Start', 'End', 'Students', 'Classes', 'Status', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(x => (
                <tr key={x.id}>
                  <td><b>{x.name}</b></td>
                  <td>{String(x.start_date).slice(0, 10)}</td>
                  <td>{String(x.end_date).slice(0, 10)}</td>
                  <td>{x.student_count}</td>
                  <td>{x.class_count}</td>
                  <td>
                    <span className={`badge ${x.is_archived ? 'expired' : x.is_active ? 'active' : ''}`}>
                      {x.is_archived ? 'Archived' : x.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-row">
                      {!x.is_active && !x.is_archived && (
                        <button className="small-btn" onClick={() => promptAction(x, 'activate')}>
                          Activate
                        </button>
                      )}
                      {!x.is_active && !x.is_archived && (
                        <button className="small-btn danger-btn" onClick={() => promptAction(x, 'archive')}>
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: 20 }}>
                    No academic years created.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Universal Session Creation Preview Modal */}
      <UniversalPreviewModal
        isOpen={createPreview.isOpen}
        onClose={() => setCreatePreview(prev => ({ ...prev, isOpen: false }))}
        onEdit={() => setCreatePreview(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeConfirmCreate}
        title="Review Academic Session Creation"
        subtitle="Verify dates and initial activation state before committing"
        operationType="create"
        confirmText="Confirm & Create Session"
        editText="Back to Edit"
        sections={createPreview.sections}
        summaryCards={createPreview.summaryCards}
        loading={createPreview.loading}
        error={createPreview.error}
      />

      {/* Destructive Confirm Modal for Session Activate / Archive */}
      <DestructiveConfirmModal
        isOpen={actionConfirm.isOpen}
        onClose={() => setActionConfirm(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeConfirmAction}
        title={actionConfirm.title}
        entityName={actionConfirm.sessionName}
        entityType="Academic Session"
        warningMessage={actionConfirm.warningMessage}
        confirmText={actionConfirm.confirmText}
        loading={actionConfirm.loading}
        error={actionConfirm.error}
      />
    </div>
  );
}
