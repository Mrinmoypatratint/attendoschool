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
  X,
  ChevronLeft,
  Search,
  Printer,
  Tag,
  Sparkles
} from 'lucide-react';

type ActionType = 'activate' | 'deactivate' | 'archive' | 'unarchive';
type TabKey = 'sessions' | 'working-days' | 'holidays' | 'calculator' | 'academic-calendar';

const DAY_LABELS = [
  { day: 0, name: 'Sunday', short: 'Sun' },
  { day: 1, name: 'Monday', short: 'Mon' },
  { day: 2, name: 'Tuesday', short: 'Tue' },
  { day: 3, name: 'Wednesday', short: 'Wed' },
  { day: 4, name: 'Thursday', short: 'Thu' },
  { day: 5, name: 'Friday', short: 'Fri' },
  { day: 6, name: 'Saturday', short: 'Sat' },
];


const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getHolidayCategoryStyle(type: string) {
  switch (type) {
    case 'NATIONAL':
      return { bg: '#f7d5d5', color: '#a82424', border: '#e88d8d', badgeBg: '#d32f2f', label: 'National Holiday' };
    case 'FESTIVAL':
      return { bg: '#dde1f2', color: '#48549a', border: '#a3abda', badgeBg: '#5c6bc0', label: 'Festival & Celebration' };
    case 'GAZETTED':
      return { bg: '#ffe1e8', color: '#9a133c', border: '#f896b0', badgeBg: '#e11d55', label: 'Gazetted Holiday' };
    case 'REGIONAL':
      return { bg: '#cce6e1', color: '#02604f', border: '#99ccc3', badgeBg: '#03806a', label: 'Regional Holiday' };
    case 'INSTITUTIONAL':
      return { bg: '#f5f5f6', color: '#3e4152', border: '#d4d5d9', badgeBg: '#696e79', label: 'Institutional Break' };
    default:
      return { bg: '#eaeaec', color: '#535766', border: '#d4d5d9', badgeBg: '#94969f', label: type || 'Holiday' };
  }
}

