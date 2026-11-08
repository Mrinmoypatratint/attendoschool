import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Database, Download, X } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import './BackupControls.css';

type Job = { id: string; status: 'queued' | 'running' | 'ready' | 'failed'; startedAt: string; requestedBy: { name?: string }; encrypted: boolean; size?: number; fileName?: string; error?: string; warnings?: string[] };
const size = (bytes?: number) => bytes ? `${(bytes / 1048576).toFixed(2)} MB` : '—';
export default function BackupControls({ panel = false }: { panel?: boolean }) {
  const { user } = useAuth();
  const owner = user?.role === 'SUPER_ADMIN';
  const [open, setOpen] = useState(false), [jobs, setJobs] = useState<Job[]>([]);
  const [encrypted, setEncrypted] = useState<boolean | null>(null), [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(''), [completed, setCompleted] = useState<Job | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), menu = useRef<HTMLDivElement>(null);
  const previous = useRef<Job[]>([]);
  const refresh = useCallback(async () => {
    if (!owner) return;
    try {
      const { data } = await api.get('/backups/jobs');
      const rows: Job[] = data.jobs;
      const finished = rows.find(j => j.status === 'ready' && previous.current.some(p => p.id === j.id && ['running', 'queued'].includes(p.status)));
      if (finished) { setCompleted(finished); setNotice('Backup ready. Save a copy on your laptop.'); }
      previous.current = rows; setJobs(rows); setEncrypted(data.encrypted);
    } catch (e: any) { setNotice(e?.response?.data?.message || 'Unable to load backups'); }
  }, [owner]);
  useEffect(() => { if (owner) void refresh(); }, [owner, refresh]);
  const running = jobs.some(j => ['queued', 'running'].includes(j.status));
  useEffect(() => { if (!owner) return; const timer = window.setInterval(() => void refresh(), running ? 3000 : 30000); return () => window.clearInterval(timer); }, [owner, running, refresh]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, []);
  if (!owner) return panel ? <p>Only the platform Super Admin can take or download backups.</p> : null;
  const latest = jobs.find(j => j.status === 'ready');
  async function create() {
    setBusy(true); setNotice(''); setCompleted(null); setOpen(false);
    try {
      await api.post('/backups/create'); setNotice('Backup queued. You can keep using the app.'); await refresh();
    } catch (e: any) { setNotice(e?.response?.data?.message || 'Unable to queue backup'); }
    finally { setBusy(false); }
  }
  async function download(job: Job) {
    setOpen(false);
    try {
      // Server streams the archive; the browser handles the save prompt.
      const response = await api.get(`/backups/${encodeURIComponent(job.id)}/download`, { responseType: 'blob', timeout: 0 });
      const url = URL.createObjectURL(response.data), link = document.createElement('a');
      link.href = url; link.download = job.fileName || `${job.id}.tar${job.encrypted ? '.age' : ''}`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      let message = 'Download failed. Refresh the backup list and retry.';
      if (e?.response?.data instanceof Blob) { try { message = JSON.parse(await e.response.data.text()).message || message; } catch {} }
      setNotice(message);
    }
  }
  const warning = encrypted === false && <p role="alert" style={{ color: 'var(--warning)' }}>Encryption is off. Backups exclude environment secrets but still contain private data. Configure BACKUP_AGE_RECIPIENT before storing files online.</p>;
  const table = <>
    {warning}
    <p>Encrypted files open on your laptop with <code>age -d -i key FILE | tar xf -</code>. Keep the private key offline. See docs/backup.md.</p>
    <button className="sa-btn-secondary" onClick={() => void refresh()}>Refresh</button>
    <div className="sa-table-responsive"><table className="sa-table">
      <thead><tr><th>Time</th><th>Requested by</th><th>Size</th><th>Protection</th><th>Status</th><th>Download / Details</th></tr></thead>
      <tbody>{jobs.map(job => <tr key={job.id}>
        <td>{new Date(job.startedAt).toLocaleString()}</td><td>{job.requestedBy?.name || 'System'}</td><td>{size(job.size)}</td>
        <td>{job.encrypted ? 'age encrypted' : 'Unencrypted'}</td><td>{job.status}</td>
        <td>{job.status === 'ready' && <button className="sa-btn-secondary" onClick={() => void download(job)}>Download</button>}
          {job.error && <p role="alert">{job.error}</p>}{job.warnings?.map(w => <p key={w}>{w}</p>)}</td>
      </tr>)}{!jobs.length && <tr><td colSpan={6}>No backups recorded. Daily scheduling requires the one-time setup in docs/backup.md.</td></tr>}</tbody>
    </table></div>
  </>;
  return <div ref={menu} className="backup-controls" style={{ position: 'relative' }}>
    {panel ? <><div className="sa-module-head"><h1 className="sa-module-title">Backup & Disaster Recovery</h1><button className="sa-btn-primary" disabled={busy || running} onClick={() => void create()}>{running ? 'Backup in progress' : 'Take backup now'}</button></div>{table}</> : <>
      <button className="sa-btn-secondary" aria-label="Backups" aria-expanded={open} onClick={() => setOpen(!open)}><Database size={16} /><span>Backups</span></button>
      {open && <div className="sa-popover backup-menu">
        {warning}<button className="sa-btn-secondary" disabled={busy || running} onClick={() => void create()}>{running ? 'Backup in progress' : 'Take backup now'}</button>
        <button className="sa-btn-secondary" disabled={!latest} onClick={() => latest && void download(latest)}>Download latest backup</button>
        <button className="sa-btn-secondary" onClick={() => { setOpen(false); dialog.current?.showModal(); void refresh(); }}>All backups…</button>
      </div>}
      <dialog ref={dialog} style={{ width: 'min(1000px, calc(100vw - 32px))', maxHeight: '85vh', padding: 24, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--card)', color: 'var(--foreground)' }} aria-label="All backups">
        <div className="sa-module-head"><h2>All backups</h2><button className="sa-icon-btn" aria-label="Close backups" onClick={() => dialog.current?.close()}><X size={20} /></button></div>{table}
      </dialog>
    </>}
    {notice && <div role="status" className="panel" style={panel ? { marginTop: 16, padding: 12 } : { position: 'fixed', bottom: 20, right: 16, maxWidth: 'min(420px, calc(100vw - 32px))', padding: 16, zIndex: 1000, background: 'var(--card)', border: '1px solid var(--border)' }}>
      {notice} {completed && <button className="sa-btn-secondary" onClick={() => void download(completed)}><Download size={14} />Download</button>}
      <button className="sa-icon-btn" aria-label="Dismiss backup message" onClick={() => setNotice('')}><X size={14} /></button>
    </div>}
  </div>;
}
