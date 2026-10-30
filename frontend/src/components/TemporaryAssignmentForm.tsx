import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { createAssignment } from '../services/temporaryAssignmentApi';
import { AlertCircle, CheckCircle2, Loader2, PlusCircle } from 'lucide-react';

interface Teacher {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  employee_id?: string;
  savior_no?: string;
}

interface Class {
  id: string;
  class_number?: number;
  name?: string;
  label?: string;
}

interface Section {
  id: string;
  name: string;
  class_id: string;
}

interface Props {
  onSuccess?: () => void;
}

export default function TemporaryAssignmentForm({ onSuccess }: Props) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    teacherId: '',
    classId: '',
    sectionId: '',
    startAt: '',
    endAt: '',
  });

  // Load selectors safely
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [tRes, cRes, sRes] = await Promise.all([
          api.get('/teachers'),
          api.get('/classes'),
          api.get('/sections'),
        ]);
        if (!isMounted) return;

        const rawTeachers = Array.isArray(tRes.data) ? tRes.data : (tRes.data?.data || []);
        const rawClasses = Array.isArray(cRes.data) ? cRes.data : (cRes.data?.data || []);
        const rawSections = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.data || []);

        setTeachers(rawTeachers);
        setClasses(rawClasses.sort((a: any, b: any) => Number(a.class_number ?? 0) - Number(b.class_number ?? 0)));
        setSections(rawSections);
      } catch (e: any) {
        if (!isMounted) return;
        setError(e?.response?.data?.message || 'Failed to load teachers or classes');
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      // Reset section if class changed
      ...(name === 'classId' ? { sectionId: '' } : {})
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!form.teacherId || !form.classId || !form.sectionId || !form.startAt || !form.endAt) {
      setError('All fields (Teacher, Class, Section, Start Date/Time, End Date/Time) are required.');
      return;
    }

    const start = new Date(form.startAt);
    const end = new Date(form.endAt);
    if (end <= start) {
      setError('End date/time must be strictly later than start date/time.');
      return;
    }

    setLoading(true);
    try {
      await createAssignment({
        teacherId: form.teacherId,
        classId: form.classId,
        sectionId: form.sectionId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });
      setForm({ teacherId: '', classId: '', sectionId: '', startAt: '', endAt: '' });
      setSuccessMsg('Temporary assignment created successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
      window.dispatchEvent(new CustomEvent('temporary-assignments-updated'));
      if (onSuccess) onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create temporary assignment');
    } finally {
      setLoading(false);
    }
  };

  // Filter sections based on selected class
  const filteredSections = form.classId
    ? sections.filter((sec) => sec.class_id === form.classId)
    : [];

  return (
    <div className="panel" style={{ padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <PlusCircle size={18} style={{ color: 'var(--primary, #2563eb)' }} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
          Create Teacher Substitution
        </h3>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 8,
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          marginBottom: 16,
          fontSize: 13
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 8,
          background: 'rgba(16, 185, 129, 0.1)',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          marginBottom: 16,
          fontSize: 13
        }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Substitute Teacher *
            </label>
            <select
              name="teacherId"
              value={form.teacherId}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13 }}
            >
              <option value="">Select Teacher</option>
              {teachers.map((t) => {
                const name = t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email || t.id;
                const emp = t.employee_id || t.savior_no ? ` [${t.employee_id || t.savior_no}]` : '';
                return (
                  <option key={t.id} value={t.id}>{name}{emp}</option>
                );
              })}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Class *
            </label>
            <select
              name="classId"
              value={form.classId}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13 }}
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>Class {c.class_number ?? c.name ?? c.id}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Section *
            </label>
            <select
              name="sectionId"
              value={form.sectionId}
              onChange={handleChange}
              required
              disabled={!form.classId}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13 }}
            >
              <option value="">{form.classId ? 'Select Section' : 'Choose Class first'}</option>
              {filteredSections.map((s) => (
                <option key={s.id} value={s.id}>Section {s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Start Date & Time *
            </label>
            <input
              type="datetime-local"
              name="startAt"
              value={form.startAt}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13 }}
            >
            </input>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              End Date & Time *
            </label>
            <input
              type="datetime-local"
              name="endAt"
              value={form.endAt}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13 }}
            >
            </input>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', fontSize: 13 }}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Creating Assignment...</span>
              </>
            ) : (
              <span>Create Temporary Assignment</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
