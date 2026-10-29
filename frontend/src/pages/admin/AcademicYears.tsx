import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../api';
import {
  UniversalPreviewModal,
  DestructiveConfirmModal,
  PreviewSectionData,
  PreviewSummaryCard
} from '../../components/preview';
import {
  CalendarDays,
  Clock,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  Sliders,
  Calendar,
  Layers,
  Info,
  ShieldAlert,
  ChevronRight,
  Filter,
  Edit2,
  X
} from 'lucide-react';

type ActionType = 'activate' | 'deactivate' | 'archive' | 'unarchive';
type TabKey = 'sessions' | 'working-days' | 'holidays' | 'calculator';

const DAY_LABELS = [
  { day: 0, name: 'Sunday', short: 'Sun' },
  { day: 1, name: 'Monday', short: 'Mon' },
  { day: 2, name: 'Tuesday', short: 'Tue' },
  { day: 3, name: 'Wednesday', short: 'Wed' },
  { day: 4, name: 'Thursday', short: 'Thu' },
  { day: 5, name: 'Friday', short: 'Fri' },
  { day: 6, name: 'Saturday', short: 'Sat' },
];

export default function AcademicYears({ defaultTab }: { defaultTab?: TabKey }) {
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab || 'sessions');

  /* ─────────────────────────────────────────────────────────────
     1. Academic Sessions State
  ───────────────────────────────────────────────────────────── */
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Date Year Formatter helper (restrict year to max 4 digits)
  function handleDateInput(val: string, setter: (v: string) => void) {
    if (!val) {
      setter('');
      return;
    }
    const parts = val.split('-');
    if (parts[0] && parts[0].length > 4) {
      parts[0] = parts[0].slice(0, 4);
      setter(parts.join('-'));
      return;
    }
    setter(val);
  }

  const SESSION_FORMAT_REGEX = /^\d{4}-\d{4}$/;

  // Edit Modal State
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    id: '',
    name: '',
    startDate: '',
    endDate: '',
    loading: false,
    error: null
  });

  function openEditModal(session: any) {
    setEditModal({
      isOpen: true,
      id: session.id,
      name: session.name || '',
      startDate: String(session.start_date || '').slice(0, 10),
      endDate: String(session.end_date || '').slice(0, 10),
      loading: false,
      error: null
    });
  }

  async function handleSaveEdit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanName = editModal.name.trim();

    if (!SESSION_FORMAT_REGEX.test(cleanName)) {
      setEditModal(prev => ({
        ...prev,
        error: 'Session name must be in YYYY-YYYY format (e.g. 2028-2029).'
      }));
      return;
    }

    const startYear = editModal.startDate.split('-')[0];
    const endYear = editModal.endDate.split('-')[0];
    if (!/^\d{4}$/.test(startYear)) {
      setEditModal(prev => ({ ...prev, error: 'Start Date year must be exactly 4 digits.' }));
      return;
    }
    if (!/^\d{4}$/.test(endYear)) {
      setEditModal(prev => ({ ...prev, error: 'End Date year must be exactly 4 digits.' }));
      return;
    }

    if (new Date(editModal.startDate) >= new Date(editModal.endDate)) {
      setEditModal(prev => ({ ...prev, error: 'Start date must precede end date.' }));
      return;
    }

    setEditModal(prev => ({ ...prev, loading: true, error: null }));

    try {
      await api.put(`/academic-years/${editModal.id}`, {
        name: cleanName,
        startDate: editModal.startDate,
        endDate: editModal.endDate
      });

      const currentActiveId = localStorage.getItem('attendo_active_academic_year_id');
      const isTargetActive = items.find(it => it.id === editModal.id)?.is_active || currentActiveId === editModal.id;
      if (isTargetActive) {
        localStorage.setItem('attendo_active_academic_year', cleanName);
        localStorage.setItem('attendo_academic_session', cleanName);
        window.dispatchEvent(new CustomEvent('sessionChanged', { detail: cleanName }));
        window.dispatchEvent(new Event('storage'));
      }

      setEditModal(prev => ({ ...prev, isOpen: false, loading: false }));
      await loadSessions(true);
    } catch (err: any) {
      setEditModal(prev => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Failed to update academic session'
      }));
    }
  }

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

  /* ─────────────────────────────────────────────────────────────
     2. Working Days & Weekend Rules State
  ───────────────────────────────────────────────────────────── */
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [weekendDays, setWeekendDays] = useState<number[]>([0]);
  const [saturdayRule, setSaturdayRule] = useState<'WORKING' | 'HALF_DAY' | 'OFF'>('WORKING');
  const [savingWorkingDays, setSavingWorkingDays] = useState(false);
  const [workingDaysMsg, setWorkingDaysMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  /* ─────────────────────────────────────────────────────────────
     3. Holidays State
  ───────────────────────────────────────────────────────────── */
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [holidayFromDate, setHolidayFromDate] = useState('');
  const [holidayToDate, setHolidayToDate] = useState('');
  const [holidayType, setHolidayType] = useState<'GAZETTED' | 'NATIONAL' | 'REGIONAL' | 'INSTITUTIONAL' | 'FESTIVAL'>('GAZETTED');
  const [holidayDesc, setHolidayDesc] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [holidayMsg, setHolidayMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const holidayDurationDays = useMemo(() => {
    if (!holidayFromDate) return 0;
    const to = holidayToDate || holidayFromDate;
    if (holidayFromDate > to) return -1;
    const d1 = new Date(holidayFromDate);
    const d2 = new Date(to);
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  }, [holidayFromDate, holidayToDate]);

  const nameCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of holidays) {
      counts[h.name] = (counts[h.name] || 0) + 1;
    }
    return counts;
  }, [holidays]);

  /* ─────────────────────────────────────────────────────────────
     4. Real-Time Working Day & Weekend/Holiday Calculator State
  ───────────────────────────────────────────────────────────── */
  const todayYMD = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentMonthStart = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);
  const currentMonthEnd = useMemo(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }, []);

  const [calcStart, setCalcStart] = useState<string>(currentMonthStart);
  const [calcEnd, setCalcEnd] = useState<string>(currentMonthEnd);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calculating, setCalculating] = useState<boolean>(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  /* ─────────────────────────────────────────────────────────────
     Data Fetching
  ───────────────────────────────────────────────────────────── */
  async function loadSessions(force = false) {
    setLoading(true);
    try {
      const r = await api.get('/academic-years', { params: force ? { fresh: '1' } : {} });
      setItems(Array.isArray(r.data) ? r.data : []);
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e?.message || 'Unable to load academic sessions');
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkingCalendarConfig() {
    try {
      const r = await api.get('/calendar/working-days');
      if (r.data?.success && r.data?.data) {
        const d = r.data.data;
        if (Array.isArray(d.working_days)) setWorkingDays(d.working_days);
        if (Array.isArray(d.weekend_days)) setWeekendDays(d.weekend_days);
        if (d.saturday_rule) setSaturdayRule(d.saturday_rule);
      }
    } catch (err: any) {
      console.warn('Could not load working calendar:', err);
    }
  }

  async function loadHolidaysList() {
    setLoadingHolidays(true);
    try {
      const r = await api.get('/calendar/holidays');
      if (r.data?.success && Array.isArray(r.data?.data)) {
        setHolidays(r.data.data);
      }
    } catch (err: any) {
      console.warn('Could not load holidays:', err);
    } finally {
      setLoadingHolidays(false);
    }
  }

  async function executeCalculation(start = calcStart, end = calcEnd) {
    if (!start || !end) return;
    setCalculating(true);
    setCalcError(null);
    try {
      const r = await api.get(`/calendar/calculate?startDate=${start}&endDate=${end}`);
      if (r.data?.success) {
        setCalcResult(r.data.data);
      } else {
        setCalcError(r.data?.message || 'Calculation failed');
      }
    } catch (err: any) {
      setCalcError(err?.response?.data?.message || err?.message || 'Failed to calculate working days');
    } finally {
      setCalculating(false);
    }
  }

  useEffect(() => {
    loadSessions();
    loadWorkingCalendarConfig();
    loadHolidaysList();
    executeCalculation(currentMonthStart, currentMonthEnd);
  }, []);

  /* ─────────────────────────────────────────────────────────────
     Session Creation & Actions
  ───────────────────────────────────────────────────────────── */
  function initiateCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');

    if (!name.trim()) {
      alert('Validation Error: Please enter session name (e.g. 2028-2029).');
      return;
    }
    if (!SESSION_FORMAT_REGEX.test(name.trim())) {
      alert('Validation Error: Session Name must be in YYYY-YYYY format (e.g. 2028-2029).');
      return;
    }
    if (!startDate || !endDate) {
      alert('Validation Error: Both start date and end date are mandatory.');
      return;
    }
    const startYear = startDate.split('-')[0];
    const endYear = endDate.split('-')[0];
    if (!/^\d{4}$/.test(startYear)) {
      alert('Validation Error: Start Date year must be exactly 4 digits.');
      return;
    }
    if (!/^\d{4}$/.test(endYear)) {
      alert('Validation Error: End Date year must be exactly 4 digits.');
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
      await loadSessions();
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
      await loadSessions();
    } catch (e: any) {
      setActionConfirm(prev => ({
        ...prev,
        loading: false,
        error: e?.response?.data?.message || e?.message || 'Action failed'
      }));
    }
  }

  /* ─────────────────────────────────────────────────────────────
     Working Days Configuration Handlers (TC-SET-002)
  ───────────────────────────────────────────────────────────── */
  function toggleDay(dayNum: number) {
    if (workingDays.includes(dayNum)) {
      // Cannot uncheck if it's the only working day
      if (workingDays.length <= 1) {
        alert('At least one day in the week must be configured as a working day.');
        return;
      }
      setWorkingDays(prev => prev.filter(d => d !== dayNum));
      if (!weekendDays.includes(dayNum)) {
        setWeekendDays(prev => [...prev, dayNum]);
      }
    } else {
      setWorkingDays(prev => [...prev, dayNum]);
      setWeekendDays(prev => prev.filter(d => d !== dayNum));
    }
  }

  function applyPreset(preset: 'MON_SAT' | 'MON_FRI' | 'SUN_THU') {
    if (preset === 'MON_SAT') {
      setWorkingDays([1, 2, 3, 4, 5, 6]);
      setWeekendDays([0]);
      setSaturdayRule('WORKING');
    } else if (preset === 'MON_FRI') {
      setWorkingDays([1, 2, 3, 4, 5]);
      setWeekendDays([0, 6]);
      setSaturdayRule('OFF');
    } else if (preset === 'SUN_THU') {
      setWorkingDays([0, 1, 2, 3, 4]);
      setWeekendDays([5, 6]);
      setSaturdayRule('OFF');
    }
  }

  async function saveWorkingDaysConfig() {
    setSavingWorkingDays(true);
    setWorkingDaysMsg(null);
    try {
      const res = await api.put('/calendar/working-days', {
        working_days: workingDays,
        weekend_days: weekendDays,
        saturday_rule: saturdayRule
      });
      setWorkingDaysMsg({
        type: 'success',
        text: res.data?.message || 'Working calendar rules saved successfully!'
      });
      executeCalculation();
    } catch (err: any) {
      setWorkingDaysMsg({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to update working calendar'
      });
    } finally {
      setSavingWorkingDays(false);
      setTimeout(() => setWorkingDaysMsg(null), 5000);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     Holiday Handlers (TC-SET-003)
  ───────────────────────────────────────────────────────────── */
  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault();
    const from = holidayFromDate.trim();
    const to = (holidayToDate || holidayFromDate).trim();

    if (!holidayName.trim() || !from) {
      alert('Please provide holiday name and valid From date.');
      return;
    }
    if (from > to) {
      alert('To date cannot be earlier than From date.');
      return;
    }

    setSavingHoliday(true);
    setHolidayMsg(null);
    try {
      const res = await api.post('/calendar/holidays', {
        name: holidayName.trim(),
        from_date: from,
        to_date: to,
        holiday_type: holidayType,
        description: holidayDesc
      });
      setHolidayMsg({
        type: 'success',
        text: res.data?.message || `Declared holiday '${holidayName}' successfully!`
      });
      setHolidayName('');
      setHolidayFromDate('');
      setHolidayToDate('');
      setHolidayDesc('');
      await loadHolidaysList();
      executeCalculation();
    } catch (err: any) {
      setHolidayMsg({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to declare holiday'
      });
    } finally {
      setSavingHoliday(false);
      setTimeout(() => setHolidayMsg(null), 5000);
    }
  }

  async function handleDeleteHoliday(id: string, name: string, date: string, allSeries = false) {
    const promptMsg = allSeries
      ? `Are you sure you want to remove ALL declared dates for holiday "${name}"?`
      : `Are you sure you want to remove the declared holiday "${name}" on ${date}?`;
    if (!confirm(promptMsg)) return;
    try {
      await api.delete(`/calendar/holidays/${id}${allSeries ? '?allSeries=true' : ''}`);
      await loadHolidaysList();
      executeCalculation();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to remove holiday');
    }
  }

  return (
    <div className="feature-page" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--text, #0f172a)' }}>
          Academic Calendar &amp; Holidays
        </h1>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>
          Authoritative institutional calendar: Configure academic sessions, weekly working days, weekend policies, gazetted holidays, and verify working day calculations without double counting.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '2px solid var(--border, #e2e8f0)',
        marginBottom: 24,
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: activeTab === 'sessions' ? 700 : 500,
            color: activeTab === 'sessions' ? '#2563eb' : 'var(--text-muted, #64748b)',
            borderBottom: activeTab === 'sessions' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Clock size={16} /> Academic Sessions
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('working-days')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: activeTab === 'working-days' ? 700 : 500,
            color: activeTab === 'working-days' ? '#2563eb' : 'var(--text-muted, #64748b)',
            borderBottom: activeTab === 'working-days' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Sliders size={16} /> Weekly Working Days &amp; Weekend Rules
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('holidays')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: activeTab === 'holidays' ? 700 : 500,
            color: activeTab === 'holidays' ? '#2563eb' : 'var(--text-muted, #64748b)',
            borderBottom: activeTab === 'holidays' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <CalendarCheck size={16} /> Holiday Manager ({holidays.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: activeTab === 'calculator' ? 700 : 500,
            color: activeTab === 'calculator' ? '#2563eb' : 'var(--text-muted, #64748b)',
            borderBottom: activeTab === 'calculator' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <CalendarDays size={16} /> Working Day &amp; Weekend/Holiday Calculator
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: ACADEMIC SESSIONS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'sessions' && (
        <div>
          <div className="form-card" style={{ marginBottom: 24 }}>
            <h3>Create Academic Session</h3>
            <form onSubmit={initiateCreate} className="form-inline" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Session Name (YYYY-YYYY)</span>
                <input
                  placeholder="e.g. 2028-2029"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={9}
                  required
                  style={{ minWidth: 160 }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  min="1900-01-01"
                  max="2099-12-31"
                  onChange={e => handleDateInput(e.target.value, setStartDate)}
                  required
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>End Date</span>
                <input
                  type="date"
                  value={endDate}
                  min="1900-01-01"
                  max="2099-12-31"
                  onChange={e => handleDateInput(e.target.value, setEndDate)}
                  required
                />
              </label>
              <button type="submit" style={{ height: 38 }}>Create Session</button>
            </form>
          </div>

          {message && <div className="error" style={{ marginBottom: 16 }}>{message}</div>}

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
                          <button
                            type="button"
                            className="small-btn edit-btn"
                            style={{
                              background: '#0284c7',
                              color: '#fff',
                              border: 'none',
                              padding: '6px 14px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.82rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                            onClick={() => openEditModal(x)}
                            title="Edit session details"
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </button>

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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: WORKING DAYS & WEEKEND RULES (TC-SET-002)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'working-days' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {workingDaysMsg && (
            <div className={workingDaysMsg.type === 'success' ? 'success' : 'error'} style={{ padding: 12, borderRadius: 8 }}>
              {workingDaysMsg.text}
            </div>
          )}

          {/* Presets Card */}
          <div className="panel" style={{ padding: 20, borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} style={{ color: '#2563eb' }} />
              Quick Working Week Presets
            </h3>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
              Select a standard academic calendar preset or customize day-by-day below:
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => applyPreset('MON_SAT')}
                style={{ fontSize: 13, padding: '8px 14px', borderRadius: 6 }}
              >
                Mon – Sat (Standard 6-Day Institutional Week)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => applyPreset('MON_FRI')}
                style={{ fontSize: 13, padding: '8px 14px', borderRadius: 6 }}
              >
                Mon – Fri (Standard 5-Day Institutional Week)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => applyPreset('SUN_THU')}
                style={{ fontSize: 13, padding: '8px 14px', borderRadius: 6 }}
              >
                Sun – Thu (Middle Eastern Institutional Week)
              </button>
            </div>
          </div>

          {/* Day of Week Selector */}
          <div className="panel" style={{ padding: 20, borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} style={{ color: '#2563eb' }} />
              Weekly Operating Days
            </h3>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
              Select which days are official instructional working days for roll-call, timetable periods, and attendance requirements.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              {DAY_LABELS.map(d => {
                const isWorking = workingDays.includes(d.day);
                return (
                  <div
                    key={d.day}
                    onClick={() => toggleDay(d.day)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 8,
                      border: isWorking ? '2px solid #2563eb' : '1px solid var(--border, #e2e8f0)',
                      background: isWorking ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-card, #ffffff)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: isWorking ? '#2563eb' : 'var(--text-muted)' }}>
                        {d.short}
                      </span>
                      <input
                        type="checkbox"
                        checked={isWorking}
                        onChange={() => {}} // handled by parent div onClick
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {d.name}
                    </span>
                    <span
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        color: isWorking ? '#16a34a' : '#dc2626'
                      }}
                    >
                      {isWorking ? '● WORKING' : '○ WEEKEND OFF'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Saturday Rule Selector (TC-SET-002) */}
          <div className="panel" style={{ padding: 20, borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} style={{ color: '#2563eb' }} />
              Saturday Rule Configuration
            </h3>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
              Specify how Saturday is treated in working-day computations, roll-call registers, and timetable periods:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {[
                {
                  rule: 'WORKING',
                  title: 'Full Working Day',
                  desc: 'Full day of instructional activities. Counts as 1.0 working day in attendance registers.'
                },
                {
                  rule: 'HALF_DAY',
                  title: 'Half-Day Session',
                  desc: 'Morning session only. Counts as 0.5 working day and 0.5 non-working day in reports.'
                },
                {
                  rule: 'OFF',
                  title: 'Weekend Off',
                  desc: 'Campus closed. Automatically counted as a weekend off day across all calculations.'
                }
              ].map(opt => {
                const isSelected = saturdayRule === opt.rule;
                return (
                  <div
                    key={opt.rule}
                    onClick={() => {
                      setSaturdayRule(opt.rule as any);
                      if (opt.rule === 'OFF') {
                        setWorkingDays(prev => prev.filter(d => d !== 6));
                        if (!weekendDays.includes(6)) setWeekendDays(prev => [...prev, 6]);
                      } else {
                        if (!workingDays.includes(6)) setWorkingDays(prev => [...prev, 6]);
                        setWeekendDays(prev => prev.filter(d => d !== 6));
                      }
                    }}
                    style={{
                      padding: 16,
                      borderRadius: 8,
                      border: isSelected ? '2px solid #2563eb' : '1px solid var(--border, #e2e8f0)',
                      background: isSelected ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-card, #ffffff)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <input
                        type="radio"
                        name="satRule"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: 'pointer' }}
                      />
                      <b style={{ color: isSelected ? '#2563eb' : 'inherit' }}>{opt.title}</b>
                    </div>
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {opt.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                type="button"
                onClick={saveWorkingDaysConfig}
                disabled={savingWorkingDays}
                style={{ padding: '10px 24px', fontSize: 14, fontWeight: 700 }}
              >
                {savingWorkingDays ? 'Saving Configuration...' : 'Save Working Calendar Rules'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: GAZETTED HOLIDAY MANAGER (TC-SET-003)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'holidays' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {holidayMsg && (
            <div className={holidayMsg.type === 'success' ? 'success' : 'error'} style={{ padding: 12, borderRadius: 8 }}>
              {holidayMsg.text}
            </div>
          )}

          {/* Add Holiday Card */}
          <div className="panel" style={{ padding: 20, borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={18} style={{ color: '#2563eb' }} />
              Declare New Gazetted / Institutional Holiday
            </h3>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
              Declared holidays are locked on attendance registers and automatically excluded from working-day totals.
            </p>

            <form onSubmit={handleAddHoliday} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Holiday Name *</span>
                <input
                  type="text"
                  placeholder="e.g. Durga Puja / Summer Break"
                  value={holidayName}
                  onChange={e => setHolidayName(e.target.value)}
                  required
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>From Date *</span>
                <input
                  type="date"
                  value={holidayFromDate}
                  onChange={e => {
                    const val = e.target.value;
                    setHolidayFromDate(val);
                    if (!holidayToDate || holidayToDate < val) {
                      setHolidayToDate(val);
                    }
                  }}
                  required
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>To Date *</span>
                <input
                  type="date"
                  min={holidayFromDate}
                  value={holidayToDate}
                  onChange={e => setHolidayToDate(e.target.value)}
                  required
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Category / Type</span>
                <select
                  value={holidayType}
                  onChange={e => setHolidayType(e.target.value as any)}
                >
                  <option value="GAZETTED">Gazetted Holiday</option>
                  <option value="NATIONAL">National Holiday</option>
                  <option value="FESTIVAL">Festival Holiday</option>
                  <option value="REGIONAL">Regional Holiday</option>
                  <option value="INSTITUTIONAL">Institutional / School Holiday</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Description (Optional)</span>
                <input
                  type="text"
                  placeholder="Optional context"
                  value={holidayDesc}
                  onChange={e => setHolidayDesc(e.target.value)}
                />
              </label>

              {holidayFromDate && holidayToDate && (
                <div style={{ gridColumn: '1 / -1', marginTop: -4, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  {holidayFromDate > holidayToDate ? (
                    <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                      ⚠️ "To Date" cannot be earlier than "From Date"
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(37, 99, 235, 0.12)', color: '#3b82f6', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(37, 99, 235, 0.25)', fontWeight: 600 }}>
                      📅 <b>Duration:</b> {holidayDurationDays} {holidayDurationDays === 1 ? 'day (Single day)' : 'days (Multi-day holiday)'} ({holidayFromDate} to {holidayToDate})
                    </span>
                  )}
                </div>
              )}

              <div style={{ gridColumn: '1 / -1', maxWidth: 260 }}>
                <button
                  type="submit"
                  disabled={savingHoliday || (holidayDurationDays < 0)}
                  style={{ width: '100%', height: 38, fontWeight: 700 }}
                >
                  {savingHoliday ? 'Saving...' : holidayDurationDays > 1 ? `Declare ${holidayDurationDays}-Day Holiday` : 'Add Holiday'}
                </button>
              </div>
            </form>
          </div>

          {/* Holiday List Table */}
          <div className="panel" style={{ padding: 20, borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>
                Configured School Holidays ({holidays.length})
              </h3>
              <button
                type="button"
                className="secondary"
                onClick={loadHolidaysList}
                style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {loadingHolidays ? (
              <p className="muted">Loading holidays...</p>
            ) : holidays.length === 0 ? (
              <p className="muted" style={{ padding: 20, textAlign: 'center' }}>
                No holidays configured yet. Declare one using the form above.
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {['DATE', 'DAY', 'HOLIDAY NAME', 'CATEGORY', 'WEEKEND OVERLAP', 'STATUS', 'ACTIONS'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.map(h => {
                      const [y, m, d] = h.holiday_date.split('-').map(Number);
                      const dt = new Date(Date.UTC(y, m - 1, d));
                      const dayName = DAY_NAMES[dt.getUTCDay()];
                      const isWeekend = weekendDays.includes(dt.getUTCDay()) || (dt.getUTCDay() === 6 && saturdayRule === 'OFF');
                      const isMulti = (nameCounts[h.name] || 0) > 1;

                      return (
                        <tr key={h.id}>
                          <td><b>{h.holiday_date}</b></td>
                          <td>{dayName}</td>
                          <td>
                            <b>{h.name}</b>
                            {isMulti && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontSize: 10.5,
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  padding: '2px 6px',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  display: 'inline-block'
                                }}
                              >
                                Series ({nameCounts[h.name]}d)
                              </span>
                            )}
                            {h.description && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{h.description}</div>
                            )}
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: 10,
                                fontSize: 11,
                                fontWeight: 700,
                                background: '#e0e7ff',
                                color: '#3730a3'
                              }}
                            >
                              {h.holiday_type}
                            </span>
                          </td>
                          <td>
                            {isWeekend ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  color: '#d97706',
                                  fontSize: 12,
                                  fontWeight: 600
                                }}
                              >
                                <Info size={14} /> Falls on {dayName} (Deduplicated)
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Weekday</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`badge ${h.is_active ? 'active' : 'expired'}`}
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 10,
                                fontSize: 11,
                                fontWeight: 700,
                                background: h.is_active ? '#dcfce7' : '#fee2e2',
                                color: h.is_active ? '#15803d' : '#b91c1c'
                              }}
                            >
                              {h.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td>
                            {isMulti ? (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="small-btn danger-btn"
                                  title="Delete only this specific date"
                                  onClick={() => handleDeleteHoliday(h.id, h.name, h.holiday_date, false)}
                                  style={{
                                    background: '#ef4444',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3
                                  }}
                                >
                                  <Trash2 size={12} /> Day
                                </button>
                                <button
                                  type="button"
                                  className="small-btn danger-btn"
                                  title="Delete all dates in this holiday series"
                                  onClick={() => handleDeleteHoliday(h.id, h.name, h.holiday_date, true)}
                                  style={{
                                    background: '#b91c1c',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3
                                  }}
                                >
                                  <Trash2 size={12} /> All ({nameCounts[h.name]}d)
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="small-btn danger-btn"
                                onClick={() => handleDeleteHoliday(h.id, h.name, h.holiday_date, false)}
                                style={{
                                  background: '#dc2626',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: WORKING DAYS & HOLIDAY CALCULATOR (REAL-TIME ENGINE)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'calculator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Controls Bar */}
          <div className="panel" style={{ padding: 20, borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={18} style={{ color: '#2563eb' }} />
              Live Working Day &amp; Weekend/Holiday Calculator
            </h3>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
              Select any date range to compute verified instructional working days. Weekend dates and declared holidays that overlap are counted exactly once and never double-deducted.
            </p>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Start Date</span>
                <input
                  type="date"
                  value={calcStart}
                  onChange={e => setCalcStart(e.target.value)}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>End Date</span>
                <input
                  type="date"
                  value={calcEnd}
                  onChange={e => setCalcEnd(e.target.value)}
                />
              </label>

              <button
                type="button"
                onClick={() => executeCalculation(calcStart, calcEnd)}
                disabled={calculating}
                style={{ padding: '8px 20px', fontWeight: 700 }}
              >
                {calculating ? 'Calculating...' : 'Calculate Working Days'}
              </button>

              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setCalcStart(currentMonthStart);
                  setCalcEnd(currentMonthEnd);
                  executeCalculation(currentMonthStart, currentMonthEnd);
                }}
                style={{ fontSize: 12, padding: '8px 14px' }}
              >
                Current Month
              </button>
            </div>
          </div>

          {calcError && (
            <div className="error" style={{ padding: 12, borderRadius: 8 }}>
              {calcError}
            </div>
          )}

          {/* Metrics Summary Cards */}
          {calcResult && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
                <div style={{ background: 'var(--bg-card, #f8fafc)', padding: 16, borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase' }}>Total Days</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text, #0f172a)', marginTop: 4 }}>
                    {calcResult.totalDays}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>Inclusive range</div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 16, borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>Working Days</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
                    {calcResult.workingDays}
                  </div>
                  <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>Instructional sessions</div>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 10, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, textTransform: 'uppercase' }}>Non-Working Days</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>
                    {calcResult.nonWorkingDays}
                  </div>
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>Weekends + Holidays</div>
                </div>

                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: 16, borderRadius: 10, border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <div style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase' }}>Weekend Days</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#3b82f6', marginTop: 4 }}>
                    {calcResult.weekendDays}
                  </div>
                  <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>Per school calendar</div>
                </div>

                <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: 16, borderRadius: 10, border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                  <div style={{ fontSize: 12, color: '#a855f7', fontWeight: 600, textTransform: 'uppercase' }}>Holidays</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#a855f7', marginTop: 4 }}>
                    {calcResult.holidayDays}
                  </div>
                  <div style={{ fontSize: 11, color: '#a855f7', marginTop: 2 }}>Gazetted &amp; Institutional</div>
                </div>

                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: 16, borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase' }}>Overlap Deduplicated</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
                    {calcResult.overlapDays}
                  </div>
                  <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>Zero double-counting</div>
                </div>
              </div>

              {/* Deduplication Invariant Banner */}
              <div style={{
                background: 'var(--card-subtle, #f8fafc)',
                border: '1px solid var(--border, #cbd5e1)',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: 'var(--text, #334155)' }}>
                  <b>Mathematical Invariant Verified:</b> Total Days ({calcResult.totalDays}) = Working Days ({calcResult.workingDays}) + Non-Working Days ({calcResult.nonWorkingDays}). Non-Working Days = Weekend Days ({calcResult.weekendDays}) + Holidays ({calcResult.holidayDays}) − Overlap Days ({calcResult.overlapDays}) = <b>{calcResult.nonWorkingDays}</b>.
                </div>
              </div>

              {/* Day-by-Day Breakdown Table */}
              <div className="panel" style={{ padding: 20, borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>
                  Day-by-Day Calendar Breakdown ({calcResult.breakdown?.length} days)
                </h3>
                <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        {['DATE', 'DAY', 'STATUS', 'HOLIDAY / REASON', 'WEIGHT'].map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {calcResult.breakdown?.map((day: any) => {
                        let badgeStyle = { bg: '#dcfce7', text: '#15803d' };
                        let label = 'WORKING DAY';

                        if (day.status === 'WEEKEND_AND_HOLIDAY') {
                          badgeStyle = { bg: '#fef3c7', text: '#b45309' };
                          label = 'WEEKEND & HOLIDAY (OVERLAP)';
                        } else if (day.status === 'HOLIDAY') {
                          badgeStyle = { bg: '#f3e8ff', text: '#6b21a8' };
                          label = 'HOLIDAY';
                        } else if (day.status === 'WEEKEND') {
                          badgeStyle = { bg: '#fee2e2', text: '#b91c1c' };
                          label = 'WEEKEND OFF';
                        } else if (day.status === 'HALF_DAY') {
                          badgeStyle = { bg: '#e0f2fe', text: '#0369a1' };
                          label = 'HALF DAY';
                        }

                        return (
                          <tr key={day.date}>
                            <td><b>{day.date}</b></td>
                            <td>{day.dayName}</td>
                            <td>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: 8,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: badgeStyle.bg,
                                  color: badgeStyle.text
                                }}
                              >
                                {label}
                              </span>
                            </td>
                            <td>
                              {day.holidayName ? (
                                <span><b>{day.holidayName}</b> ({day.holidayType || 'Gazetted'})</span>
                              ) : day.isWeekend ? (
                                <span style={{ color: 'var(--text-muted)' }}>Scheduled Weekend ({day.dayName})</span>
                              ) : day.isHalfDay ? (
                                <span style={{ color: '#0369a1' }}>Saturday Half-Day Schedule</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Regular Instructional Day</span>
                              )}
                            </td>
                            <td>
                              <b>{day.workingWeight}</b>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
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


      {/* Edit Academic Session Modal */}
      {editModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
          onClick={() => { if (!editModal.loading) setEditModal(prev => ({ ...prev, isOpen: false })); }}
        >
          <div
            style={{
              background: 'var(--bg-card, #ffffff)',
              borderRadius: 12,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
              width: '100%',
              maxWidth: 480,
              overflow: 'hidden',
              border: '1px solid var(--border, #cbd5e1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--card-subtle, #f8fafc)'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text, #0f172a)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Edit2 size={16} style={{ color: '#0284c7' }} />
                  <span>Edit Academic Session</span>
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                  Update session name and date ranges
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                disabled={editModal.loading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 6,
                  color: 'var(--text-muted, #64748b)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveEdit} style={{ padding: 20 }}>
              {editModal.error && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{editModal.error}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: 'var(--text, #334155)' }}>
                    Session Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={editModal.name}
                    onChange={e => setEditModal(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. 2028-2029"
                    maxLength={9}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border, #cbd5e1)',
                      fontSize: 13.5,
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 4 }}>
                    Must follow <b>YYYY-YYYY</b> format (e.g. 2028-2029)
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: 'var(--text, #334155)' }}>
                      Start Date <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={editModal.startDate}
                      min="1900-01-01"
                      max="2099-12-31"
                      onChange={e => handleDateInput(e.target.value, val => setEditModal(prev => ({ ...prev, startDate: val })))}
                      required
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border, #cbd5e1)',
                        fontSize: 13,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: 'var(--text, #334155)' }}>
                      End Date <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={editModal.endDate}
                      min="1900-01-01"
                      max="2099-12-31"
                      onChange={e => handleDateInput(e.target.value, val => setEditModal(prev => ({ ...prev, endDate: val })))}
                      required
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border, #cbd5e1)',
                        fontSize: 13,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  marginTop: 24,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10
                }}
              >
                <button
                  type="button"
                  onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={editModal.loading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid var(--border, #cbd5e1)',
                    background: 'var(--bg-card, #ffffff)',
                    color: 'var(--text, #334155)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: editModal.loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editModal.loading}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: editModal.loading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {editModal.loading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
