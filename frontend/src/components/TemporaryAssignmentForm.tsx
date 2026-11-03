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
    <div className="panel p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <PlusCircle size={18} className="text-blue-600 dark:text-blue-400" />
        <h3 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">
          Create Teacher Substitution
        </h3>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs mb-4">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs mb-4">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Substitute Teacher *
            </label>
            <select
              name="teacherId"
              value={form.teacherId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
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
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Class *
            </label>
            <select
              name="classId"
              value={form.classId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>Class {c.class_number ?? c.name ?? c.id}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Section *
            </label>
            <select
              name="sectionId"
              value={form.sectionId}
              onChange={handleChange}
              required
              disabled={!form.classId}
              className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{form.classId ? 'Select Section' : 'Choose Class first'}</option>
              {filteredSections.map((s) => (
                <option key={s.id} value={s.id}>Section {s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Start Date & Time *
            </label>
            <input
              type="datetime-local"
              name="startAt"
              value={form.startAt}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              End Date & Time *
            </label>
            <input
              type="datetime-local"
              name="endAt"
              value={form.endAt}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-60 transition-colors shadow-sm"
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
