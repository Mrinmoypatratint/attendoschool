import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { UniversalPreviewModal, DestructiveConfirmModal, PreviewSectionData } from '../../components/preview';

export default function Communication() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', message: '', audienceType: 'SCHOOL', priority: 'NORMAL' });
  const [msg, setMsg] = useState('');

  // Universal Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Confirm publish state
  const [publishTarget, setPublishTarget] = useState<any | null>(null);
  const [publishing, setPublishing] = useState(false);

  async function load() {
    try {
      setItems((await api.get('/communication/announcements')).data);
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Unable to load announcements');
    }
  }

  useEffect(() => { load(); }, []);

  // Stage 1 Validation & Preview Trigger
  function handleInitiateCreate() {
    if (!form.title.trim()) {
      alert('Announcement title is required.');
      return;
    }
    if (!form.message.trim()) {
      alert('Message content is required.');
      return;
    }
    setPreviewError(null);
    setPreviewOpen(true);
  }

  // Stage 2 Validation & Persistence
  async function handleConfirmCreate() {
    if (!form.title.trim() || !form.message.trim()) {
      setPreviewError('Title and message cannot be empty.');
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      await api.post('/communication/announcements', form);
      setMsg('Announcement saved successfully!');
      setForm({ title: '', message: '', audienceType: 'SCHOOL', priority: 'NORMAL' });
      setPreviewOpen(false);
      load();
    } catch (e: any) {
      const errMsg = e?.response?.data?.message || 'Unable to save announcement';
      setPreviewError(errMsg);
    } finally {
      setPreviewLoading(false);
    }
  }

  // Publish Announcement Execution
  async function handleConfirmPublish() {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      await api.post(`/communication/announcements/${publishTarget.id}/publish`);
      setMsg(`Announcement "${publishTarget.title}" published and delivered to recipients!`);
      setPublishTarget(null);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Unable to publish announcement');
    } finally {
      setPublishing(false);
    }
  }

  const previewSections: PreviewSectionData[] = [
    {
      title: 'Broadcast Scope & Urgency',
      fields: [
        { label: 'Audience Target', value: form.audienceType, type: 'badge', color: 'blue' },
        { 
          label: 'Priority Level', 
          value: form.priority, 
          type: 'badge', 
          color: form.priority === 'EMERGENCY' ? 'red' : form.priority === 'HIGH' ? 'amber' : 'slate' 
        },
      ]
    },
    {
      title: 'Announcement Content',
      fields: [
        { label: 'Title', value: form.title },
        { label: 'Message Body', value: form.message },
      ]
    }
  ];

  return (
    <div className="feature-page">
      <h1>School–Parent Communication</h1>
      <p className="muted">Create and publish announcements to parents, classes, or the entire school.</p>

      <div className="form-card">
        <h3>New Announcement</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <input 
            placeholder="Announcement title" 
            value={form.title} 
            onChange={e => setForm({ ...form, title: e.target.value })} 
          />
          <textarea 
            placeholder="Message body" 
            value={form.message} 
            onChange={e => setForm({ ...form, message: e.target.value })} 
            style={{ minHeight: 100 }} 
          />
          <div className="form-inline">
            <select value={form.audienceType} onChange={e => setForm({ ...form, audienceType: e.target.value })}>
              <option value="SCHOOL">Entire School</option>
              <option value="CLASS">Specific Class</option>
              <option value="SECTION">Specific Section</option>
              <option value="PARENTS">All Parents</option>
            </select>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="NORMAL">Normal Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="EMERGENCY">Emergency Alert</option>
            </select>
            <button type="button" onClick={handleInitiateCreate}>
              Preview & Save Announcement
            </button>
          </div>
        </div>
      </div>

      {msg && <div className="success" style={{ marginTop: 12 }}>{msg}</div>}

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Audience</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Recipients</th>
              <th>Read</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map(x => (
              <tr key={x.id}>
                <td><b>{x.title}</b></td>
                <td><span className="badge">{x.audience_type}</span></td>
                <td><span className={`badge ${x.priority === 'EMERGENCY' ? 'failed' : x.priority === 'HIGH' ? 'queued' : ''}`}>{x.priority}</span></td>
                <td><span className={`badge ${x.status === 'PUBLISHED' ? 'sent' : 'queued'}`}>{x.status}</span></td>
                <td>{x.recipient_count || 0}</td>
                <td>{x.read_count || 0}</td>
                <td>
                  {x.status !== 'PUBLISHED' && (
                    <button className="small-btn" onClick={() => setPublishTarget(x)}>
                      Publish Now
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24 }} className="muted">
                  No announcements broadcast yet. Fill out the form above to draft one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Universal Preview Modal for New Announcement */}
      <UniversalPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onEdit={() => setPreviewOpen(false)}
        onConfirm={handleConfirmCreate}
        title="Preview Announcement Broadcast"
        subtitle={`Target: ${form.audienceType} · Priority: ${form.priority}`}
        operationType="create"
        confirmText="Confirm & Save Announcement"
        editText="Back to Edit Draft"
        sections={previewSections}
        loading={previewLoading}
        error={previewError}
      />

      {/* Confirmation Modal for Publishing Announcement */}
      <DestructiveConfirmModal
        isOpen={!!publishTarget}
        onClose={() => setPublishTarget(null)}
        onConfirm={handleConfirmPublish}
        title="Confirm Announcement Broadcast"
        entityName={publishTarget?.title || 'Announcement'}
        entityType="Announcement"
        warningMessage="This action will deliver notification broadcasts to all designated recipients and inboxes immediately."
        confirmText="Confirm & Broadcast"
        loading={publishing}
        details={[
          { label: 'Audience Scope', value: publishTarget?.audience_type || '' },
          { label: 'Priority', value: publishTarget?.priority || '' }
        ]}
      />
    </div>
  );
}


