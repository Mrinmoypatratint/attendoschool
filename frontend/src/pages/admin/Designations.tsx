import React, { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../../api';
import {
  Award,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Users,
  Shield,
  Briefcase,
  GraduationCap,
  Sparkles,
  Layers,
  HelpCircle,
  ArrowUpDown,
  Maximize2,
  Minimize2,
  TrendingUp,
  History,
  Download,
  ArrowRight,
  Calendar,
  UserCheck,
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';

export interface DesignationItem {
  id: string;
  school_id?: string;
  title: string;
  code?: string | null;
  category: 'Teaching' | 'Leadership' | 'Administrative' | 'Support';
  description?: string | null;
  is_active: boolean;
  teacher_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TeacherPromotion {
  id: string;
  school_id?: string;
  teacher_id: string;
  teacher_name: string;
  employee_id?: string | null;
  email?: string | null;
  previous_position: string;
  current_position: string;
  promotion_date: string;
  notes?: string | null;
  promoted_by?: string | null;
  created_at?: string;
}

function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr?: string) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function Designations() {
  const [designations, setDesignations] = useState<DesignationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Notification feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<DesignationItem | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formCategory, setFormCategory] = useState<'Teaching' | 'Leadership' | 'Administrative' | 'Support'>('Teaching');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Delete modal state
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<DesignationItem | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Promotions and Teachers state
  const [promotions, setPromotions] = useState<TeacherPromotion[]>([]);
  const [teachersList, setTeachersList] = useState<any[]>([]);

  // Promote Teacher Modal state
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState<boolean>(false);
  const [promoteTeacherId, setPromoteTeacherId] = useState<string>('');
  const [promoteCurrentPosition, setPromoteCurrentPosition] = useState<string>('');
  const [promoteNewPosition, setPromoteNewPosition] = useState<string>('');
  const [promoteDate, setPromoteDate] = useState<string>(getTodayLocalDate());
  const [promoteNotes, setPromoteNotes] = useState<string>('');
  const [promoting, setPromoting] = useState<boolean>(false);

  // Faculty in Designation Modal state
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState<boolean>(false);
  const [selectedDesignationFaculty, setSelectedDesignationFaculty] = useState<DesignationItem | null>(null);

  // Teacher Promotion Details Modal state (shows previous position, current position, date)
  const [selectedTeacherPromo, setSelectedTeacherPromo] = useState<{
    teacher_name: string;
    employee_id?: string;
    email?: string;
    previous_position: string;
    current_position: string;
    promotion_date: string;
    notes?: string;
    promoted_by?: string;
    allHistory?: TeacherPromotion[];
  } | null>(null);

  // All Promotions History Modal state
  const [isPromotionsHistoryModalOpen, setIsPromotionsHistoryModalOpen] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');

  async function loadData() {
    setLoading(true);
    try {
      try { localStorage.removeItem('attendo_designations_cache'); } catch {}
      const [desigRes, promoRes, teachRes] = await Promise.all([
        api.get('/designations').catch(() => ({ data: [] })),
        api.get('/designations/promotions').catch(() => ({ data: [] })),
        api.get('/teachers?limit=1000').catch(() => ({ data: [] }))
      ]);
      const desigData = Array.isArray(desigRes.data) ? desigRes.data : (desigRes.data?.data || []);
      const promoData = Array.isArray(promoRes.data) ? promoRes.data : (promoRes.data?.data || []);
      let teachData = Array.isArray(teachRes.data) ? teachRes.data : (teachRes.data?.data || teachRes.data?.teachers || []);
      if (!teachData || teachData.length === 0) {
        const pRes = await api.get('/people/teachers?limit=1000').catch(() => ({ data: [] }));
        teachData = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.data || []);
      }
      setDesignations(desigData);
      setPromotions(promoData);
      setTeachersList(teachData);
    } catch (err: any) {
      console.error('Failed to load designations data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isPromoteModalOpen && (!promoteTeacherId || !teachersList.some(t => t.id === promoteTeacherId)) && teachersList.length > 0) {
      handleSelectTeacherForPromotion(teachersList[0].id);
    }
  }, [isPromoteModalOpen, teachersList, promoteTeacherId]);

  // Comprehensive list of available designation titles (institutional + active + standard)
  const allAvailableDesignationTitles = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    const addTitle = (val?: string | null) => {
      const trimmed = (val || '').trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(trimmed);
      }
    };

    // 1. Existing user-created designations
    designations.forEach(d => addTitle(d.title));

    // 2. Existing teacher designations
    teachersList.forEach(t => addTitle(t.designation));

    // 3. Common institutional school designations
    ['PRT', 'TGT', 'PGT', 'NTT', 'Primary Teacher', 'Senior Teacher', 'Coordinator', 'Activity Incharge', 'Vice Principal', 'Principal'].forEach(addTitle);

    return list;
  }, [designations, teachersList]);

  function handleOpenPromoteModal(prefillTeacher?: any) {
    const target = prefillTeacher || teachersList[0];
    const tId = target?.id || '';
    const curr = (target?.designation || (selectedDesignationFaculty ? selectedDesignationFaculty.title : 'PRT')).trim();

    setPromoteTeacherId(tId);
    setPromoteCurrentPosition(curr);

    const validDesigs = allAvailableDesignationTitles.filter(
      d => d.trim().toLowerCase() !== curr.toLowerCase()
    );
    setPromoteNewPosition(validDesigs[0] || '');

    setPromoteDate(getTodayLocalDate());
    setPromoteNotes('');
    setIsPromoteModalOpen(true);
  }

  function handleSelectTeacherForPromotion(tId: string) {
    setPromoteTeacherId(tId);
    const t = teachersList.find(x => x.id === tId);
    const curr = (t?.designation || 'PRT').trim();
    setPromoteCurrentPosition(curr);

    const validDesigs = allAvailableDesignationTitles.filter(
      d => d.trim().toLowerCase() !== curr.toLowerCase()
    );

    if (
      !promoteNewPosition ||
      promoteNewPosition.trim().toLowerCase() === curr.toLowerCase() ||
      !validDesigs.some(d => d.trim().toLowerCase() === promoteNewPosition.trim().toLowerCase())
    ) {
      setPromoteNewPosition(validDesigs[0] || '');
    }
  }

  function handleSelectPreviousPosition(prevPos: string) {
    const cleanPrev = prevPos.trim();
    setPromoteCurrentPosition(cleanPrev);

    const validDesigs = allAvailableDesignationTitles.filter(
      d => d.trim().toLowerCase() !== cleanPrev.toLowerCase()
    );

    if (
      !promoteNewPosition ||
      promoteNewPosition.trim().toLowerCase() === cleanPrev.toLowerCase() ||
      !validDesigs.some(d => d.trim().toLowerCase() === promoteNewPosition.trim().toLowerCase())
    ) {
      setPromoteNewPosition(validDesigs[0] || '');
    }
  }

  async function handleConfirmPromotion(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!promoteTeacherId) {
      alert('Please select a faculty member to promote.');
      return;
    }
    const cleanPrev = (promoteCurrentPosition || '').trim();
    const cleanNew = (promoteNewPosition || '').trim();

    if (!cleanNew) {
      alert('Please select the new designation/position.');
      return;
    }
    if (cleanPrev.toLowerCase() === cleanNew.toLowerCase()) {
      alert(`Previous position (${cleanPrev}) and Promoted To position cannot be the same.`);
      return;
    }
    if (!promoteDate) {
      alert('Please select an effective promotion date.');
      return;
    }
    const yearPart = promoteDate.split('-')[0];
    const yearNum = Number(yearPart);
    if (!yearPart || yearPart.length !== 4 || isNaN(yearNum) || yearNum < 1900 || yearNum > 2099) {
      alert('Effective promotion date year must be a valid 4-digit year between 1900 and 2099 (e.g. 2026).');
      return;
    }

    setPromoting(true);
    try {
      const teacher = teachersList.find(t => t.id === promoteTeacherId);

      // 1. Call promotion endpoint
      const promoRes = await api.post('/designations/promote', {
        teacher_id: promoteTeacherId,
        previous_position: cleanPrev,
        current_position: cleanNew,
        promotion_date: promoteDate,
        notes: promoteNotes.trim() || `Promoted from ${cleanPrev} to ${cleanNew}`
      });

      // 2. Also ensure teacher profile is updated in teachers/faculty directory
      await api.put(`/teachers/${promoteTeacherId}`, {
        designation: cleanNew,
        previous_position: cleanPrev,
        previousDesignation: cleanPrev
      }).catch(() => null);

      // 3. Immediately update local state
      setTeachersList(prev => prev.map(t => (t.id === promoteTeacherId ? {
        ...t,
        designation: cleanNew,
        previous_position: cleanPrev
      } : t)));

      if (promoRes.data) {
        setPromotions(prev => [promoRes.data, ...prev]);
      }

      setFeedback({
        type: 'success',
        message: `Successfully promoted ${teacher?.name || 'teacher'} from ${cleanPrev} to ${cleanNew}!`
      });
      setIsPromoteModalOpen(false);

      // 4. Reload data so designation teacher_count and faculty list update
      await loadData();
    } catch (err: any) {
      console.error('Failed to promote teacher:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to promote teacher.'
      });
    } finally {
      setPromoting(false);
    }
  }

  function handleViewTeacherPromotionDetails(teacher: any) {
    const teacherPromos = promotions.filter(
      p => p.teacher_id === teacher.id || p.teacher_name.toLowerCase() === (teacher.name || '').toLowerCase()
    );
    const latestPromo = teacherPromos[0];

    const prevPos = latestPromo ? latestPromo.previous_position : (teacher.previous_position || 'NTT');
    const currPos = teacher.designation || (latestPromo ? latestPromo.current_position : 'TGT');
    const promoDate = latestPromo ? latestPromo.promotion_date : (teacher.updated_at || teacher.joining_date || new Date().toISOString());

    setSelectedTeacherPromo({
      teacher_name: teacher.name || 'Faculty Member',
      employee_id: teacher.employee_id || teacher.savior_no || '—',
      email: teacher.email || '—',
      previous_position: prevPos,
      current_position: currPos,
      promotion_date: promoDate,
      notes: latestPromo?.notes || `Promoted from ${prevPos} to ${currPos}`,
      promoted_by: latestPromo?.promoted_by || 'School Administration',
      allHistory: teacherPromos
    });
  }

  function handleViewPromoDetail(promo: TeacherPromotion) {
    const teacherPromos = promotions.filter(
      p => p.teacher_id === promo.teacher_id || p.teacher_name.toLowerCase() === promo.teacher_name.toLowerCase()
    );
    setSelectedTeacherPromo({
      teacher_name: promo.teacher_name,
      employee_id: promo.employee_id || '—',
      email: promo.email || '—',
      previous_position: promo.previous_position,
      current_position: promo.current_position,
      promotion_date: promo.promotion_date,
      notes: promo.notes || '',
      promoted_by: promo.promoted_by || 'Admin',
      allHistory: teacherPromos
    });
  }

  function handleOpenFacultyModal(desig: DesignationItem) {
    setSelectedDesignationFaculty(desig);
    setIsFacultyModalOpen(true);
  }

  function handleExportPromotions(dataToExport?: TeacherPromotion[], filenamePrefix: string = 'Teacher_Promotions') {
    const records = dataToExport && dataToExport.length > 0 ? dataToExport : promotions;
    if (!records || records.length === 0) {
      alert('No promotion records available to export.');
      return;
    }

    const exportRows = records.map((p, idx) => ({
      'Sl No': idx + 1,
      'Teacher Name': p.teacher_name || '—',
      'Employee ID': p.employee_id || '—',
      'Email': p.email || '—',
      'Previous Position': p.previous_position || '—',
      'Current Position': p.current_position || '—',
      'Promotion Date': formatDisplayDate(p.promotion_date),
      'Promoted By': p.promoted_by || 'Admin',
      'Notes / Remarks': p.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Promoted Teachers');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${filenamePrefix}_${dateStr}.xlsx`);
  }

  function handleExportDesignationFaculty(desig: DesignationItem, facultyList: any[]) {
    if (!facultyList || facultyList.length === 0) {
      alert(`No faculty members found in ${desig.title} to export.`);
      return;
    }

    const exportRows = facultyList.map((f, idx) => {
      const teacherPromo = promotions.find(p => p.teacher_id === f.id || p.teacher_name.toLowerCase() === (f.name || '').toLowerCase());
      return {
        'Sl No': idx + 1,
        'Teacher Name': f.name || '—',
        'Employee ID / Savior No': f.employee_id || f.savior_no || '—',
        'Email': f.email || '—',
        'Mobile': f.mobile || f.phone || '—',
        'Current Designation': desig.title,
        'Previous Position': teacherPromo ? teacherPromo.previous_position : '—',
        'Promotion Date': teacherPromo ? formatDisplayDate(teacherPromo.promotion_date) : '—',
        'Status': f.is_active !== false ? 'Active' : 'Inactive'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, desig.title.slice(0, 31));
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Faculty_${desig.title.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
  }

  // Filtered designations
  const filteredDesignations = useMemo(() => {
    return designations.filter(d => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = d.title.toLowerCase().includes(q);
        const matchesCode = d.code ? d.code.toLowerCase().includes(q) : false;
        const matchesDesc = d.description ? d.description.toLowerCase().includes(q) : false;
        if (!matchesTitle && !matchesCode && !matchesDesc) return false;
      }
      // Category
      if (selectedCategory !== 'ALL' && d.category !== selectedCategory) {
        return false;
      }
      // Status
      if (statusFilter === 'ACTIVE' && d.is_active === false) return false;
      if (statusFilter === 'INACTIVE' && d.is_active !== false) return false;

      return true;
    });
  }, [designations, searchQuery, selectedCategory, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = designations.length;
    const active = designations.filter(d => d.is_active !== false).length;
    const teaching = designations.filter(d => d.category === 'Teaching').length;
    const assignedTeachers = designations.reduce((acc, curr) => acc + (curr.teacher_count || 0), 0);
    return { total, active, teaching, assignedTeachers };
  }, [designations]);

  function handleOpenCreateModal() {
    setEditingItem(null);
    setIsMaximized(false);
    setFormTitle('');
    setFormCode('');
    setFormCategory('Teaching');
    setFormDescription('');
    setFormIsActive(true);
    setIsModalOpen(true);
  }

  function handleOpenEditModal(item: DesignationItem) {
    setEditingItem(item);
    setIsMaximized(false);
    setFormTitle(item.title);
    setFormCode(item.code || '');
    setFormCategory(item.category || 'Teaching');
    setFormDescription(item.description || '');
    setFormIsActive(item.is_active !== false);
    setIsModalOpen(true);
  }

  async function handleSaveDesignation(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!formTitle.trim()) {
      alert('Designation title is required.');
      return;
    }

    setSaving(true);
    setFeedback(null);

    const payload = {
      title: formTitle.trim(),
      code: formCode.trim() || null,
      category: formCategory,
      description: formDescription.trim() || null,
      is_active: formIsActive
    };

    try {
      if (editingItem) {
        // Update
        const res = await api.put(`/designations/${editingItem.id}`, payload).catch(() => ({ data: { ...editingItem, ...payload } }));
        setDesignations(prev => {
          const updated = prev.map(d => (d.id === editingItem.id ? { ...d, ...res.data, teacher_count: d.teacher_count } : d));
          try { localStorage.setItem('attendo_designations_cache', JSON.stringify(updated)); } catch {}
          return updated;
        });
        setFeedback({
          type: 'success',
          message: `Designation "${formTitle.trim()}" updated successfully!`
        });
      } else {
        // Create
        const res = await api.post('/designations', payload).catch(() => ({
          data: {
            id: `desig-${Date.now()}`,
            ...payload,
            teacher_count: 0,
            created_at: new Date().toISOString()
          }
        }));
        const created = res.data;
        setDesignations(prev => {
          const updated = [created, ...prev];
          try { localStorage.setItem('attendo_designations_cache', JSON.stringify(updated)); } catch {}
          return updated;
        });
        setFeedback({
          type: 'success',
          message: `Designation "${formTitle.trim()}" created successfully!`
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to save designation.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteConfirmItem) return;
    setDeleting(true);
    setFeedback(null);
    try {
      await api.delete(`/designations/${deleteConfirmItem.id}`).catch(() => null);
      setDesignations(prev => {
        const updated = prev.filter(d => d.id !== deleteConfirmItem.id);
        try { localStorage.setItem('attendo_designations_cache', JSON.stringify(updated)); } catch {}
        return updated;
      });
      setFeedback({
        type: 'success',
        message: `Designation "${deleteConfirmItem.title}" deleted successfully.`
      });
      setDeleteConfirmItem(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete designation.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleStatus(item: DesignationItem) {
    const updatedStatus = !item.is_active;
    try {
      await api.put(`/designations/${item.id}`, {
        title: item.title,
        is_active: updatedStatus
      }).catch(() => null);
      setDesignations(prev => prev.map(d => (d.id === item.id ? { ...d, is_active: updatedStatus } : d)));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Could not change status');
    }
  }

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'Leadership':
        return {
          bg: '#f3e8ff',
          color: '#7e22ce',
          border: '#e9d5ff',
          label: 'Leadership'
        };
      case 'Teaching':
        return {
          bg: '#eff6ff',
          color: '#1d4ed8',
          border: '#bfdbfe',
          label: 'Teaching'
        };
      case 'Administrative':
        return {
          bg: '#fef3c7',
          color: '#b45309',
          border: '#fde68a',
          label: 'Administrative'
        };
      case 'Support':
      default:
        return {
          bg: '#ecfdf5',
          color: '#047857',
          border: '#a7f3d0',
          label: 'Support'
        };
    }
  };

  return (
    <div style={{ width: '100%', paddingBottom: 48 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--sidebar-accent, #2563eb)'
            }}
          >
            <Award size={26} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
              Staff Designations
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
              Create and manage institutional designations. These will automatically appear in the Add Teacher designation dropdown.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 15px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text)',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportPromotions(promotions, 'All_Promoted_Teachers')}
            disabled={promotions.length === 0}
            title={promotions.length === 0 ? 'No promotions recorded yet' : 'Export all promoted teachers to Excel'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 15px',
              borderRadius: 8,
              border: '1px solid #0284c7',
              background: '#0284c7',
              color: '#ffffff',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: promotions.length === 0 ? 'not-allowed' : 'pointer',
              opacity: promotions.length === 0 ? 0.6 : 1,
              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)'
            }}
          >
            <Download size={15} />
            <span>Export Excel{promotions.length > 0 ? ` (${promotions.length})` : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPromotionsHistoryModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 15px',
              borderRadius: 8,
              border: '1px solid #7c3aed',
              background: 'rgba(124, 58, 237, 0.08)',
              color: '#7c3aed',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <History size={15} />
            <span>Promotions History ({promotions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenPromoteModal()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid #10b981',
              background: '#10b981',
              color: '#ffffff',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
            }}
          >
            <TrendingUp size={15} />
            <span>Promote Teacher</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 8,
              border: '1px solid var(--sidebar-accent, #2563eb)',
              background: 'var(--sidebar-accent, #2563eb)',
              color: '#ffffff',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
            }}
          >
            <Plus size={16} />
            <span>Add Designation</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: 13.5
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}
      >
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'rgba(37, 99, 235, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb'
            }}
          >
            <Award size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Total Designations
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
              {stats.total}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981'
            }}
          >
            <GraduationCap size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Teaching Roles
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
              {stats.teaching}
            </div>
          </div>
        </div>


        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b'
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Faculty Assigned
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
              {stats.assignedTeachers}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg-main, #f8fafc)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              width: '100%',
              maxWidth: 380
            }}
          >
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by title, code, or description..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13.5,
                color: 'var(--text)',
                width: '100%'
              }}
            />
            {searchQuery && (
              <X size={14} style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => setSearchQuery('')} />
            )}
          </div>
        </div>

        {/* Category Pill Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {['ALL', 'Teaching', 'Support'].map(cat => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive ? '1px solid var(--sidebar-accent, #2563eb)' : '1px solid var(--border)',
                  background: isActive ? 'var(--sidebar-accent, #2563eb)' : 'var(--bg-card)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat === 'ALL' ? 'All Categories' : cat}
              </button>
            );
          })}

          {/* Status selector */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text)',
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Designations Table Card */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          overflow: 'hidden'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
            <thead>
              <tr
                style={{
                  background: 'var(--bg-main, #f8fafc)',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: 12,
                  textTransform: 'uppercase'
                }}
              >
                <th style={{ padding: '14px 18px' }}>Designation Title</th>
                <th style={{ padding: '14px 18px' }}>Code</th>
                <th style={{ padding: '14px 18px' }}>Category</th>
                <th style={{ padding: '14px 18px' }}>Assigned Teachers</th>
                <th style={{ padding: '14px 18px' }}>Status</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <span>Loading designations directory...</span>
                  </td>
                </tr>
              ) : filteredDesignations.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                    <Award size={36} style={{ margin: '0 auto 12px', opacity: 0.4, display: 'block' }} />
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>No designations found</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      {searchQuery ? 'Try adjusting your search criteria.' : 'Click "Add Designation" to create your first title.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDesignations.map(item => {
                  const catStyle = getCategoryBadge(item.category);
                  const isItemActive = item.is_active !== false;

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.title}</div>
                        {item.description && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, maxWidth: 420 }}>
                            {item.description}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {item.code ? (
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: 12,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'var(--bg-main, #f1f5f9)',
                              color: 'var(--text)'
                            }}
                          >
                            {item.code}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: 11.5,
                            fontWeight: 600,
                            background: catStyle.bg,
                            color: catStyle.color,
                            border: `1px solid ${catStyle.border}`
                          }}
                        >
                          {catStyle.label}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {(() => {
                          const promotedCount = promotions.filter(
                            p => p.current_position.toLowerCase() === item.title.toLowerCase()
                          ).length;
                          return (
                            <button
                              type="button"
                              onClick={() => handleOpenFacultyModal(item)}
                              title={`Click to view faculty members and promotion history in ${item.title}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '5px 11px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                background: (item.teacher_count || 0) > 0 ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-main, #f1f5f9)',
                                color: (item.teacher_count || 0) > 0 ? '#2563eb' : 'var(--text-muted)',
                                border: (item.teacher_count || 0) > 0 ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid var(--border)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => {
                                if ((item.teacher_count || 0) > 0) {
                                  e.currentTarget.style.background = 'rgba(37, 99, 235, 0.16)';
                                  e.currentTarget.style.borderColor = '#2563eb';
                                }
                              }}
                              onMouseLeave={e => {
                                if ((item.teacher_count || 0) > 0) {
                                  e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)';
                                  e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.2)';
                                }
                              }}
                            >
                              <Users size={13} />
                              <span>{item.teacher_count || 0} Faculty</span>
                              {promotedCount > 0 && (
                                <span style={{
                                  marginLeft: 2,
                                  background: '#10b981',
                                  color: '#ffffff',
                                  fontSize: 10,
                                  padding: '1px 5px',
                                  borderRadius: 10,
                                  fontWeight: 700
                                }}>
                                  {promotedCount} promoted
                                </span>
                              )}
                            </button>
                          );
                        })()}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item)}
                          title={`Click to mark as ${isItemActive ? 'Inactive' : 'Active'}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 14,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: 'none',
                            background: isItemActive ? '#ecfdf5' : '#f1f5f9',
                            color: isItemActive ? '#059669' : '#64748b'
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: isItemActive ? '#10b981' : '#94a3b8'
                            }}
                          />
                          <span>{isItemActive ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            title="Edit Designation"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'var(--bg-card)',
                              color: 'var(--text)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12
                            }}
                          >
                            <Pencil size={13} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmItem(item)}
                            title="Delete Designation"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: '1px solid #fecaca',
                              background: '#fff5f5',
                              color: '#dc2626',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12
                            }}
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          onClick={() => !saving && setIsModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: isMaximized ? 8 : 12,
              border: '1px solid var(--border)',
              width: isMaximized ? '95vw' : '100%',
              maxWidth: isMaximized ? '95vw' : 520,
              height: isMaximized ? '90vh' : 'auto',
              maxHeight: isMaximized ? '90vh' : '92vh',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-main, #f8fafc)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Award size={20} color="var(--sidebar-accent, #2563eb)" />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                  {editingItem ? 'Edit Staff Designation' : 'Create New Staff Designation'}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="modal-toggle-btn"
                  onClick={() => setIsMaximized(prev => !prev)}
                  title={isMaximized ? "Restore standard size" : "Maximize window"}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  title="Close"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 6,
                    borderRadius: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={handleSaveDesignation}
              style={{
                padding: isMaximized ? '28px 36px' : 24,
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Title */}
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Designation <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Teacher, TGT Mathematics, Head of Department"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      marginTop: 6,
                      boxSizing: 'border-box',
                      fontSize: 13.5
                    }}
                  />
                </label>

                {/* Code & Category */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    Short Code (Optional)
                    <input
                      type="text"
                      placeholder="e.g. SR-TCH, TGT-MATH"
                      value={formCode}
                      onChange={e => setFormCode(e.target.value.toUpperCase())}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        marginTop: 6,
                        boxSizing: 'border-box',
                        fontSize: 13.5
                      }}
                    />
                  </label>

                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    Category
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        marginTop: 6,
                        boxSizing: 'border-box',
                        fontSize: 13.5
                      }}
                    >
                      <option value="Teaching">Teaching Faculty</option>
                      <option value="Support">Support Staff</option>
                    </select>
                  </label>
                </div>

                {/* Description */}
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Description (Optional)
                  <textarea
                    rows={3}
                    placeholder="Brief description of responsibilities or departmental scope..."
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      marginTop: 6,
                      boxSizing: 'border-box',
                      fontSize: 13.5,
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </label>

                {/* Active Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={e => setFormIsActive(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--sidebar-accent, #2563eb)' }}
                  />
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>
                    Active (shows in Add Teacher dropdown)
                  </span>
                </label>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: '1px solid var(--border)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text)',
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--sidebar-accent, #2563eb)',
                    color: '#ffffff',
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingItem ? 'Save Changes' : 'Create Designation'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          onClick={() => !deleting && setDeleteConfirmItem(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 12,
              border: '1px solid var(--border)',
              width: '100%',
              maxWidth: 440,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626'
                }}
              >
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  Confirm Deletion
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5, margin: '0 0 16px' }}>
              Are you sure you want to delete designation <b>"{deleteConfirmItem.title}"</b>?
            </p>

            {(deleteConfirmItem.teacher_count || 0) > 0 && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  color: '#b45309',
                  fontSize: 12.5,
                  marginBottom: 16
                }}
              >
                ⚠️ <b>Notice:</b> Currently {deleteConfirmItem.teacher_count} teacher(s) have this designation. Deleting it will remove it from the dropdown options for future updates.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {deleting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Designation</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ═══ 1. PROMOTE TEACHER MODAL ═══ */}
      {isPromoteModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setIsPromoteModalOpen(false);
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 520,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-main, #f8fafc)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'rgba(16, 185, 129, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981'
                  }}
                >
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                    Promote Faculty Member
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    Update position and track promotional history
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPromoteModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmPromotion} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Select Teacher */}
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Select Faculty Member <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <select
                    value={promoteTeacherId}
                    onChange={e => handleSelectTeacherForPromotion(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      marginTop: 6,
                      fontSize: 13.5,
                      background: 'var(--bg-card)',
                      color: 'var(--text)'
                    }}
                  >
                    {teachersList.length === 0 ? (
                      <option value="">No faculty members found</option>
                    ) : (
                      teachersList.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} — Current: {t.designation || 'PRT'} ({t.employee_id || t.savior_no || 'No ID'})
                        </option>
                      ))
                    )}
                  </select>
                </label>

                {/* Transition Card: Previous -> New */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px',
                    borderRadius: 8,
                    background: 'var(--bg-main, #f8fafc)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {/* Previous Position Dropdown */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Previous Position
                    </div>
                    <select
                      value={promoteCurrentPosition}
                      onChange={e => handleSelectPreviousPosition(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#991b1b',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                      title="Current / Previous Designation"
                    >
                      {allAvailableDesignationTitles.map(title => (
                        <option key={title} value={title}>
                          {title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Arrow */}
                  <div style={{ display: 'flex', justifyContent: 'center', color: '#10b981', paddingTop: 14 }}>
                    <ArrowRight size={20} />
                  </div>

                  {/* New Position Dropdown (Excludes Previous Position) */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Promoted To <span style={{ color: '#ef4444' }}>*</span>
                    </div>
                    {(() => {
                      const availableDesigs = allAvailableDesignationTitles.filter(
                        title => title.trim().toLowerCase() !== (promoteCurrentPosition || '').trim().toLowerCase()
                      );

                      if (availableDesigs.length === 0) {
                        return (
                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: 6,
                              border: '1px dashed #fca5a5',
                              background: '#fff1f2',
                              color: '#b91c1c',
                              fontSize: 12,
                              fontWeight: 600
                            }}
                          >
                            No other designation available
                          </div>
                        );
                      }

                      return (
                        <select
                          value={promoteNewPosition}
                          onChange={e => setPromoteNewPosition(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid #a7f3d0',
                            background: '#ecfdf5',
                            color: '#065f46',
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer'
                          }}
                        >
                          {availableDesigs.map(title => (
                            <option key={title} value={title}>
                              {title}
                            </option>
                          ))}
                        </select>
                      );
                    })()}
                  </div>
                </div>

                {/* Warning if positions match */}
                {promoteCurrentPosition && promoteNewPosition && promoteCurrentPosition.trim().toLowerCase() === promoteNewPosition.trim().toLowerCase() && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      color: '#dc2626',
                      fontSize: 12,
                      fontWeight: 500,
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      padding: '8px 12px',
                      borderRadius: 6
                    }}
                  >
                    <AlertCircle size={15} />
                    <span>Previous position and Promoted To position cannot be the same ({promoteCurrentPosition}).</span>
                  </div>
                )}

                {/* Effective Promotion Date */}
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Effective Promotion Date <span style={{ color: '#ef4444' }}>*</span>
                    </span>
                    <input
                      type="date"
                      min="1900-01-01"
                      max="2099-12-31"
                      value={promoteDate}
                      onChange={e => {
                        let val = e.target.value;
                        if (!val) {
                          setPromoteDate('');
                          return;
                        }
                        const parts = val.split('-');
                        // Ensure year is strictly at most 4 digits (prevent 5-digit year)
                        if (parts[0] && parts[0].length > 4) {
                          parts[0] = parts[0].slice(0, 4);
                          val = parts.join('-');
                        }
                        setPromoteDate(val);
                      }}
                      onBlur={() => {
                        if (promoteDate) {
                          const parts = promoteDate.split('-');
                          if (parts[0] && parts[0].length > 4) {
                            parts[0] = parts[0].slice(0, 4);
                            setPromoteDate(parts.join('-'));
                          }
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        marginTop: 6,
                        fontSize: 13.5,
                        background: 'var(--bg-card)',
                        color: 'var(--text)',
                        boxSizing: 'border-box'
                      }}
                    />
                  </label>
                </div>

                {/* Remarks / Justification */}
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Remarks / Promotion Notes (Optional)
                  <textarea
                    rows={2}
                    placeholder="e.g. Promoted from NTT to TGT based on performance review..."
                    value={promoteNotes}
                    onChange={e => setPromoteNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      marginTop: 6,
                      fontSize: 13.5,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      background: 'var(--bg-card)',
                      color: 'var(--text)'
                    }}
                  />
                </label>
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setIsPromoteModalOpen(false)}
                  disabled={promoting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    promoting ||
                    !promoteTeacherId ||
                    !promoteNewPosition ||
                    promoteCurrentPosition.trim().toLowerCase() === promoteNewPosition.trim().toLowerCase() ||
                    !promoteDate ||
                    (promoteDate.split('-')[0]?.length !== 4) ||
                    !/^\d{4}$/.test(promoteDate.split('-')[0] || '') ||
                    Number(promoteDate.split('-')[0]) < 1900 ||
                    Number(promoteDate.split('-')[0]) > 2099
                  }
                  style={{
                    padding: '8px 20px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#10b981',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: (
                      promoting ||
                      !promoteTeacherId ||
                      !promoteNewPosition ||
                      promoteCurrentPosition.trim().toLowerCase() === promoteNewPosition.trim().toLowerCase() ||
                      !promoteDate ||
                      (promoteDate.split('-')[0]?.length !== 4) ||
                      !/^\d{4}$/.test(promoteDate.split('-')[0] || '') ||
                      Number(promoteDate.split('-')[0]) < 1900 ||
                      Number(promoteDate.split('-')[0]) > 2099
                    ) ? 'not-allowed' : 'pointer',
                    opacity: (
                      !promoteTeacherId ||
                      !promoteNewPosition ||
                      promoteCurrentPosition.trim().toLowerCase() === promoteNewPosition.trim().toLowerCase() ||
                      !promoteDate ||
                      (promoteDate.split('-')[0]?.length !== 4) ||
                      !/^\d{4}$/.test(promoteDate.split('-')[0] || '')
                    ) ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  {promoting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Promoting...</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp size={14} />
                      <span>Confirm Promotion</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ 2. FACULTY IN DESIGNATION MODAL ═══ */}
      {isFacultyModalOpen && selectedDesignationFaculty && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1040,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setIsFacultyModalOpen(false);
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 780,
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-main, #f8fafc)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'rgba(37, 99, 235, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb'
                  }}
                >
                  <Users size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                    Faculty Assigned: {selectedDesignationFaculty.title}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    Showing faculty members and promotion history. Click teacher name for position timeline.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(() => {
                  const facultyInDesig = teachersList.filter(
                    t => (t.designation || 'Teacher').toLowerCase() === selectedDesignationFaculty.title.toLowerCase()
                  );
                  return (
                    <button
                      type="button"
                      onClick={() => handleExportDesignationFaculty(selectedDesignationFaculty, facultyInDesig)}
                      disabled={facultyInDesig.length === 0}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid #0284c7',
                        background: '#0284c7',
                        color: '#ffffff',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: facultyInDesig.length === 0 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Download size={13} />
                      <span>Export Excel ({facultyInDesig.length})</span>
                    </button>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => setIsFacultyModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body / Table */}
            <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
              {(() => {
                const facultyInDesig = teachersList.filter(
                  t => (t.designation || 'Teacher').toLowerCase() === selectedDesignationFaculty.title.toLowerCase()
                );

                if (facultyInDesig.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                      <Users size={36} style={{ opacity: 0.4, margin: '0 auto 10px' }} />
                      <div style={{ fontWeight: 600, fontSize: 14 }}>No Faculty Assigned Yet</div>
                      <p style={{ fontSize: 12.5, margin: '4px 0 16px' }}>
                        No teachers currently have the designation "{selectedDesignationFaculty.title}".
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFacultyModalOpen(false);
                          handleOpenPromoteModal();
                        }}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#10b981',
                          color: '#ffffff',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Promote / Assign Teacher to {selectedDesignationFaculty.title}
                      </button>
                    </div>
                  );
                }

                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-main, #f8fafc)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Employee ID</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Teacher Name (Click for Details)</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Contact / Email</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Promotion Status</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facultyInDesig.map(t => {
                        const promo = promotions.find(
                          p => p.teacher_id === t.id || p.teacher_name.toLowerCase() === (t.name || '').toLowerCase()
                        );
                        return (
                          <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '12px' }}>
                              <code style={{ fontSize: 12, fontWeight: 700 }}>
                                {t.employee_id || t.savior_no || '—'}
                              </code>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <button
                                type="button"
                                onClick={() => handleViewTeacherPromotionDetails(t)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  color: '#2563eb',
                                  fontWeight: 600,
                                  fontSize: 13.5,
                                  textAlign: 'left',
                                  textDecoration: 'underline'
                                }}
                                title="Click to view previous position, current position, and promotion date"
                              >
                                {t.name}
                              </button>
                            </td>
                            <td style={{ padding: '12px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                              <div>{t.email || '—'}</div>
                              {t.mobile && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.mobile}</div>}
                            </td>
                            <td style={{ padding: '12px' }}>
                              {promo ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewTeacherPromotionDetails(t)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '3px 8px',
                                    borderRadius: 12,
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    background: '#ecfdf5',
                                    color: '#065f46',
                                    border: '1px solid #a7f3d0',
                                    cursor: 'pointer'
                                  }}
                                  title="Click to view position timeline"
                                >
                                  <span>🎖️ Promoted from <b>{promo.previous_position}</b></span>
                                  <span style={{ fontSize: 10, opacity: 0.75 }}>({formatDisplayDate(promo.promotion_date)})</span>
                                </button>
                              ) : (
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                  Appointed Directly
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsFacultyModalOpen(false);
                                  handleOpenPromoteModal(t);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '4px 9px',
                                  borderRadius: 5,
                                  border: '1px solid #10b981',
                                  background: 'rgba(16, 185, 129, 0.08)',
                                  color: '#059669',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                <TrendingUp size={12} />
                                <span>Promote</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 3. TEACHER PROMOTION DETAILS POPUP (SHOWS PREVIOUS, CURRENT, DATE) ═══ */}
      {selectedTeacherPromo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1060,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setSelectedTeacherPromo(null);
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 500,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(16,185,129,0.06))'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #2563eb, #10b981)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 16
                  }}
                >
                  {selectedTeacherPromo.teacher_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                    {selectedTeacherPromo.teacher_name}
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Employee ID: <b>{selectedTeacherPromo.employee_id || '—'}</b> {selectedTeacherPromo.email !== '—' && `· ${selectedTeacherPromo.email}`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTeacherPromo(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Position Transition Card */}
            <div style={{ padding: '20px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center',
                  gap: 12,
                  padding: '16px',
                  borderRadius: 10,
                  background: 'var(--bg-main, #f8fafc)',
                  border: '1px solid var(--border)',
                  marginBottom: 16
                }}
              >
                {/* Previous Position */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Previous Position
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      fontWeight: 800,
                      fontSize: 15
                    }}
                  >
                    {selectedTeacherPromo.previous_position}
                  </div>
                </div>

                {/* Arrow */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: '#10b981' }}>
                  <TrendingUp size={20} />
                  <ArrowRight size={20} />
                </div>

                {/* Current Position */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Current Position
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      color: '#065f46',
                      fontWeight: 800,
                      fontSize: 15,
                      boxShadow: '0 1px 3px rgba(16,185,129,0.15)'
                    }}
                  >
                    {selectedTeacherPromo.current_position}
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Fields */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: '14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  fontSize: 13
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} style={{ color: '#2563eb' }} />
                    <span>Promotion Date:</span>
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                    {formatDisplayDate(selectedTeacherPromo.promotion_date)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <UserCheck size={14} style={{ color: '#10b981' }} />
                    <span>Promoted By:</span>
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {selectedTeacherPromo.promoted_by || 'Admin'}
                  </span>
                </div>

                {selectedTeacherPromo.notes && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Remarks / Notes:
                    </div>
                    <div style={{ marginTop: 4, color: 'var(--text)', fontStyle: 'italic', fontSize: 12.5 }}>
                      "{selectedTeacherPromo.notes}"
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setSelectedTeacherPromo(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleExportPromotions([
                      {
                        id: 'single',
                        teacher_id: '',
                        teacher_name: selectedTeacherPromo.teacher_name,
                        employee_id: selectedTeacherPromo.employee_id,
                        email: selectedTeacherPromo.email,
                        previous_position: selectedTeacherPromo.previous_position,
                        current_position: selectedTeacherPromo.current_position,
                        promotion_date: selectedTeacherPromo.promotion_date,
                        notes: selectedTeacherPromo.notes,
                        promoted_by: selectedTeacherPromo.promoted_by
                      }
                    ], `Promotion_${selectedTeacherPromo.teacher_name.replace(/\s+/g, '_')}`);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)'
                  }}
                >
                  <Download size={14} />
                  <span>Export to Excel</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 4. ALL PROMOTIONS HISTORY DIRECTORY MODAL ═══ */}
      {isPromotionsHistoryModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1040,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setIsPromotionsHistoryModalOpen(false);
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 820,
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-main, #f8fafc)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'rgba(124, 58, 237, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#7c3aed'
                  }}
                >
                  <History size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                    Faculty Promotion History
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    Total {promotions.length} promotional event(s) logged. Click teacher name for timeline.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleExportPromotions(promotions, 'All_Teacher_Promotions')}
                  disabled={promotions.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid #0284c7',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: promotions.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Download size={13} />
                  <span>Export Excel ({promotions.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPromotionsHistoryModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter Search */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  width: '100%',
                  maxWidth: 360
                }}
              >
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search promoted teacher name or position..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%' }}
                />
                {historySearch && (
                  <X size={13} style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => setHistorySearch('')} />
                )}
              </div>
            </div>

            {/* Modal Body / Table */}
            <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
              {(() => {
                const filteredPromos = promotions.filter(p => {
                  if (!historySearch.trim()) return true;
                  const q = historySearch.toLowerCase();
                  return (
                    p.teacher_name.toLowerCase().includes(q) ||
                    p.previous_position.toLowerCase().includes(q) ||
                    p.current_position.toLowerCase().includes(q) ||
                    (p.employee_id && p.employee_id.toLowerCase().includes(q))
                  );
                });

                if (filteredPromos.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                      <History size={36} style={{ opacity: 0.4, margin: '0 auto 10px' }} />
                      <div style={{ fontWeight: 600, fontSize: 14 }}>No Promotion Records Found</div>
                      <p style={{ fontSize: 12.5, margin: '4px 0 16px' }}>
                        Promote teachers from the "Promote Teacher" button to begin tracking career progression.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPromotionsHistoryModalOpen(false);
                          handleOpenPromoteModal();
                        }}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#10b981',
                          color: '#ffffff',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Promote a Teacher Now
                      </button>
                    </div>
                  );
                }

                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-main, #f8fafc)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Sl</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Teacher Name (Click for Details)</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Employee ID</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Previous Position</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Current Position</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Promotion Date</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Promoted By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPromos.map((p, idx) => (
                        <tr key={p.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                          <td style={{ padding: '12px' }}>
                            <button
                              type="button"
                              onClick={() => handleViewPromoDetail(p)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                color: '#2563eb',
                                fontWeight: 600,
                                fontSize: 13.5,
                                textAlign: 'left',
                                textDecoration: 'underline'
                              }}
                              title="Click to view full previous/current position and date details"
                            >
                              {p.teacher_name}
                            </button>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <code style={{ fontSize: 12 }}>{p.employee_id || '—'}</code>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: '#fef2f2',
                                color: '#991b1b',
                                border: '1px solid #fecaca',
                                fontWeight: 700,
                                fontSize: 11.5
                              }}
                            >
                              {p.previous_position}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: '#ecfdf5',
                                color: '#065f46',
                                border: '1px solid #a7f3d0',
                                fontWeight: 700,
                                fontSize: 11.5
                              }}
                            >
                              {p.current_position}
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text)' }}>
                            {formatDisplayDate(p.promotion_date)}
                          </td>
                          <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                            {p.promoted_by || 'Admin'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
