import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  UniversalPreviewModal,
  DestructiveConfirmModal,
  PreviewSectionData,
  PreviewSummaryCard
} from '../../components/preview';

type ActionType = 'activate' | 'deactivate' | 'archive' | 'unarchive';

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
    type: ActionType;
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
      const r = await api.get('/academic-years');
      setItems(Array.isArray(r.data) ? r.data : []);
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
      await api.post('/academic-years', {
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

  function promptAction(item: any, type: ActionType) {
    let title = '';
    let warningMessage = '';
    let confirmText = '';

    if (type === 'activate') {
      title = 'Activate Academic Session';
      warningMessage = `Setting "${item.name}" as the active academic year will switch current school attendance and roster defaults to this session. Any previously active session will become inactive.`;
      confirmText = 'Set as Active Session';
    } else if (type === 'deactivate') {
      title = 'Deactivate Academic Session';
      warningMessage = `Deactivating "${item.name}" will set this session to inactive status. There will be no default active academic session until another is activated.`;
      confirmText = 'Deactivate Session';
    } else if (type === 'archive') {
      title = 'Archive Academic Session';
      warningMessage = `Archiving "${item.name}" will make historical records read-only. No further daily attendance or routine modifications will be permitted for this session.`;
      confirmText = 'Archive Session';
    } else if (type === 'unarchive') {
      title = 'Unarchive Academic Session';
      warningMessage = `Unarchiving "${item.name}" will restore it to inactive status, allowing it to be activated and modified again.`;
      confirmText = 'Unarchive Session';
    }

    setActionConfirm({
      isOpen: true,
      id: item.id,
      type,
      title,
      sessionName: item.name,
      warningMessage,
      confirmText,
      loading: false,
      error: null,
    });
  }

  async function executeConfirmAction() {
    setActionConfirm(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.post(`/academic-years/${actionConfirm.id}/${actionConfirm.type}`);
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
          <button type="submit">Create</button>
        </form>
      </div>

      {message && <div className="error">{message}</div>}
      {loading ? (
        <p className="muted">Loading academic years from database...</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['YEAR', 'START', 'END', 'STUDENTS', 'CLASSES', 'STATUS', 'ACTIONS'].map(h => (
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
                  <td>{x.student_count ?? 0}</td>
                  <td>{x.class_count ?? 0}</td>
                  <td>
                    <span
                      className={`badge ${x.is_archived ? 'expired' : x.is_active ? 'active' : ''}`}
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        background: x.is_archived ? '#fee2e2' : x.is_active ? '#dcfce7' : '#f1f5f9',
                        color: x.is_archived ? '#b91c1c' : x.is_active ? '#15803d' : '#475569'
                      }}
                    >
                      {x.is_archived ? 'ARCHIVED' : x.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td>
                    <div className="action-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {x.is_active ? (
                        <button
                          type="button"
                          className="small-btn warning-btn"
                          style={{
                            background: '#f59e0b',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.82rem'
                          }}
                          onClick={() => promptAction(x, 'deactivate')}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="small-btn"
                          style={{
                            background: '#1e60dc',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.82rem'
                          }}
                          onClick={() => promptAction(x, 'activate')}
                        >
                          Activate
                        </button>
                      )}

                      {x.is_archived ? (
                        <button
                          type="button"
                          className="small-btn"
                          style={{
                            background: '#059669',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.82rem'
                          }}
                          onClick={() => promptAction(x, 'unarchive')}
                        >
                          Unarchive
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="small-btn danger-btn"
                          style={{
                            background: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.82rem'
                          }}
                          onClick={() => promptAction(x, 'archive')}
                        >
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
                    No academic years created in database. Use the form above to create one.
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

      {/* Destructive Confirm Modal for Session Activate / Deactivate / Archive / Unarchive */}
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