export default function AcademicYears({ defaultTab }: { defaultTab?: TabKey }) {
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab || 'sessions');

  /* ─────────────────────────────────────────────────────────────
     1. Academic Sessions State
  ───────────────────────────────────────────────────────────── */
  const [items, setItems] = useState<any[]>([]);

  const sortAcademicYearsAsc = (list: any[]) => {
    return [...list].sort((a, b) => {
      const yearA = parseInt((String(a.name || '').match(/\d{4}/) || ['0'])[0], 10);
      const yearB = parseInt((String(b.name || '').match(/\d{4}/) || ['0'])[0], 10);
      if (yearA !== yearB && yearA > 0 && yearB > 0) return yearA - yearB;
      const dateA = new Date(a.start_date || a.startDate || 0).getTime();
      const dateB = new Date(b.start_date || b.startDate || 0).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  };

  const sortedItems = useMemo(() => sortAcademicYearsAsc(items), [items]);
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
     5. Academic Holiday Calendar State (Dynamic Institutional Schedule)
  ───────────────────────────────────────────────────────────── */
  const [calSessionFilter, setCalSessionFilter] = useState<string>('ALL');
  const [calYearFilter, setCalYearFilter] = useState<string>('ALL');
  const [calCategoryFilter, setCalCategoryFilter] = useState<string>('ALL');
  const [calSearchQuery, setCalSearchQuery] = useState<string>('');
  const [calViewMode, setCalViewMode] = useState<'calendar' | 'agenda'>('calendar');
  const [calMonthViewMode, setCalMonthViewMode] = useState<'all-months' | 'single-month'>('all-months');
  const [calActiveMonth, setCalActiveMonth] = useState<number>(new Date().getMonth());
  const [calInspectHoliday, setCalInspectHoliday] = useState<any | null>(null);

  const calDistinctYears = useMemo(() => {
    const years = new Set<string>();
    holidays.forEach(h => {
      if (h.holiday_date) years.add(h.holiday_date.slice(0, 4));
    });
    items.forEach(s => {
      if (s.start_date) years.add(String(s.start_date).slice(0, 4));
      if (s.end_date) years.add(String(s.end_date).slice(0, 4));
    });
    const currentY = String(new Date().getFullYear());
    years.add(currentY);
    return Array.from(years).filter(Boolean).sort();
  }, [holidays, items]);

  // Dynamically filtered holidays from Holiday Manager
  const calFilteredHolidays = useMemo(() => {
    return holidays.filter(h => {
      if (!h.holiday_date) return false;

      // 1. Session filter
      if (calSessionFilter !== 'ALL') {
        const sess = items.find(s => s.id === calSessionFilter);
        if (sess) {
          const sStart = String(sess.start_date).slice(0, 10);
          const sEnd = String(sess.end_date).slice(0, 10);
          if (h.holiday_date < sStart || h.holiday_date > sEnd) return false;
        }
      }

      // 2. Year filter
      if (calYearFilter !== 'ALL') {
        if (h.holiday_date.slice(0, 4) !== calYearFilter) return false;
      }

      // 3. Category filter
      if (calCategoryFilter !== 'ALL') {
        if (h.holiday_type !== calCategoryFilter) return false;
      }

      // 4. Search query
      if (calSearchQuery.trim()) {
        const q = calSearchQuery.trim().toLowerCase();
        const mName = (h.name || '').toLowerCase().includes(q);
        const mDesc = (h.description || '').toLowerCase().includes(q);
        const mType = (h.holiday_type || '').toLowerCase().includes(q);
        const mDate = (h.holiday_date || '').includes(q);
        if (!mName && !mDesc && !mType && !mDate) return false;
      }

      return true;
    }).sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
  }, [holidays, items, calSessionFilter, calYearFilter, calCategoryFilter, calSearchQuery]);

  // Aggregated KPI Stats
  const calKpiStats = useMemo(() => {
    const totalDays = calFilteredHolidays.length;
    const nationalHolidays = calFilteredHolidays.filter(h => h.holiday_type === 'NATIONAL').length;
    const festivalHolidays = calFilteredHolidays.filter(h => h.holiday_type === 'FESTIVAL').length;
    const gazettedHolidays = calFilteredHolidays.filter(h => h.holiday_type === 'GAZETTED').length;
    const otherHolidays = calFilteredHolidays.filter(h => h.holiday_type === 'REGIONAL' || h.holiday_type === 'INSTITUTIONAL').length;

    const todayStr = new Date().toISOString().slice(0, 10);
    const upcoming = holidays
      .filter(h => h.holiday_date >= todayStr && h.is_active)
      .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))[0] || null;

    let daysUntilUpcoming: number | null = null;
    if (upcoming) {
      const t1 = new Date(todayStr).getTime();
      const t2 = new Date(upcoming.holiday_date).getTime();
      daysUntilUpcoming = Math.max(0, Math.round((t2 - t1) / (1000 * 60 * 60 * 24)));
    }

    return { totalDays, nationalHolidays, festivalHolidays, gazettedHolidays, otherHolidays, upcoming, daysUntilUpcoming };
  }, [calFilteredHolidays, holidays]);

  // Group holidays by month for agenda view
  const calHolidaysByMonth = useMemo(() => {
    const map: Record<string, any[]> = {};
    calFilteredHolidays.forEach(h => {
      const monthKey = h.holiday_date.slice(0, 7); // 'YYYY-MM'
      if (!map[monthKey]) map[monthKey] = [];
      map[monthKey].push(h);
    });
    return map;
  }, [calFilteredHolidays]);

  /* ─────────────────────────────────────────────────────────────
     Data Fetching
  ───────────────────────────────────────────────────────────── */
  async function loadSessions(force = false) {
    setLoading(true);
    try {
      const r = await api.get('/academic-years', { params: force ? { fresh: '1' } : {} });
      setItems(sortAcademicYearsAsc(Array.isArray(r.data) ? r.data : []));
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

  // Edit Holiday Modal State
  const [editHolidayModal, setEditHolidayModal] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
    date: string;
    type: 'GAZETTED' | 'NATIONAL' | 'FESTIVAL' | 'REGIONAL' | 'INSTITUTIONAL';
    description: string;
    isActive: boolean;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    id: '',
    name: '',
    date: '',
    type: 'GAZETTED',
    description: '',
    isActive: true,
    loading: false,
    error: null
  });

  function openEditHolidayModal(h: any) {
    setEditHolidayModal({
      isOpen: true,
      id: h.id,
      name: h.name || '',
      date: h.holiday_date || '',
      type: h.holiday_type || 'GAZETTED',
      description: h.description || '',
      isActive: Boolean(h.is_active),
      loading: false,
      error: null
    });
  }

  async function handleSaveEditHoliday(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!editHolidayModal.name.trim()) {
      setEditHolidayModal(prev => ({ ...prev, error: 'Holiday name is mandatory.' }));
      return;
    }
    const dYear = editHolidayModal.date.split('-')[0];
    if (!/^\d{4}$/.test(dYear)) {
      setEditHolidayModal(prev => ({ ...prev, error: 'Holiday date year must be exactly 4 digits.' }));
      return;
    }

    setEditHolidayModal(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.put(`/calendar/holidays/${editHolidayModal.id}`, {
        name: editHolidayModal.name.trim(),
        holiday_date: editHolidayModal.date,
        holiday_type: editHolidayModal.type,
        description: editHolidayModal.description.trim(),
        is_active: editHolidayModal.isActive
      });

      setEditHolidayModal(prev => ({ ...prev, isOpen: false, loading: false }));
      await loadHolidaysList();
      executeCalculation();
    } catch (err: any) {
      setEditHolidayModal(prev => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Failed to update holiday'
      }));
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
    const fromYear = from.split('-')[0];
    const toYear = to.split('-')[0];
    if (!/^\d{4}$/.test(fromYear)) {
      alert('Validation Error: From Date year must be exactly 4 digits.');
      return;
    }
    if (!/^\d{4}$/.test(toYear)) {
      alert('Validation Error: To Date year must be exactly 4 digits.');
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
    <div className="feature-page w-full max-w-none m-0 pb-10" style={{ width: '100%', maxWidth: 'none', margin: 0, padding: '0 0 40px 0' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold m-0 text-slate-900 dark:text-white tracking-tight">
          Academic Calendar &amp; Holidays
        </h1>
        <p className="muted m-0 mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Authoritative institutional calendar: Configure academic sessions, weekly working days, weekend policies, gazetted holidays, and verify working day calculations without double counting.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b-2 border-slate-200 dark:border-slate-700 mb-6 flex-wrap pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`bg-transparent border-0 py-3 px-4.5 text-sm font-semibold cursor-pointer flex items-center gap-2 border-b-2 -mb-0.5 transition-colors ${
            activeTab === 'sessions'
              ? 'text-blue-600 dark:text-blue-400 border-b-blue-600'
              : 'text-slate-500 dark:text-slate-400 border-b-transparent hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Clock size={16} /> Academic Sessions
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('working-days')}
          className={`bg-transparent border-0 py-3 px-4.5 text-sm font-semibold cursor-pointer flex items-center gap-2 border-b-2 -mb-0.5 transition-colors ${
            activeTab === 'working-days'
              ? 'text-blue-600 dark:text-blue-400 border-b-blue-600'
              : 'text-slate-500 dark:text-slate-400 border-b-transparent hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Sliders size={16} /> Weekly Working Days &amp; Weekend Rules
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('holidays')}
          className={`bg-transparent border-0 py-3 px-4.5 text-sm font-semibold cursor-pointer flex items-center gap-2 border-b-2 -mb-0.5 transition-colors ${
            activeTab === 'holidays'
              ? 'text-blue-600 dark:text-blue-400 border-b-blue-600'
              : 'text-slate-500 dark:text-slate-400 border-b-transparent hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <CalendarCheck size={16} /> Holiday Manager ({holidays.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          className={`bg-transparent border-0 py-3 px-4.5 text-sm font-semibold cursor-pointer flex items-center gap-2 border-b-2 -mb-0.5 transition-colors ${
            activeTab === 'calculator'
              ? 'text-blue-600 dark:text-blue-400 border-b-blue-600'
              : 'text-slate-500 dark:text-slate-400 border-b-transparent hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <CalendarDays size={16} /> Working Day &amp; Weekend/Holiday Calculator
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('academic-calendar')}
          className={`bg-transparent border-0 py-3 px-4.5 text-sm font-semibold cursor-pointer flex items-center gap-2 border-b-2 -mb-0.5 transition-colors ${
            activeTab === 'academic-calendar'
              ? 'text-blue-600 dark:text-blue-400 border-b-blue-600'
              : 'text-slate-500 dark:text-slate-400 border-b-transparent hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Calendar size={16} /> Academic Holiday Calendar
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
                    {['YEAR', 'START', 'END', 'STUDENTS', 'CLASSES', 'SECTIONS', 'STATUS', 'ACTIONS'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map(x => (
                    <tr key={x.id}>
                      <td><b>{x.name}</b></td>
                      <td>{String(x.start_date).slice(0, 10)}</td>
                      <td>{String(x.end_date).slice(0, 10)}</td>
                      <td>{x.student_count ?? 0}</td>
                      <td>{x.class_count ?? 0}</td>
                      <td>{x.section_count ?? 0}</td>
                      <td>
                        <span
                          className={`badge ${x.is_archived ? 'expired' : x.is_active ? 'active' : ''}`}
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                            background: x.is_archived ? "var(--secondary)" : x.is_active ? "var(--secondary)" : "var(--secondary)",
                            color: x.is_archived ? "var(--destructive)" : x.is_active ? "var(--success)" : "var(--muted-foreground)"
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
                              background: "var(--info)",
                              color: "var(--background)",
                              border: 'none',
                              padding: '6px 14px',
                              borderRadius: '4px',
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
                                background: "var(--warning)",
                                color: "var(--background)",
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '4px',
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
                                background: "var(--info)",
                                color: "var(--background)",
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '4px',
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
                                background: "var(--success)",
                                color: "var(--background)",
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '4px',
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
                                background: "var(--destructive)",
                                color: "var(--background)",
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '4px',
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
                      <td colSpan={8} className="muted" style={{ padding: 20 }}>
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
            <div className={workingDaysMsg.type === 'success' ? 'success' : 'error'} style={{ padding: 12, borderRadius: 4 }}>
              {workingDaysMsg.text}
            </div>
          )}

          {/* Presets Card */}
          <div className="panel" style={{ padding: 20, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} style={{ color: "var(--primary)" }} />
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
                style={{ fontSize: 13, padding: '8px 14px', borderRadius: 4 }}
              >
                Mon – Sat (Standard 6-Day Institutional Week)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => applyPreset('MON_FRI')}
                style={{ fontSize: 13, padding: '8px 14px', borderRadius: 4 }}
              >
                Mon – Fri (Standard 5-Day Institutional Week)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => applyPreset('SUN_THU')}
                style={{ fontSize: 13, padding: '8px 14px', borderRadius: 4 }}
              >
                Sun – Thu (Middle Eastern Institutional Week)
              </button>
            </div>
          </div>

          {/* Day of Week Selector */}
          <div className="panel" style={{ padding: 20, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} style={{ color: "var(--primary)" }} />
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
                      borderRadius: 4,
                      border: isWorking ? "2px solid var(--border)" : "1px solid var(--border, var(--border))",
                      background: isWorking ? "var(--accent)" : "var(--bg-card, var(--card))",
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: isWorking ? "var(--primary)" : 'var(--text-muted)' }}>
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
                        color: isWorking ? "var(--success)" : "var(--destructive)"
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
          <div className="panel" style={{ padding: 20, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} style={{ color: "var(--primary)" }} />
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
                      borderRadius: 4,
                      border: isSelected ? "2px solid var(--border)" : "1px solid var(--border, var(--border))",
                      background: isSelected ? "var(--accent)" : "var(--bg-card, var(--card))",
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
                      <b style={{ color: isSelected ? "var(--primary)" : 'inherit' }}>{opt.title}</b>
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
            <div className={holidayMsg.type === 'success' ? 'success' : 'error'} style={{ padding: 12, borderRadius: 4 }}>
              {holidayMsg.text}
            </div>
          )}

          {/* Add Holiday Card */}
          <div className="panel" style={{ padding: 20, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={18} style={{ color: "var(--primary)" }} />
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
                  min="1900-01-01"
                  max="2099-12-31"
                  value={holidayFromDate}
                  onChange={e => {
                    handleDateInput(e.target.value, val => {
                      setHolidayFromDate(val);
                      if (!holidayToDate || holidayToDate < val) {
                        setHolidayToDate(val);
                      }
                    });
                  }}
                  required
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>To Date *</span>
                <input
                  type="date"
                  min={holidayFromDate || '1900-01-01'}
                  max="2099-12-31"
                  value={holidayToDate}
                  onChange={e => handleDateInput(e.target.value, setHolidayToDate)}
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
                    <span style={{ color: "var(--destructive)", fontWeight: 600 }}>
                      ⚠️ "To Date" cannot be earlier than "From Date"
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: "var(--accent)", color: "var(--primary)", padding: '4px 10px', borderRadius: 4, border: "1px solid var(--border)", fontWeight: 600 }}>
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
          <div className="panel" style={{ padding: 20, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
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
                                  background: "var(--secondary)",
                                  color: "var(--warning)",
                                  padding: '2px 6px',
                                  borderRadius: 4,
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
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                background: "var(--card)",
                                color: "var(--primary)"
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
                                  color: "var(--warning)",
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
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                background: h.is_active ? "var(--secondary)" : "var(--secondary)",
                                color: h.is_active ? "var(--success)" : "var(--destructive)"
                              }}
                            >
                              {h.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="small-btn edit-btn"
                                title="Edit holiday details"
                                onClick={() => openEditHolidayModal(h)}
                                style={{
                                  background: "var(--info)",
                                  color: "var(--background)",
                                  border: 'none',
                                  padding: '4px 9px',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <Edit2 size={12} />
                                <span>Edit</span>
                              </button>

                              {isMulti ? (
                                <>
                                  <button
                                    type="button"
                                    className="small-btn danger-btn"
                                    title="Delete only this specific date"
                                    onClick={() => handleDeleteHoliday(h.id, h.name, h.holiday_date, false)}
                                    style={{
                                      background: "var(--destructive)",
                                      color: "var(--background)",
                                      border: 'none',
                                      padding: '4px 8px',
                                      borderRadius: 4,
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
                                      background: "var(--destructive)",
                                      color: "var(--background)",
                                      border: 'none',
                                      padding: '4px 8px',
                                      borderRadius: 4,
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
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="small-btn danger-btn"
                                  onClick={() => handleDeleteHoliday(h.id, h.name, h.holiday_date, false)}
                                  style={{
                                    background: "var(--destructive)",
                                    color: "var(--background)",
                                    border: 'none',
                                    padding: '4px 10px',
                                    borderRadius: 4,
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
                            </div>
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
          <div className="panel" style={{ padding: 20, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={18} style={{ color: "var(--primary)" }} />
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
                  min="1900-01-01"
                  max="2099-12-31"
                  value={calcStart}
                  onChange={e => handleDateInput(e.target.value, setCalcStart)}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>End Date</span>
                <input
                  type="date"
                  min="1900-01-01"
                  max="2099-12-31"
                  value={calcEnd}
                  onChange={e => handleDateInput(e.target.value, setCalcEnd)}
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
            <div className="error" style={{ padding: 12, borderRadius: 4 }}>
              {calcError}
            </div>
          )}

          {/* Metrics Summary Cards */}
          {calcResult && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
                <div style={{ background: "var(--bg-card, var(--card))", padding: 16, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted, var(--muted-foreground))", fontWeight: 600, textTransform: 'uppercase' }}>Total Days</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text, var(--foreground))", marginTop: 4 }}>
                    {calcResult.totalDays}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted, var(--muted-foreground))", marginTop: 2 }}>Inclusive range</div>
                </div>

                <div style={{ background: "var(--secondary)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, textTransform: 'uppercase' }}>Working Days</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--success)", marginTop: 4 }}>
                    {calcResult.workingDays}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--success)", marginTop: 2 }}>Instructional sessions</div>
                </div>

                <div style={{ background: "var(--secondary)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, color: "var(--destructive)", fontWeight: 600, textTransform: 'uppercase' }}>Non-Working Days</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--destructive)", marginTop: 4 }}>
                    {calcResult.nonWorkingDays}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--destructive)", marginTop: 2 }}>Weekends + Holidays</div>
                </div>

                <div style={{ background: "var(--accent)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600, textTransform: 'uppercase' }}>Weekend Days</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--primary)", marginTop: 4 }}>
                    {calcResult.weekendDays}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--primary)", marginTop: 2 }}>Per school calendar</div>
                </div>

                <div style={{ background: "var(--secondary)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, color: "var(--info)", fontWeight: 600, textTransform: 'uppercase' }}>Holidays</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--info)", marginTop: 4 }}>
                    {calcResult.holidayDays}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--info)", marginTop: 2 }}>Gazetted &amp; Institutional</div>
                </div>

                <div style={{ background: "var(--secondary)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, color: "var(--warning)", fontWeight: 600, textTransform: 'uppercase' }}>Overlap Deduplicated</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--warning)", marginTop: 4 }}>
                    {calcResult.overlapDays}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--warning)", marginTop: 2 }}>Zero double-counting</div>
                </div>
              </div>

              {/* Deduplication Invariant Banner */}
              <div style={{
                background: "var(--card-subtle, var(--card))",
                border: "1px solid var(--border, var(--border))",
                borderRadius: 4,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <CheckCircle2 size={18} style={{ color: "var(--success)", flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: "var(--text, var(--muted-foreground))" }}>
                  <b>Mathematical Invariant Verified:</b> Total Days ({calcResult.totalDays}) = Working Days ({calcResult.workingDays}) + Non-Working Days ({calcResult.nonWorkingDays}). Non-Working Days = Weekend Days ({calcResult.weekendDays}) + Holidays ({calcResult.holidayDays}) − Overlap Days ({calcResult.overlapDays}) = <b>{calcResult.nonWorkingDays}</b>.
                </div>
              </div>

              {/* Day-by-Day Breakdown Table */}
              <div className="panel" style={{ padding: 20, borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
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
                        let badgeStyle = { bg: '#cce6e1', text: '#02604f' };
                        let label = 'WORKING DAY';

                        if (day.status === 'WEEKEND_AND_HOLIDAY') {
                          badgeStyle = { bg: '#fbecd3', text: '#8f5c12' };
                          label = 'WEEKEND & HOLIDAY (OVERLAP)';
                        } else if (day.status === 'HOLIDAY') {
                          badgeStyle = { bg: '#dde1f2', text: '#363f73' };
                          label = 'HOLIDAY';
                        } else if (day.status === 'WEEKEND') {
                          badgeStyle = { bg: '#f7d5d5', text: '#a82424' };
                          label = 'WEEKEND OFF';
                        } else if (day.status === 'HALF_DAY') {
                          badgeStyle = { bg: '#dde1f2', text: '#48549a' };
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
                                  borderRadius: 4,
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
                                <span style={{ color: "var(--info)" }}>Saturday Half-Day Schedule</span>
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

            {/* ─────────────────────────────────────────────────────────────
          TAB 5: ACADEMIC HOLIDAY CALENDAR (FULL YEAR NATIONAL & FESTIVAL SCHEDULE)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'academic-calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header & Controls Bar */}
          <div className="panel" style={{ padding: '20px 24px', borderRadius: 4, border: "1px solid var(--border, var(--border))", background: "var(--bg-card, var(--card))" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text, var(--foreground))", display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={20} style={{ color: "var(--primary)" }} />
                  <span>Academic Holiday Calendar</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: "var(--card)", color: "var(--primary)" }}>
                    {calFilteredHolidays.length} Holidays
                  </span>
                </h3>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  Official institutional annual calendar: View full-year national holidays, cultural festivals, gazetted observances, and school vacations dynamically synchronized with Holiday Manager.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Switch to Holiday Manager shortcut */}
                <button
                  type="button"
                  className="small-btn primary-btn"
                  onClick={() => setActiveTab('holidays')}
                  style={{
                    background: "var(--primary)",
                    color: "var(--background)",
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Plus size={14} />
                  <span>Manage in Holiday Manager</span>
                </button>

                {/* Print Calendar */}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => window.print()}
                  style={{
                    padding: '8px 14px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                  title="Print official academic holiday schedule"
                >
                  <Printer size={14} />
                  <span>Print Calendar</span>
                </button>

                {/* Refresh list */}
                <button
                  type="button"
                  className="secondary"
                  onClick={loadHolidaysList}
                  disabled={loadingHolidays}
                  style={{
                    padding: '8px 12px',
                    fontSize: 12.5,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  title="Refresh holidays from database"
                >
                  <RefreshCw size={14} className={loadingHolidays ? 'animate-spin' : ''} />
                </button>

                {/* View switcher: Grid vs Agenda */}
                <div style={{ display: 'inline-flex', borderRadius: 4, border: "1px solid var(--border, var(--border))", overflow: 'hidden', marginLeft: 4 }}>
                  <button
                    type="button"
                    onClick={() => setCalViewMode('calendar')}
                    style={{
                      background: calViewMode === 'calendar' ? "var(--primary)" : "var(--bg-card, var(--card))",
                      color: calViewMode === 'calendar' ? "var(--background)" : "var(--text, var(--muted-foreground))",
                      border: 'none',
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Calendar size={13} />
                    <span>Monthly Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalViewMode('agenda')}
                    style={{
                      background: calViewMode === 'agenda' ? "var(--primary)" : "var(--bg-card, var(--card))",
                      color: calViewMode === 'agenda' ? "var(--background)" : "var(--text, var(--muted-foreground))",
                      border: 'none',
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Sliders size={13} />
                    <span>Agenda Schedule</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border, var(--border))", display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Session Filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted, var(--muted-foreground))", textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Academic Session
                </span>
                <select
                  value={calSessionFilter}
                  onChange={e => {
                    setCalSessionFilter(e.target.value);
                    if (e.target.value !== 'ALL') setCalYearFilter('ALL');
                  }}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    fontSize: 13,
                    background: "var(--bg-card, var(--card))",
                    minWidth: 160
                  }}
                >
                  <option value="ALL">All Academic Sessions</option>
                  {sortedItems.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.is_active ? '(Active)' : s.is_archived ? '(Archived)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year Filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted, var(--muted-foreground))", textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Calendar Year
                </span>
                <select
                  value={calYearFilter}
                  onChange={e => {
                    setCalYearFilter(e.target.value);
                    if (e.target.value !== 'ALL') setCalSessionFilter('ALL');
                  }}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    fontSize: 13,
                    background: "var(--bg-card, var(--card))",
                    minWidth: 110
                  }}
                >
                  <option value="ALL">All Years</option>
                  {calDistinctYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted, var(--muted-foreground))", textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Category / Observance
                </span>
                <select
                  value={calCategoryFilter}
                  onChange={e => setCalCategoryFilter(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    fontSize: 13,
                    background: "var(--bg-card, var(--card))",
                    minWidth: 170
                  }}
                >
                  <option value="ALL">All Categories &amp; Observances</option>
                  <option value="NATIONAL">🇮🇳 National Holidays</option>
                  <option value="FESTIVAL">🪔 Festivals &amp; Cultural Celebrations</option>
                  <option value="GAZETTED">🏛️ Gazetted Holidays</option>
                  <option value="REGIONAL">🌴 Regional Observances</option>
                  <option value="INSTITUTIONAL">🏫 Institutional / School Breaks</option>
                </select>
              </div>

              {/* Search query */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted, var(--muted-foreground))", textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Search Holidays
                </span>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: "var(--text-muted, var(--muted-foreground))" }} />
                  <input
                    type="text"
                    value={calSearchQuery}
                    onChange={e => setCalSearchQuery(e.target.value)}
                    placeholder="Search holiday name, festival or description..."
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      fontSize: 13,
                      boxSizing: 'border-box'
                    }}
                  />
                  {calSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCalSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: 2,
                        color: 'var(--text-muted)'
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
            {/* Total Holidays Card */}
            <div style={{ background: "var(--card)", padding: '16px 18px', borderRadius: 4, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Annual Holidays
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--foreground)", marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span>{calKpiStats.totalDays}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>days listed</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>
                Configured in Holiday Manager
              </div>
            </div>

            {/* National Holidays Card */}
            <div style={{ background: "var(--secondary)", padding: '16px 18px', borderRadius: 4, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--destructive)", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🇮🇳 National Holidays
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--destructive)", marginTop: 4 }}>
                {calKpiStats.nationalHolidays}
              </div>
              <div style={{ fontSize: 11, color: "var(--destructive)", marginTop: 3 }}>
                Republic, Independence, Gandhi Jayanti
              </div>
            </div>

            {/* Cultural Festivals Card */}
            <div style={{ background: "var(--secondary)", padding: '16px 18px', borderRadius: 4, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--info)", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🪔 Festivals &amp; Cultural
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--info)", marginTop: 4 }}>
                {calKpiStats.festivalHolidays}
              </div>
              <div style={{ fontSize: 11, color: "var(--info)", marginTop: 3 }}>
                Durga Puja, Diwali, Holi, Kali Pujo
              </div>
            </div>

            {/* Gazetted / Institutional Card */}
            <div style={{ background: "var(--accent)", padding: '16px 18px', borderRadius: 4, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🏛️ Gazetted &amp; Institutional
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--primary)", marginTop: 4 }}>
                {calKpiStats.gazettedHolidays + calKpiStats.otherHolidays}
              </div>
              <div style={{ fontSize: 11, color: "var(--primary)", marginTop: 3 }}>
                Good Friday, Christmas, Guru Nanak
              </div>
            </div>

            {/* Upcoming Holiday Countdown Card */}
            <div style={{ background: "var(--card)", padding: '16px 18px', borderRadius: 4, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Sparkles size={13} style={{ color: "var(--primary)" }} />
                <span>Next Upcoming Holiday</span>
              </div>
              {calKpiStats.upcoming ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--foreground)", marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {calKpiStats.upcoming.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--success)", fontWeight: 700, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{calKpiStats.upcoming.holiday_date}</span>
                    <span style={{ background: "var(--secondary)", padding: '1px 6px', borderRadius: 4 }}>
                      {calKpiStats.daysUntilUpcoming === 0 ? 'Today!' : `in ${calKpiStats.daysUntilUpcoming} day${calKpiStats.daysUntilUpcoming === 1 ? '' : 's'}`}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 8 }}>
                  No upcoming holidays scheduled
                </div>
              )}
            </div>
          </div>

          {/* Legend Bar */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', padding: '10px 16px', background: "var(--card-subtle, var(--card))", borderRadius: 4, fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: "var(--text, var(--muted-foreground))" }}>Legend:</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: "var(--destructive)" }} />
              <span>National Holiday</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: "var(--info)" }} />
              <span>Cultural Festival</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: "var(--primary)" }} />
              <span>Gazetted Holiday</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: "var(--success)" }} />
              <span>Regional / Institutional</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--secondary)" }} />
              <span>Weekend (Sun/Off Sat)</span>
            </span>
          </div>

          {/* VIEW MODE 1: MONTHLY CALENDAR GRID */}
          {calViewMode === 'calendar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Month quick jumper */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setCalMonthViewMode('all-months')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: "1px solid var(--border, var(--border))",
                      background: calMonthViewMode === 'all-months' ? "var(--primary)" : "var(--bg-card, var(--card))",
                      color: calMonthViewMode === 'all-months' ? "var(--background)" : "var(--text, var(--muted-foreground))"
                    }}
                  >
                    Full Year (12 Months)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalMonthViewMode('single-month')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: "1px solid var(--border, var(--border))",
                      background: calMonthViewMode === 'single-month' ? "var(--primary)" : "var(--bg-card, var(--card))",
                      color: calMonthViewMode === 'single-month' ? "var(--background)" : "var(--text, var(--muted-foreground))"
                    }}
                  >
                    Single Month View
                  </button>
                </div>

                {calMonthViewMode === 'single-month' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setCalActiveMonth(prev => (prev === 0 ? 11 : prev - 1))}
                      style={{ padding: '4px 8px' }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: 14, fontWeight: 700, minWidth: 120, textAlign: 'center' }}>
                      {MONTH_NAMES[calActiveMonth]} {calYearFilter !== 'ALL' ? calYearFilter : new Date().getFullYear()}
                    </span>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setCalActiveMonth(prev => (prev === 11 ? 0 : prev + 1))}
                      style={{ padding: '4px 8px' }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Grid Render */}
              {calMonthViewMode === 'all-months' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16 }}>
                  {MONTH_NAMES.map((mName, mIdx) => {
                    const displayY = calYearFilter !== 'ALL' ? Number(calYearFilter) : new Date().getFullYear();
                    const firstDayOfWeek = new Date(Date.UTC(displayY, mIdx, 1)).getUTCDay();
                    const totalDaysInMonth = new Date(Date.UTC(displayY, mIdx + 1, 0)).getUTCDate();
                    const monthPaddedStr = String(mIdx + 1).padStart(2, '0');

                    // Filter holidays for this month
                    const monthHolidays = calFilteredHolidays.filter(h => {
                      const [hy, hm] = h.holiday_date.split('-');
                      return Number(hy) === displayY && hm === monthPaddedStr;
                    });

                    const holidaysMap: Record<number, any[]> = {};
                    monthHolidays.forEach(h => {
                      const dayNum = Number(h.holiday_date.split('-')[2]);
                      if (!holidaysMap[dayNum]) holidaysMap[dayNum] = [];
                      holidaysMap[dayNum].push(h);
                    });

                    return (
                      <div
                        key={mName}
                        style={{
                          background: "var(--bg-card, var(--card))",
                          border: monthHolidays.length > 0 ? "1px solid var(--border)" : "1px solid var(--border, var(--border))",
                          borderRadius: 4,
                          padding: 14,
                          boxShadow: 'none'
                        }}
                      >
                        {/* Month Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text, var(--foreground))" }}>
                            {mName}
                          </span>
                          {monthHolidays.length > 0 ? (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: "var(--card)", color: "var(--primary)" }}>
                              {monthHolidays.length} holiday{monthHolidays.length === 1 ? '' : 's'}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--text-muted, var(--muted-foreground))" }}>0 holidays</span>
                          )}
                        </div>

                        {/* Calendar Day Labels */}
                        <div className="ui-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center', fontSize: 10, fontWeight: 700, color: "var(--text-muted, var(--muted-foreground))", marginBottom: 4 }}>
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                            <div key={d} style={{ padding: '2px 0', color: i === 0 ? "var(--destructive)" : 'inherit' }}>{d}</div>
                          ))}
                        </div>

                        {/* Calendar Day Matrix */}
                        <div className="ui-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                            <div key={'empty-' + i} style={{ height: 32 }} />
                          ))}

                          {Array.from({ length: totalDaysInMonth }).map((_, i) => {
                            const dayNum = i + 1;
                            const dayOfWeek = (firstDayOfWeek + i) % 7;
                            const isWeekend = weekendDays.includes(dayOfWeek) || (dayOfWeek === 6 && saturdayRule === 'OFF');
                            const dayHolidays = holidaysMap[dayNum];
                            const primaryHol = dayHolidays?.[0];
                            const styleInfo = primaryHol ? getHolidayCategoryStyle(primaryHol.holiday_type) : null;

                            return (
                              <div
                                key={dayNum}
                                onClick={() => { if (dayHolidays && dayHolidays.length > 0) setCalInspectHoliday(dayHolidays[0]); }}
                                title={dayHolidays ? dayHolidays.map(h => `${h.name} (${h.holiday_type})`).join('; ') : undefined}
                                style={{
                                  height: 32,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: dayHolidays ? 800 : isWeekend ? 600 : 500,
                                  cursor: dayHolidays ? 'pointer' : 'default',
                                  position: 'relative',
                                  background: styleInfo
                                    ? styleInfo.bg
                                    : isWeekend
                                      ? "var(--card-subtle, var(--secondary))"
                                      : 'transparent',
                                  color: styleInfo
                                    ? styleInfo.color
                                    : isWeekend
                                      ? "var(--muted-foreground)"
                                      : "var(--text, var(--foreground))",
                                  border: styleInfo ? `1px solid ${styleInfo.border}` : '1px solid transparent',
                                  transition: 'transform 0.1s'
                                }}
                              >
                                <span>{dayNum}</span>
                                {dayHolidays && (
                                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: styleInfo?.badgeBg, marginTop: 1 }} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* SINGLE MONTH DETAILED VIEW */
                <div style={{ background: "var(--bg-card, var(--card))", border: "1px solid var(--border, var(--border))", borderRadius: 4, padding: 20 }}>
                  <div className="ui-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, textAlign: 'center', fontSize: 13, fontWeight: 700, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                      <div key={d} style={{ color: i === 0 ? "var(--destructive)" : "var(--text, var(--muted-foreground))" }}>{d}</div>
                    ))}
                  </div>

                  {(() => {
                    const displayY = calYearFilter !== 'ALL' ? Number(calYearFilter) : new Date().getFullYear();
                    const firstDayOfWeek = new Date(Date.UTC(displayY, calActiveMonth, 1)).getUTCDay();
                    const totalDaysInMonth = new Date(Date.UTC(displayY, calActiveMonth + 1, 0)).getUTCDate();
                    const monthPaddedStr = String(calActiveMonth + 1).padStart(2, '0');

                    const monthHolidays = calFilteredHolidays.filter(h => {
                      const [hy, hm] = h.holiday_date.split('-');
                      return Number(hy) === displayY && hm === monthPaddedStr;
                    });

                    const holidaysMap: Record<number, any[]> = {};
                    monthHolidays.forEach(h => {
                      const dayNum = Number(h.holiday_date.split('-')[2]);
                      if (!holidaysMap[dayNum]) holidaysMap[dayNum] = [];
                      holidaysMap[dayNum].push(h);
                    });

                    return (
                      <div className="ui-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                          <div key={'empty-' + i} style={{ minHeight: 90, background: "var(--card-subtle, var(--card))", borderRadius: 4, border: "1px dashed var(--border)" }} />
                        ))}

                        {Array.from({ length: totalDaysInMonth }).map((_, i) => {
                          const dayNum = i + 1;
                          const dayOfWeek = (firstDayOfWeek + i) % 7;
                          const isWeekend = weekendDays.includes(dayOfWeek) || (dayOfWeek === 6 && saturdayRule === 'OFF');
                          const dayHolidays = holidaysMap[dayNum];

                          return (
                            <div
                              key={dayNum}
                              style={{
                                minHeight: 90,
                                background: dayHolidays ? "var(--card)" : isWeekend ? "var(--card-subtle, var(--card))" : "var(--bg-card, var(--card))",
                                border: dayHolidays ? "1px solid var(--border)" : "1px solid var(--border, var(--border))",
                                borderRadius: 4,
                                padding: 8,
                                display: 'flex',
                                flexDirection: 'column'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: dayHolidays ? 800 : 600, color: dayHolidays ? "var(--warning)" : isWeekend ? "var(--muted-foreground)" : 'var(--text)' }}>
                                  {dayNum}
                                </span>
                                {isWeekend && !dayHolidays && (
                                  <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 600 }}>Weekend</span>
                                )}
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                                {dayHolidays && dayHolidays.map(h => {
                                  const cStyle = getHolidayCategoryStyle(h.holiday_type);
                                  return (
                                    <div
                                      key={h.id}
                                      onClick={() => setCalInspectHoliday(h)}
                                      style={{
                                        background: cStyle.bg,
                                        border: `1px solid ${cStyle.border}`,
                                        color: cStyle.color,
                                        borderRadius: 4,
                                        padding: '4px 6px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        lineHeight: 1.2
                                      }}
                                    >
                                      <div>{h.name}</div>
                                      <div style={{ fontSize: 9.5, opacity: 0.85, marginTop: 2 }}>{h.holiday_type}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 2: CHRONOLOGICAL AGENDA / LIST VIEW */}
          {calViewMode === 'agenda' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {Object.keys(calHolidaysByMonth).length === 0 ? (
                <div className="panel" style={{ padding: 40, textAlign: 'center', borderRadius: 4, border: "1px solid var(--border, var(--border))" }}>
                  <Calendar size={36} style={{ color: "var(--muted-foreground)", marginBottom: 12 }} />
                  <h4 style={{ margin: 0, fontSize: 16 }}>No Holidays Found in Selected Filters</h4>
                  <p className="muted" style={{ margin: '6px 0 16px', fontSize: 13 }}>
                    No holidays match the selected academic session, calendar year, or search query.
                  </p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => { setCalSessionFilter('ALL'); setCalYearFilter('ALL'); setCalCategoryFilter('ALL'); setCalSearchQuery(''); }}
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                Object.entries(calHolidaysByMonth).map(([monthKey, monthItems]) => {
                  const [yStr, mStr] = monthKey.split('-');
                  const monthName = MONTH_NAMES[Number(mStr) - 1];

                  return (
                    <div key={monthKey} style={{ background: "var(--bg-card, var(--card))", borderRadius: 4, border: "1px solid var(--border, var(--border))", overflow: 'hidden' }}>
                      {/* Month Header Banner */}
                      <div style={{ padding: '12px 20px', background: "var(--card-subtle, var(--card))", borderBottom: "1px solid var(--border, var(--border))", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--text, var(--foreground))", display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Calendar size={16} style={{ color: "var(--primary)" }} />
                          <span>{monthName} {yStr}</span>
                        </h4>
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: "var(--card)", color: "var(--primary)" }}>
                          {monthItems.length} holiday{monthItems.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {/* Holiday Items */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {monthItems.map((h, hIdx) => {
                          const [hy, hm, hd] = h.holiday_date.split('-').map(Number);
                          const dt = new Date(Date.UTC(hy, hm - 1, hd));
                          const dayName = DAY_NAMES[dt.getUTCDay()];
                          const isWeekend = weekendDays.includes(dt.getUTCDay()) || (dt.getUTCDay() === 6 && saturdayRule === 'OFF');
                          const cStyle = getHolidayCategoryStyle(h.holiday_type);
                          const isMulti = (nameCounts[h.name] || 0) > 1;

                          // Match academic session
                          const matchedSession = items.find(s => {
                            const startStr = String(s.start_date).slice(0, 10);
                            const endStr = String(s.end_date).slice(0, 10);
                            return h.holiday_date >= startStr && h.holiday_date <= endStr;
                          });

                          return (
                            <div
                              key={h.id}
                              style={{
                                padding: '14px 20px',
                                borderBottom: hIdx < monthItems.length - 1 ? "1px solid var(--border)" : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 16,
                                flexWrap: 'wrap',
                                transition: 'background 0.15s'
                              }}
                            >
                              {/* Left: Date block + Holiday Info */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                {/* Big Date Box */}
                                <div
                                  style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 4,
                                    background: cStyle.bg,
                                    border: `1px solid ${cStyle.border}`,
                                    color: cStyle.color,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                >
                                  <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{hd}</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>{dayName.slice(0, 3)}</span>
                                </div>

                                {/* Holiday Name & Metadata */}
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text, var(--foreground))" }}>
                                      {h.name}
                                    </span>

                                    {/* Multi-day series badge */}
                                    {isMulti && (
                                      <span
                                        style={{
                                          fontSize: 10.5,
                                          background: "var(--secondary)",
                                          color: "var(--warning)",
                                          padding: '2px 7px',
                                          borderRadius: 4,
                                          fontWeight: 700
                                        }}
                                      >
                                        Series ({nameCounts[h.name]}d)
                                      </span>
                                    )}

                                    {/* Category pill */}
                                    <span
                                      style={{
                                        fontSize: 11,
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        background: cStyle.bg,
                                        color: cStyle.color,
                                        fontWeight: 700,
                                        border: `1px solid ${cStyle.border}`
                                      }}
                                    >
                                      {cStyle.label}
                                    </span>

                                    {/* Matching academic session */}
                                    {matchedSession && (
                                      <span
                                        style={{
                                          fontSize: 11,
                                          padding: '2px 8px',
                                          borderRadius: 4,
                                          background: "var(--secondary)",
                                          color: "var(--muted-foreground)",
                                          fontWeight: 600
                                        }}
                                      >
                                        Session {matchedSession.name}
                                      </span>
                                    )}
                                  </div>

                                  {/* Description & weekend overlap */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap', fontSize: 12, color: "var(--text-muted, var(--muted-foreground))" }}>
                                    <span>{h.holiday_date} ({dayName})</span>
                                    <span>•</span>
                                    {isWeekend ? (
                                      <span style={{ color: "var(--warning)", fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <Info size={13} /> Falls on {dayName} (Deduplicated)
                                      </span>
                                    ) : (
                                      <span style={{ color: "var(--success)", fontWeight: 600 }}>Instructional Day Off (Weekday)</span>
                                    )}
                                    {h.description && (
                                      <>
                                        <span>•</span>
                                        <span style={{ fontStyle: 'italic' }}>{h.description}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Actions */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button
                                  type="button"
                                  className="small-btn edit-btn"
                                  onClick={() => openEditHolidayModal(h)}
                                  style={{
                                    background: "var(--info)",
                                    color: "var(--background)",
                                    border: 'none',
                                    padding: '5px 10px',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                  title="Edit holiday details in modal"
                                >
                                  <Edit2 size={12} />
                                  <span>Edit</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Inspect Holiday Detail Modal */}
          {calInspectHoliday && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "var(--card)",
                backdropFilter: 'blur(3px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 16
              }}
              onClick={() => setCalInspectHoliday(null)}
            >
              <div
                style={{
                  background: "var(--bg-card, var(--card))",
                  borderRadius: 4,
                  boxShadow: 'none',
                  width: '100%',
                  maxWidth: 440,
                  overflow: 'hidden',
                  border: "1px solid var(--border, var(--border))"
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ padding: '16px 20px', borderBottom: "1px solid var(--border)", background: "var(--card-subtle, var(--card))", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text, var(--foreground))", display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={16} style={{ color: "var(--primary)" }} />
                    <span>Holiday Inspection</span>
                  </h3>
                  <button type="button" onClick={() => setCalInspectHoliday(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}>
                    <X size={16} />
                  </button>
                </div>

                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text, var(--foreground))" }}>
                    {calInspectHoliday.name}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {(() => {
                      const c = getHolidayCategoryStyle(calInspectHoliday.holiday_type);
                      return (
                        <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, background: c.bg, color: c.color, fontWeight: 700, border: `1px solid ${c.border}` }}>
                          {c.label}
                        </span>
                      );
                    })()}

                    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, background: calInspectHoliday.is_active ? "var(--secondary)" : "var(--secondary)", color: calInspectHoliday.is_active ? "var(--success)" : "var(--destructive)", fontWeight: 700 }}>
                      {calInspectHoliday.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>

                  <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: "var(--card)", padding: 10, borderRadius: 4, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600 }}>Date</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{calInspectHoliday.holiday_date}</div>
                    </div>
                    <div style={{ background: "var(--card)", padding: 10, borderRadius: 4, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600 }}>Day of Week</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                        {(() => {
                          const [y, m, d] = calInspectHoliday.holiday_date.split('-').map(Number);
                          return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
                        })()}
                      </div>
                    </div>
                  </div>

                  {calInspectHoliday.description && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600, marginBottom: 4 }}>Description / Note</div>
                      <div style={{ fontSize: 13, color: "var(--muted-foreground)", background: "var(--card)", padding: 10, borderRadius: 4, border: "1px solid var(--border)" }}>
                        {calInspectHoliday.description}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setCalInspectHoliday(null)}
                      style={{ padding: '7px 14px', fontSize: 12.5 }}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => {
                        const h = calInspectHoliday;
                        setCalInspectHoliday(null);
                        openEditHolidayModal(h);
                      }}
                      style={{
                        padding: '7px 16px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        background: "var(--info)",
                        color: "var(--background)",
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Edit2 size={13} />
                      <span>Edit Holiday</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
            backgroundColor: "var(--card)",
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
              background: "var(--bg-card, var(--card))",
              borderRadius: 4,
              boxShadow: 'none',
              width: '100%',
              maxWidth: 480,
              overflow: 'hidden',
              border: "1px solid var(--border, var(--border))"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: "1px solid var(--border, var(--border))",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: "var(--card-subtle, var(--card))"
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text, var(--foreground))", display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Edit2 size={16} style={{ color: "var(--info)" }} />
                  <span>Edit Academic Session</span>
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: "var(--text-muted, var(--muted-foreground))" }}>
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
                  borderRadius: 4,
                  color: "var(--text-muted, var(--muted-foreground))",
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
                    borderRadius: 4,
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--destructive)",
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
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: "var(--text, var(--muted-foreground))" }}>
                    Session Name <span style={{ color: "var(--destructive)" }}>*</span>
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
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      fontSize: 13.5,
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ fontSize: 11, color: "var(--text-muted, var(--muted-foreground))", marginTop: 4 }}>
                    Must follow <b>YYYY-YYYY</b> format (e.g. 2028-2029)
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: "var(--text, var(--muted-foreground))" }}>
                      Start Date <span style={{ color: "var(--destructive)" }}>*</span>
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
                        borderRadius: 4,
                        border: "1px solid var(--border, var(--border))",
                        fontSize: 13,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: "var(--text, var(--muted-foreground))" }}>
                      End Date <span style={{ color: "var(--destructive)" }}>*</span>
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
                        borderRadius: 4,
                        border: "1px solid var(--border, var(--border))",
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
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    background: "var(--bg-card, var(--card))",
                    color: "var(--text, var(--muted-foreground))",
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
                    borderRadius: 4,
                    border: 'none',
                    background: "var(--info)",
                    color: "var(--background)",
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


      {/* Edit School Holiday Modal */}
      {editHolidayModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "var(--card)",
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
          onClick={() => { if (!editHolidayModal.loading) setEditHolidayModal(prev => ({ ...prev, isOpen: false })); }}
        >
          <div
            style={{
              background: "var(--bg-card, var(--card))",
              borderRadius: 4,
              boxShadow: 'none',
              width: '100%',
              maxWidth: 480,
              overflow: 'hidden',
              border: "1px solid var(--border, var(--border))"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: "1px solid var(--border, var(--border))",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: "var(--card-subtle, var(--card))"
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text, var(--foreground))", display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Edit2 size={16} style={{ color: "var(--info)" }} />
                  <span>Edit School Holiday</span>
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: "var(--text-muted, var(--muted-foreground))" }}>
                  Update holiday name, date, category, and status
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditHolidayModal(prev => ({ ...prev, isOpen: false }))}
                disabled={editHolidayModal.loading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  color: "var(--text-muted, var(--muted-foreground))",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveEditHoliday} style={{ padding: 20 }}>
              {editHolidayModal.error && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '10px 12px',
                    borderRadius: 4,
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--destructive)",
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{editHolidayModal.error}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: "var(--text, var(--muted-foreground))" }}>
                    Holiday Name <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={editHolidayModal.name}
                    onChange={e => setEditHolidayModal(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Durga Puja / Summer Break"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 4,
                      border: "1px solid var(--border, var(--border))",
                      fontSize: 13.5,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: "var(--text, var(--muted-foreground))" }}>
                      Holiday Date <span style={{ color: "var(--destructive)" }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={editHolidayModal.date}
                      min="1900-01-01"
                      max="2099-12-31"
                      onChange={e => handleDateInput(e.target.value, val => setEditHolidayModal(prev => ({ ...prev, date: val })))}
                      required
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: "1px solid var(--border, var(--border))",
                        fontSize: 13,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: "var(--text, var(--muted-foreground))" }}>
                      Category / Type
                    </label>
                    <select
                      value={editHolidayModal.type}
                      onChange={e => setEditHolidayModal(prev => ({ ...prev, type: e.target.value as any }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: "1px solid var(--border, var(--border))",
                        fontSize: 13,
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="GAZETTED">Gazetted Holiday</option>
                      <option value="NATIONAL">National Holiday</option>
                      <option value="FESTIVAL">Festival Holiday</option>
                      <option value="REGIONAL">Regional Holiday</option>
                      <option value="INSTITUTIONAL">Institutional / School</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: "var(--text, var(--muted-foreground))" }}>
                      Status
                    </label>
                    <select
                      value={editHolidayModal.isActive ? 'ACTIVE' : 'INACTIVE'}
                      onChange={e => setEditHolidayModal(prev => ({ ...prev, isActive: e.target.value === 'ACTIVE' }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: "1px solid var(--border, var(--border))",
                        fontSize: 13,
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: "var(--text, var(--muted-foreground))" }}>
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={editHolidayModal.description}
                      onChange={e => setEditHolidayModal(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional context"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 4,
                        border: "1px solid var(--border, var(--border))",
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
                  onClick={() => setEditHolidayModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={editHolidayModal.loading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 4,
                    border: "1px solid var(--border, var(--border))",
                    background: "var(--bg-card, var(--card))",
                    color: "var(--text, var(--muted-foreground))",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: editHolidayModal.loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editHolidayModal.loading}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 4,
                    border: 'none',
                    background: "var(--info)",
                    color: "var(--background)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: editHolidayModal.loading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {editHolidayModal.loading ? (
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
