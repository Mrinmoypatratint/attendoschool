import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  Check,
  X,
  User,
  GraduationCap,
  AlertTriangle,
  FileText,
  Eye,
  FileSpreadsheet,
  Paperclip,
  Image as ImageIcon,
  Download,
  ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../api';
import { AutoExpandingTextarea } from '../../components/AutoExpandingTextarea';
import { PersonProfileLink } from '../../components/PersonProfileLink';

interface TeacherLeave {
  id: string;
  school_id: string;
  applicant_type: 'TEACHER';
  applicant_id: string;
  applicant_name: string;
  teacher_email?: string;
  identifier?: string;
  detail?: string;
  photo_url?: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  document_url?: string;
  document_name?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string;
  reviewer_name?: string;
  review_notes?: string;
  rejection_reason?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at?: string;
}

export default function TeacherLeaveApprove() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [leaves, setLeaves] = useState<TeacherLeave[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportMonth, setReportMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [configuredPolicies, setConfiguredPolicies] = useState<any[]>([]);
  const [exporting, setExporting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedTeacherKeys, setSelectedTeacherKeys] = useState<Set<string>>(new Set());

  const getTeacherKey = (l: any) => {
    return String(l.applicant_id || l.teacher_email || l.applicant_name || '').toLowerCase().trim();
  };

  const toggleTeacherSelection = (key: string) => {
    if (!key) return;
    setSelectedTeacherKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Detail Modal State
  const [viewingLeave, setViewingLeave] = useState<TeacherLeave | null>(null);
  const [viewingDoc, setViewingDoc] = useState<{ url: string; name: string } | null>(null);

  // Approve Modal State
  const [approvingLeave, setApprovingLeave] = useState<TeacherLeave | null>(null);
  const [approveNotes, setApproveNotes] = useState<string>('Approved by School Administration');

  // Reject Modal State
  const [rejectingLeave, setRejectingLeave] = useState<TeacherLeave | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const openDocumentInNewTab = (dataUrl: string) => {
    try {
      if (dataUrl.startsWith('data:')) {
        const parts = dataUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        return;
      }
      window.open(dataUrl, '_blank');
    } catch {
      window.open(dataUrl, '_blank');
    }
  };

  const downloadDocument = (dataUrl: string, filename: string = 'document') => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reviews/teacher-leaves');
      if (res.data?.success) {
        setLeaves(res.data.data || []);
      }

      // Also silently load all faculty members for institution-wide monthly reporting
      try {
        const teachersRes = await api.get('/teachers');
        if (Array.isArray(teachersRes.data)) {
          setTeachersList(teachersRes.data);
        }
      } catch (_tErr) {
        // Non-blocking fallback
      }

      // Load school-admin dynamic leave policies for the filter dropdown
      try {
        const polRes = await api.get('/leave-policies');
        const polList = polRes.data?.data || polRes.data || [];
        if (Array.isArray(polList)) {
          setConfiguredPolicies(polList);
        }
      } catch (_pErr) {
        // Non-blocking fallback
      }
    } catch (err: any) {
      console.error('Failed to load faculty leave requests:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to load teacher leave applications.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const handleApprove = async () => {
    if (!approvingLeave) return;
    try {
      setActionLoading(approvingLeave.id);
      const res = await api.put(`/reviews/teacher-leaves/${approvingLeave.id}/approve`, {
        notes: approveNotes.trim() || 'Approved by School Administration'
      });
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Leave request for ${approvingLeave.applicant_name} has been approved.`
        });
        setApprovingLeave(null);
        if (viewingLeave?.id === approvingLeave.id) {
          setViewingLeave((prev) => (prev ? { ...prev, status: 'APPROVED', review_notes: approveNotes } : null));
        }
        await loadLeaves();
        window.dispatchEvent(new CustomEvent('reviews-updated'));
      }
    } catch (err: any) {
      console.error('Failed to approve teacher leave:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to approve leave request.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingLeave) return;
    try {
      setActionLoading(rejectingLeave.id);
      const notes = rejectReason.trim() || 'Declined by School Administration';
      const res = await api.put(`/reviews/teacher-leaves/${rejectingLeave.id}/reject`, {
        reason: notes,
        notes
      });
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Leave request for ${rejectingLeave.applicant_name} has been rejected.`
        });
        setRejectingLeave(null);
        setRejectReason('');
        if (viewingLeave?.id === rejectingLeave.id) {
          setViewingLeave((prev) => (prev ? { ...prev, status: 'REJECTED', review_notes: notes } : null));
        }
        await loadLeaves();
        window.dispatchEvent(new CustomEvent('reviews-updated'));
      }
    } catch (err: any) {
      console.error('Failed to reject teacher leave:', err);
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to reject leave request.' });
    } finally {
      setActionLoading(null);
    }
  };

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  // Helper to calculate exact days of a leave that fall within a given YYYY-MM month
  const computeLeaveDaysInMonth = (l: { start_date: string; end_date?: string }, yearMonthStr: string) => {
    if (!l.start_date || !yearMonthStr || yearMonthStr === 'ALL') return 0;
    const endDateStr = l.end_date || l.start_date;
    const [y, m] = yearMonthStr.split('-').map(Number);
    if (!y || !m) return 0;
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
    const s = new Date(l.start_date);
    const e = new Date(endDateStr);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    if (e < monthStart || s > monthEnd) return 0;

    const overlapStart = s < monthStart ? monthStart : s;
    const overlapEnd = e > monthEnd ? monthEnd : e;
    const diff = overlapEnd.getTime() - overlapStart.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const formatMonthDisplay = (ym: string) => {
    if (!ym || ym === 'ALL') return 'All Months';
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m) return ym;
    const d = new Date(y, m - 1, 1);
    return isNaN(d.getTime()) ? ym : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const availableMonths = useMemo(() => {
    const yearsSet = new Set<number>();
    const now = new Date();
    yearsSet.add(now.getFullYear());

    // Extract any year mentioned in academic session name (e.g. "2026-2027", "2027-28", "2028-2029")
    const sessionStr = localStorage.getItem('attendo_academic_session') || localStorage.getItem('attendo_active_academic_year') || '';
    const sessionMatches = sessionStr.match(/\b(20\d{2})\b/g);
    if (sessionMatches) {
      sessionMatches.forEach((y) => {
        const parsed = parseInt(y, 10);
        if (parsed && !isNaN(parsed)) yearsSet.add(parsed);
      });
    }
    const shortYearMatch = sessionStr.match(/20(\d{2})[-/](\d{2})/);
    if (shortYearMatch) {
      yearsSet.add(parseInt(`20${shortYearMatch[2]}`, 10));
    }

    // Include years from existing leave records
    leaves.forEach((l) => {
      if (l.start_date) {
        const y = parseInt(l.start_date.slice(0, 4), 10);
        if (y && !isNaN(y)) yearsSet.add(y);
      }
      if (l.end_date) {
        const y = parseInt(l.end_date.slice(0, 4), 10);
        if (y && !isNaN(y)) yearsSet.add(y);
      }
      if (l.created_at) {
        const y = parseInt(l.created_at.slice(0, 4), 10);
        if (y && !isNaN(y)) yearsSet.add(y);
      }
    });

    const months: string[] = [];
    const sortedYears = Array.from(yearsSet).sort((a, b) => a - b);
    sortedYears.forEach((year) => {
      for (let m = 1; m <= 12; m++) {
        months.push(`${year}-${String(m).padStart(2, '0')}`);
      }
    });

    return months;
  }, [leaves]);

  // Real-time month-filtered leaves for KPI cards and tab badges
  const monthScopedLeaves = useMemo(() => {
    if (!monthFilter || monthFilter === 'ALL') {
      return leaves;
    }
    return leaves.filter((l) => computeLeaveDaysInMonth(l, monthFilter) > 0);
  }, [leaves, monthFilter]);

  // Dynamic real-time counts calculated directly from real-time data
  const dynamicCounts = useMemo(() => {
    const pending = monthScopedLeaves.filter((l) => l.status === 'PENDING').length;
    const approved = monthScopedLeaves.filter((l) => l.status === 'APPROVED').length;
    const rejected = monthScopedLeaves.filter((l) => l.status === 'REJECTED').length;
    const all = monthScopedLeaves.length;
    return { all, pending, approved, rejected };
  }, [monthScopedLeaves]);

  const formatDate = (val: string) => {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const dynamicFilterLeaveTypes = useMemo(() => {
    const list = configuredPolicies
      .filter((p: any) => p.is_active !== false)
      .map((p: any) => {
        const val = (p.code || p.name).toUpperCase().replace(/\s+/g, '_');
        const cycle = p.accrual_cycle === 'HALF_YEARLY' ? 'Half-Year' : 'Year';
        const label = p.code ? `${p.name} (${p.code})` : p.name;
        return {
          value: val,
          code: (p.code || '').toUpperCase(),
          name: p.name,
          label: `${label} — ${p.days_count} Days / ${cycle}`,
          color: p.accrual_cycle === 'YEARLY' ? '#2563EB' : '#7C3AED',
          bg: p.accrual_cycle === 'YEARLY' ? '#EFF6FF' : '#F5F3FF',
          border: p.accrual_cycle === 'YEARLY' ? '#BFDBFE' : '#DDD6FE'
        };
      });
    return [{ value: 'ALL', label: 'All Leave Types' }, ...list];
  }, [configuredPolicies]);

  const normalizeTypeStr = (str: string) => {
    return String(str || '')
      .toUpperCase()
      .replace(/[_\s-]+/g, '')
      .replace(/LEAVE$/, '');
  };

  const matchesPolicy = (rawType: string, policy: any) => {
    if (!rawType || !policy) return false;
    const rawUpper = rawType.toUpperCase().trim();
    const pCodeUpper = (policy.code || '').toUpperCase().trim();
    const pNameUpper = (policy.name || '').toUpperCase().trim();

    if (pCodeUpper && rawUpper === pCodeUpper) return true;
    if (pNameUpper && rawUpper === pNameUpper) return true;

    const rawNorm = normalizeTypeStr(rawType);
    const pNameNorm = normalizeTypeStr(policy.name);
    const pCodeNorm = normalizeTypeStr(policy.code || '');

    if (pCodeNorm && rawNorm === pCodeNorm) return true;
    if (pNameNorm && rawNorm === pNameNorm) return true;

    // Common standard abbreviations & names
    if ((rawNorm === 'CASUAL' || rawNorm === 'CL') && (pCodeNorm === 'CL' || pNameNorm.includes('CASUAL'))) return true;
    if ((rawNorm === 'SICK' || rawNorm === 'SL') && (pCodeNorm === 'SL' || pNameNorm.includes('SICK'))) return true;
    if ((rawNorm === 'EARNED' || rawNorm === 'EL') && (pCodeNorm === 'EL' || pNameNorm.includes('EARNED'))) return true;
    if ((rawNorm === 'HALFPAY' || rawNorm === 'HPL') && (pCodeNorm === 'HPL' || pNameNorm.includes('HALFPAY'))) return true;
    if ((rawNorm === 'MATERNITY' || rawNorm === 'ML') && (pCodeNorm === 'ML' || pNameNorm.includes('MATERNITY'))) return true;

    if (rawNorm && pNameNorm && (pNameNorm.startsWith(rawNorm) || rawNorm.startsWith(pNameNorm))) {
      return true;
    }

    return false;
  };

  const getLeaveTypeStyle = (type: string) => {
    const norm = String(type || '').trim().toUpperCase();
    if (configuredPolicies.length > 0) {
      const foundPolicy = configuredPolicies.find((p: any) => matchesPolicy(norm, p));
      if (foundPolicy) {
        const isYearly = foundPolicy.accrual_cycle === 'YEARLY';
        return {
          value: norm,
          label: foundPolicy.code ? `${foundPolicy.name} (${foundPolicy.code})` : foundPolicy.name,
          color: isYearly ? '#2563EB' : '#7C3AED',
          bg: isYearly ? '#EFF6FF' : '#F5F3FF',
          border: isYearly ? '#BFDBFE' : '#DDD6FE'
        };
      }
    }
    const cleanLabel = norm.toUpperCase().endsWith('LEAVE')
      ? norm.charAt(0) + norm.slice(1).toLowerCase()
      : norm;
    return {
      value: norm || 'LEAVE',
      label: cleanLabel || 'Leave',
      color: '#4B5563',
      bg: '#F3F4F6',
      border: '#E5E7EB'
    };
  };

  // Extract all unique leave types dynamically from configuredPolicies + any existing leaves (0 hardcoding)
  const allDynamicLeaveTypes = useMemo(() => {
    const map = new Map<string, { key: string; name: string; code?: string; label: string; allowedDays: number; cycle: string }>();

    // 1. From School Admin Configured Policies
    configuredPolicies.forEach((p: any) => {
      const key = (p.code || p.name).toUpperCase().trim();
      if (key && !map.has(key)) {
        map.set(key, {
          key,
          name: p.name,
          code: p.code ? p.code.toUpperCase() : undefined,
          label: p.code ? `${p.name} (${p.code.toUpperCase()})` : p.name,
          allowedDays: Number(p.days_count) || 0,
          cycle: p.accrual_cycle || 'YEARLY'
        });
      }
    });

    // 2. From actual leave applications (in case leaves exist with types not yet in policy table)
    leaves.forEach((l) => {
      const raw = String(l.leave_type || '').toUpperCase().trim();
      if (!raw) return;

      const matchesExisting = Array.from(map.values()).some((pol) => matchesPolicy(raw, pol));
      if (!matchesExisting && !map.has(raw)) {
        map.set(raw, {
          key: raw,
          name: raw,
          label: raw,
          allowedDays: 0,
          cycle: 'YEARLY'
        });
      }
    });

    return Array.from(map.values());
  }, [configuredPolicies, leaves]);

  const totalAllowedQuota = useMemo(() => {
    return allDynamicLeaveTypes.reduce((acc, t) => acc + (t.allowedDays || 0), 0);
  }, [allDynamicLeaveTypes]);

  // Compute approved and applied leave counts & breakdown dynamically per faculty member
  const getTeacherLeaveStats = (teacherQuery: { id?: string; email?: string; name?: string }, scopedMonth?: string) => {
    const targetMonth = scopedMonth !== undefined ? scopedMonth : monthFilter;
    const isMonthScoped = targetMonth && targetMonth !== 'ALL';

    const teacherLeaves = leaves.filter((l) => {
      const idMatch = teacherQuery.id && l.applicant_id && String(l.applicant_id).toLowerCase() === String(teacherQuery.id).toLowerCase();
      const emailMatch = teacherQuery.email && l.teacher_email && l.teacher_email.toLowerCase() === teacherQuery.email.toLowerCase();
      const nameMatch = teacherQuery.name && l.applicant_name && l.applicant_name.toLowerCase() === teacherQuery.name.toLowerCase();
      return idMatch || emailMatch || nameMatch;
    });

    // Dynamic breakdown map
    const byType: Record<string, {
      days: number;           // Approved days in scope
      approvedDays: number;   // Approved days in scope (alias)
      count: number;          // Approved count in scope
      totalDays: number;      // Total approved days
      appliedDays: number;    // Total applied days for this type in scope
      appliedCount: number;   // Total applications for this type
      pendingDays: number;    // Pending days for this type
      pendingCount: number;   // Pending count for this type
      rejectedDays: number;   // Rejected days for this type
      rejectedCount: number;  // Rejected count for this type
    }> = {};

    allDynamicLeaveTypes.forEach((t) => {
      byType[t.key] = {
        days: 0,
        approvedDays: 0,
        count: 0,
        totalDays: 0,
        appliedDays: 0,
        appliedCount: 0,
        pendingDays: 0,
        pendingCount: 0,
        rejectedDays: 0,
        rejectedCount: 0
      };
    });

    let totalApprovedDays = 0;
    let totalApprovedCount = 0;
    let totalAppliedDays = 0;
    let totalPendingCount = 0;
    let totalRejectedCount = 0;

    teacherLeaves.forEach((l) => {
      const lType = String(l.leave_type || '').toUpperCase().trim();
      const matchedPolicy = allDynamicLeaveTypes.find((t) => matchesPolicy(lType, t));
      const matchedKey = matchedPolicy ? matchedPolicy.key : lType;

      if (!byType[matchedKey]) {
        byType[matchedKey] = {
          days: 0,
          approvedDays: 0,
          count: 0,
          totalDays: 0,
          appliedDays: 0,
          appliedCount: 0,
          pendingDays: 0,
          pendingCount: 0,
          rejectedDays: 0,
          rejectedCount: 0
        };
      }

      const allDays = calculateDays(l.start_date, l.end_date);
      const mDays = isMonthScoped ? computeLeaveDaysInMonth(l, targetMonth) : allDays;

      // Track applied days & count
      if (!isMonthScoped || mDays > 0) {
        const daysToAdd = isMonthScoped ? mDays : allDays;
        byType[matchedKey].appliedDays += daysToAdd;
        byType[matchedKey].appliedCount += 1;
        totalAppliedDays += daysToAdd;
      }

      if (l.status === 'APPROVED') {
        if (mDays > 0) {
          byType[matchedKey].days += mDays;
          byType[matchedKey].approvedDays += mDays;
          byType[matchedKey].count += 1;
          totalApprovedDays += mDays;
          totalApprovedCount += 1;
        }
        byType[matchedKey].totalDays += allDays;
      } else if (l.status === 'PENDING') {
        if (!isMonthScoped || mDays > 0) {
          byType[matchedKey].pendingDays += (isMonthScoped ? mDays : allDays);
          byType[matchedKey].pendingCount += 1;
          totalPendingCount += 1;
        }
      } else if (l.status === 'REJECTED') {
        if (!isMonthScoped || mDays > 0) {
          byType[matchedKey].rejectedDays += (isMonthScoped ? mDays : allDays);
          byType[matchedKey].rejectedCount += 1;
          totalRejectedCount += 1;
        }
      }
    });

    return {
      byType,
      totalApprovedDays,
      totalApprovedCount,
      totalAppliedDays,
      totalAllowedQuota,
      pendingCount: totalPendingCount,
      rejectedCount: totalRejectedCount,
      totalApplications: teacherLeaves.length,
      teacherLeaves
    };
  };

  // Export Monthly Teacher Leave Report to Excel (.xlsx)
  // Reflects exact table data dynamically with 0 hardcoded leave categories and 1/10 quota ratios
  const exportMonthlyLeaveReport = (targetMonth?: string) => {
    try {
      setExporting(true);
      const ym = (monthFilter !== 'ALL' ? monthFilter : (targetMonth || reportMonth)) || 'ALL';
      const isAllMonths = ym === 'ALL' || !ym;

      let monthName = 'All Months';
      if (!isAllMonths) {
        const [yearStr, monthStr] = ym.split('-');
        const year = parseInt(yearStr, 10) || new Date().getFullYear();
        const monthNum = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
        const monthDate = new Date(year, monthNum - 1, 1);
        monthName = isNaN(monthDate.getTime())
          ? ym
          : monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }

      // Candidate leaves for export based on the selected month
      const monthLeaves = isAllMonths
        ? leaves
        : leaves.filter((l) => computeLeaveDaysInMonth(l, ym) > 0);

      let targetLeaves = (activeTab !== 'ALL' && monthLeaves.some((l) => l.status === activeTab))
        ? monthLeaves.filter((l) => l.status === activeTab)
        : monthLeaves;

      // Filter by selected teachers if selection boxes are checked
      if (selectedTeacherKeys.size > 0) {
        targetLeaves = targetLeaves.filter((l) => {
          const k = String(l.applicant_id || l.teacher_email || l.applicant_name).toLowerCase().trim();
          return selectedTeacherKeys.has(k);
        });
      }

      if (targetLeaves.length === 0) {
        setFeedback({
          type: 'error',
          message: selectedTeacherKeys.size > 0
            ? `No faculty leave applications found for the ${selectedTeacherKeys.size} selected teacher(s) in ${monthName}.`
            : `No faculty leave applications found for ${monthName} to export.`
        });
        return;
      }

      // Extract unique teachers who have applied for leave in this scope (one row per teacher in Sheet 1)
      const teacherMap = new Map<string, {
        id: string;
        name: string;
        email: string;
        identifier: string;
        detail: string;
      }>();

      targetLeaves.forEach((l) => {
        const key = String(l.applicant_id || l.teacher_email || l.applicant_name).toLowerCase().trim();
        if (key && !teacherMap.has(key)) {
          const tInfo = teachersList.find((t: any) =>
            (t.id && l.applicant_id && String(t.id).toLowerCase() === String(l.applicant_id).toLowerCase()) ||
            (t.email && l.teacher_email && t.email.toLowerCase() === l.teacher_email.toLowerCase()) ||
            (t.name && l.applicant_name && t.name.toLowerCase() === l.applicant_name.toLowerCase())
          );
          teacherMap.set(key, {
            id: l.applicant_id || tInfo?.id || '',
            name: l.applicant_name || tInfo?.name || 'Faculty Member',
            email: l.teacher_email || tInfo?.email || '—',
            identifier: l.identifier || tInfo?.employee_id || tInfo?.employeeId || '—',
            detail: l.detail || tInfo?.designation || tInfo?.qualification || 'Faculty Member'
          });
        }
      });

      const facultyList = Array.from(teacherMap.values());

      // Track grand totals across all faculty members
      const grandTotalsByType: Record<string, { approvedDays: number; appliedDays: number }> = {};
      allDynamicLeaveTypes.forEach((t) => {
        grandTotalsByType[t.key] = { approvedDays: 0, appliedDays: 0 };
      });
      let grandApprovedDays = 0;
      let grandApprovedCount = 0;
      let grandAppliedDays = 0;
      let grandPendingCount = 0;
      let grandRejectedCount = 0;
      let grandTotalApps = 0;

      // Sheet 1: Each faculty member appears ONCE ONLY.
      // If a faculty member applied for 3-4 types of leave, their name appears one time only,
      // and each leave section count increments for applied types or remains the same.
      const facultyRows = facultyList.map((f, index) => {
        const stats = getTeacherLeaveStats({ id: f.id, email: f.email, name: f.name }, ym);
        const tLeaves = targetLeaves.filter((l) => {
          const idMatch = f.id && l.applicant_id && String(l.applicant_id).toLowerCase() === String(f.id).toLowerCase();
          const emailMatch = f.email && l.teacher_email && l.teacher_email.toLowerCase() === f.email.toLowerCase();
          const nameMatch = f.name && l.applicant_name && l.applicant_name.toLowerCase() === f.name.toLowerCase();
          return idMatch || emailMatch || nameMatch;
        });

        grandApprovedDays += stats.totalApprovedDays;
        grandApprovedCount += stats.totalApprovedCount;
        grandAppliedDays += stats.totalAppliedDays;
        grandPendingCount += stats.pendingCount;
        grandRejectedCount += stats.rejectedCount;
        grandTotalApps += tLeaves.length;

        const appliedTypeNames = Array.from(new Set(tLeaves.map((l) => getLeaveTypeStyle(l.leave_type).label)));

        // Itemized breakdown of all leave applications for this teacher
        const applicationsSummary = tLeaves.map((l, i) => {
          const typeStyle = getLeaveTypeStyle(l.leave_type);
          const dur = calculateDays(l.start_date, l.end_date);
          const statusText = l.status === 'APPROVED' ? 'Approved' : l.status === 'REJECTED' ? `Rejected (${l.review_notes || l.rejection_reason || 'Rejected'})` : 'Pending Review';
          return `[${i + 1}] ${typeStyle.label}: ${formatDate(l.start_date)} → ${formatDate(l.end_date)} (${dur}d) - ${statusText} - Reason: "${l.reason || '—'}"`;
        }).join('; ');

        const fRow: Record<string, any> = {
          'SL No.': index + 1,
          'Teacher / Faculty Member': f.name,
          'Email Address': f.email || '—',
          'Employee ID': f.identifier || '—',
          'Designation / Department': f.detail || 'Faculty Member',
          'Report Month': monthName,
          'Total Approved Leaves': totalAllowedQuota > 0 ? `${stats.totalApprovedDays}/${totalAllowedQuota}` : `${stats.totalApprovedDays} Days`,
          'Total Approved Count': stats.totalApprovedCount,
          'Total Applied Days': `${stats.totalAppliedDays} Days`,
          'Total Applications': tLeaves.length
        };

        // LEAVE SECTION (BY TYPE) - Count increments if applied/approved, remains same if not applied
        allDynamicLeaveTypes.forEach((t) => {
          const tStat = stats.byType[t.key];
          const appDays = tStat?.approvedDays || 0;
          const reqDays = tStat?.appliedDays || 0;

          grandTotalsByType[t.key].approvedDays += appDays;
          grandTotalsByType[t.key].appliedDays += reqDays;

          const colApproved = t.allowedDays > 0 ? `${t.label} (Approved / Allowed)` : `${t.label} (Approved Days)`;
          fRow[colApproved] = t.allowedDays > 0 ? `${appDays}/${t.allowedDays}` : `${appDays} Days`;

          const colApplied = t.allowedDays > 0 ? `${t.label} (Applied / Allowed)` : `${t.label} (Applied Days)`;
          fRow[colApplied] = t.allowedDays > 0 ? `${reqDays}/${t.allowedDays}` : `${reqDays} Days`;
        });

        fRow['Applied Leave Types'] = appliedTypeNames.join(', ') || '—';
        fRow['Approved Requests'] = stats.totalApprovedCount;
        fRow['Pending Requests'] = stats.pendingCount;
        fRow['Rejected Requests'] = stats.rejectedCount;
        fRow['Applications Breakdown & Details'] = applicationsSummary || '—';
        fRow['Status Summary'] = stats.totalApprovedDays > 0
          ? `${stats.totalApprovedDays} Day(s) Approved`
          : stats.pendingCount > 0
            ? `${stats.pendingCount} Pending Review`
            : `${stats.rejectedCount} Rejected`;

        return fRow;
      });

      // Sort: Faculty with more applications first
      facultyRows.sort((a, b) => (b['Total Applications'] || 0) - (a['Total Applications'] || 0));

      // Append institutional summary total row
      const totalRow: Record<string, any> = {
        'SL No.': 'TOTAL',
        'Teacher / Faculty Member': 'INSTITUTION TOTAL (ALL FACULTY)',
        'Email Address': '',
        'Employee ID': '',
        'Designation / Department': `${facultyList.length} Faculty Member(s) Applied`,
        'Report Month': monthName,
        'Total Approved Leaves': totalAllowedQuota > 0 ? `${grandApprovedDays}/${totalAllowedQuota}` : `${grandApprovedDays} Days`,
        'Total Approved Count': grandApprovedCount,
        'Total Applied Days': `${grandAppliedDays} Days`,
        'Total Applications': grandTotalApps
      };

      allDynamicLeaveTypes.forEach((t) => {
        const colApproved = t.allowedDays > 0 ? `${t.label} (Approved / Allowed)` : `${t.label} (Approved Days)`;
        totalRow[colApproved] = t.allowedDays > 0 ? `${grandTotalsByType[t.key].approvedDays}/${t.allowedDays}` : `${grandTotalsByType[t.key].approvedDays} Days`;

        const colApplied = t.allowedDays > 0 ? `${t.label} (Applied / Allowed)` : `${t.label} (Applied Days)`;
        totalRow[colApplied] = t.allowedDays > 0 ? `${grandTotalsByType[t.key].appliedDays}/${t.allowedDays}` : `${grandTotalsByType[t.key].appliedDays} Days`;
      });

      totalRow['Applied Leave Types'] = `${allDynamicLeaveTypes.length} Configured Types`;
      totalRow['Approved Requests'] = grandApprovedCount;
      totalRow['Pending Requests'] = grandPendingCount;
      totalRow['Rejected Requests'] = grandRejectedCount;
      totalRow['Applications Breakdown & Details'] = `${grandApprovedDays} Total Approved Days across institution`;
      totalRow['Status Summary'] = `${grandApprovedDays} Days Approved, ${grandPendingCount} Pending, ${grandRejectedCount} Rejected`;

      facultyRows.push(totalRow as any);

      // Sheet 2: Itemized individual leave application transactions
      const detailRows = targetLeaves.map((l, index) => {
        const totalDuration = calculateDays(l.start_date, l.end_date);
        const daysInMonth = computeLeaveDaysInMonth(l, ym);
        const typeStyle = getLeaveTypeStyle(l.leave_type);
        const statusLabel = l.status === 'APPROVED' ? 'Approved' : l.status === 'REJECTED' ? 'Rejected' : 'Pending Review';

        const row: Record<string, any> = {
          'SL No.': index + 1,
          'Faculty Member': l.applicant_name || 'Faculty Member',
          'Email Address': l.teacher_email || '—',
          'Employee ID': l.identifier || '—',
          'Applied Leave Type': typeStyle.label || l.leave_type,
          'Duration & Period': `${formatDate(l.start_date)} → ${formatDate(l.end_date)}`,
          'Start Date': l.start_date || '—',
          'End Date': l.end_date || '—',
          'Duration (Days)': totalDuration,
          'Days in Month': daysInMonth,
          'Reason / Details': l.reason || '—',
          'Applied Date': l.created_at ? formatDate(l.created_at) : '—',
          'Status': statusLabel,
          'Review Remarks': l.review_notes || l.rejection_reason || (l.status === 'APPROVED' ? 'Approved by School Administration' : '—'),
          'Reviewed By': l.reviewer_name || (l.status !== 'PENDING' ? 'School Administration' : '—'),
          'Reviewed At': l.reviewed_at ? formatDate(l.reviewed_at) : '—',
          'Supporting Document': l.document_name ? `${l.document_name}` : (l.document_url ? 'Attached' : 'None')
        };

        return row;
      });

      // Build Workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Faculty Leave Review (One row per teacher, counts increment for applied leaves)
      const wsFaculty = XLSX.utils.json_to_sheet(facultyRows);
      const facultyCols = [
        { wch: 8 },  // SL No.
        { wch: 26 }, // Faculty Member
        { wch: 28 }, // Email Address
        { wch: 16 }, // Employee ID
        { wch: 24 }, // Designation
        { wch: 16 }, // Month
        { wch: 24 }, // Total Approved Leaves
        { wch: 20 }, // Total Approved Count
        { wch: 18 }, // Total Applied Days
        { wch: 18 }, // Total Applications
        ...allDynamicLeaveTypes.flatMap(() => [{ wch: 28 }, { wch: 26 }]), // Approved and Applied columns per type
        { wch: 30 }, // Applied Leave Types
        { wch: 18 }, // Approved Requests
        { wch: 18 }, // Pending Requests
        { wch: 18 }, // Rejected Requests
        { wch: 45 }, // Applications Breakdown & Details
        { wch: 24 }  // Status Summary
      ];
      wsFaculty['!cols'] = facultyCols;
      XLSX.utils.book_append_sheet(wb, wsFaculty, 'Teacher Leave Review');

      // Sheet 2: Individual Applications Log
      const wsDetails = XLSX.utils.json_to_sheet(detailRows);
      const detailCols = [
        { wch: 8 },  // SL No.
        { wch: 24 }, // Faculty Member
        { wch: 28 }, // Email Address
        { wch: 16 }, // Employee ID
        { wch: 24 }, // Applied Leave Type
        { wch: 26 }, // Duration & Period
        { wch: 14 }, // Start Date
        { wch: 14 }, // End Date
        { wch: 16 }, // Duration (Days)
        { wch: 16 }, // Days in Month
        { wch: 34 }, // Reason / Details
        { wch: 16 }, // Applied Date
        { wch: 16 }, // Status
        { wch: 34 }, // Review Remarks
        { wch: 24 }, // Reviewed By
        { wch: 16 }, // Reviewed At
        { wch: 24 }  // Supporting Document
      ];
      wsDetails['!cols'] = detailCols;
      XLSX.utils.book_append_sheet(wb, wsDetails, 'All Applications Log');

      const safeMonth = monthName.replace(/[^a-zA-Z0-9]/g, '_');
      const teacherSuffix = selectedTeacherKeys.size > 0 ? `_${selectedTeacherKeys.size}_Selected_Teachers` : '';
      const filename = `Teacher_Leave_Review_${safeMonth}${teacherSuffix}.xlsx`;
      XLSX.writeFile(wb, filename);

      setFeedback({
        type: 'success',
        message: selectedTeacherKeys.size > 0
          ? `Downloaded leave report for ${selectedTeacherKeys.size} selected teacher(s) in ${monthName} (${targetLeaves.length} application(s)).`
          : `Teacher Leave Review report downloaded for ${monthName} (${targetLeaves.length} application(s) across ${facultyList.length} faculty member(s)).`
      });
    } catch (err: any) {
      console.error('Failed to export leave report:', err);
      setFeedback({
        type: 'error',
        message: `Export failed: ${err.message || 'Unknown error during Excel generation'}`
      });
    } finally {
      setExporting(false);
    }
  };

  const filteredLeaves = useMemo(() => {
    return monthScopedLeaves.filter((l) => {
      // Status Tab filter
      if (activeTab !== 'ALL' && l.status !== activeTab) {
        return false;
      }

      // Leave Type filter
      if (typeFilter !== 'ALL') {
        const leaveTypeVal = String(l.leave_type || 'CASUAL').toUpperCase();
        const selectedPolicy = configuredPolicies.find((p: any) => {
          const pVal = (p.code || p.name).toUpperCase().replace(/\s+/g, '_');
          return pVal === typeFilter || (p.code && p.code.toUpperCase() === typeFilter);
        });

        if (selectedPolicy) {
          if (!matchesPolicy(leaveTypeVal, selectedPolicy)) return false;
        } else {
          if (leaveTypeVal !== typeFilter) return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = l.applicant_name?.toLowerCase().includes(q);
        const emailMatch = l.teacher_email?.toLowerCase().includes(q);
        const idMatch = l.identifier?.toLowerCase().includes(q);
        const reasonMatch = l.reason?.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !idMatch && !reasonMatch) return false;
      }

      return true;
    });
  }, [monthScopedLeaves, activeTab, typeFilter, searchQuery, configuredPolicies]);

  const uniqueVisibleTeacherKeys = useMemo(() => {
    const set = new Set<string>();
    filteredLeaves.forEach((l) => {
      const k = getTeacherKey(l);
      if (k) set.add(k);
    });
    return Array.from(set);
  }, [filteredLeaves]);

  const isAllVisibleSelected = uniqueVisibleTeacherKeys.length > 0 && uniqueVisibleTeacherKeys.every((k) => selectedTeacherKeys.has(k));
  const isSomeVisibleSelected = uniqueVisibleTeacherKeys.some((k) => selectedTeacherKeys.has(k)) && !isAllVisibleSelected;

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedTeacherKeys((prev) => {
        const next = new Set(prev);
        uniqueVisibleTeacherKeys.forEach((k) => next.delete(k));
        return next;
      });
    } else {
      setSelectedTeacherKeys((prev) => {
        const next = new Set(prev);
        uniqueVisibleTeacherKeys.forEach((k) => next.add(k));
        return next;
      });
    }
  };

  return (
    <div className="student-subpage" style={{ width: '100%', paddingBottom: 40 }}>
      {/* ── Page Header ── */}
      <div className="student-subpage-header" style={{ marginBottom: 20 }}>
        <div className="student-subpage-title-row">
          <Link
            to="/dashboard"
            className="student-back-link"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#2563EB',
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
              marginBottom: 4
            }}
          >
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text, #0F172A)', margin: '2px 0 4px' }}>
            Teacher's Leave Review
          </h1>
          <p className="student-subpage-desc" style={{ fontSize: 14, color: 'var(--text-secondary, #64748B)', margin: 0 }}>
            Review, approve, or reject leave applications submitted by faculty members across all departments.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Report Month Selector */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--border, #E2E8F0)',
              background: 'var(--surface, #FFF)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}
            title="Select month to filter leave applications and Excel report"
          >
            <Calendar size={14} color="#64748B" />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary, #64748B)' }}>
              Month:
            </span>
            <input
              type="month"
              value={monthFilter === 'ALL' ? '' : monthFilter}
              onChange={(e) => {
                const val = e.target.value;
                setMonthFilter(val || 'ALL');
                setReportMonth(val || new Date().toISOString().slice(0, 7));
              }}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text, #0F172A)',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            />
            {monthFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setMonthFilter('ALL')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563EB',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
                title="Show all months"
              >
                All Months
              </button>
            )}
          </div>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={() => exportMonthlyLeaveReport(reportMonth)}
            disabled={exporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 15px',
              borderRadius: 8,
              border: '1px solid #16A34A',
              background: '#16A34A',
              color: '#FFFFFF',
              cursor: exporting ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)',
              transition: 'all 0.15s ease'
            }}
            title={`Download monthly leave report for ${formatMonthDisplay(reportMonth)}`}
          >
            <FileSpreadsheet size={15} />
            <span>
              {exporting
                ? 'Exporting...'
                : selectedTeacherKeys.size > 0
                  ? `Export Selected (${selectedTeacherKeys.size})`
                  : 'Export Excel'}
            </span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadLeaves}
            className="student-btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border, #E2E8F0)',
              background: 'var(--surface, #FFF)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text, #0F172A)'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Feedback Banner ── */}
      {feedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderRadius: 8,
            marginBottom: 16,
            background: feedback.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${feedback.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
            color: feedback.type === 'success' ? '#166534' : '#991B1B',
            fontSize: 13.5
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── KPI Stat Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}
      >
        <div
          style={{
            background: 'var(--surface, #FFF)',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 12,
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pending Review
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#B45309', marginTop: 4 }}>
              {dynamicCounts.pending}
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Clock size={22} />
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface, #FFF)',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 12,
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Approved
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#15803D', marginTop: 4 }}>
              {dynamicCounts.approved}
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#DCFCE7',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface, #FFF)',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 12,
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rejected
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#B91C1C', marginTop: 4 }}>
              {dynamicCounts.rejected}
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#FEE2E2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <XCircle size={22} />
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface, #FFF)',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 12,
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Submissions
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #0F172A)', marginTop: 4 }}>
              {dynamicCounts.all}
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <FileText size={22} />
          </div>
        </div>
      </div>

      {/* ── Status Tab Navigation ── */}
      <div
        className="student-tab-bar"
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid var(--border, #E2E8F0)',
          marginBottom: 20
        }}
      >
        <button
          type="button"
          className={`student-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '9px 18px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'ALL' ? '2px solid #2563EB' : '2px solid transparent',
            color: activeTab === 'ALL' ? '#2563EB' : 'var(--text-secondary, #64748B)',
            transition: 'all 0.15s'
          }}
        >
          All ({dynamicCounts.all})
        </button>
        <button
          type="button"
          className={`student-tab-btn ${activeTab === 'PENDING' ? 'active' : ''}`}
          onClick={() => setActiveTab('PENDING')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '9px 18px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'PENDING' ? '2px solid #D97706' : '2px solid transparent',
            color: activeTab === 'PENDING' ? '#D97706' : 'var(--text-secondary, #64748B)',
            transition: 'all 0.15s'
          }}
        >
          Pending Review ({dynamicCounts.pending})
        </button>
        <button
          type="button"
          className={`student-tab-btn ${activeTab === 'APPROVED' ? 'active' : ''}`}
          onClick={() => setActiveTab('APPROVED')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '9px 18px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'APPROVED' ? '2px solid #16A34A' : '2px solid transparent',
            color: activeTab === 'APPROVED' ? '#16A34A' : 'var(--text-secondary, #64748B)',
            transition: 'all 0.15s'
          }}
        >
          Approved ({dynamicCounts.approved})
        </button>
        <button
          type="button"
          className={`student-tab-btn ${activeTab === 'REJECTED' ? 'active' : ''}`}
          onClick={() => setActiveTab('REJECTED')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '9px 18px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'REJECTED' ? '2px solid #DC2626' : '2px solid transparent',
            color: activeTab === 'REJECTED' ? '#DC2626' : 'var(--text-secondary, #64748B)',
            transition: 'all 0.15s'
          }}
        >
          Rejected ({dynamicCounts.rejected})
        </button>
      </div>

      {/* ── Search and Filter Controls ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}
      >
        <div style={{ position: 'relative', minWidth: 260, flex: 1, maxWidth: 400 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary, #64748B)' }} />
          <input
            type="text"
            placeholder="Search teacher, email, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: 8,
              border: '1px solid var(--border, #E2E8F0)',
              background: 'var(--surface, #FFF)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>

          {/* Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary, #64748B)' }}>
              <Filter size={14} />
              <span>Type:</span>
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid var(--border, #E2E8F0)',
                background: 'var(--surface, #FFF)',
                fontSize: 13,
                color: 'var(--text, #0F172A)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {dynamicFilterLeaveTypes.map((lt) => (
                <option key={lt.value} value={lt.value}>
                  {lt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Leave Requests Table Card ── */}
      <div
        className="student-card"
        style={{
          background: 'var(--surface, #FFF)',
          border: '1px solid var(--border, #E2E8F0)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}
      >
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary, #64748B)' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ margin: 0, fontSize: 14 }}>Loading leave applications...</p>
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary, #64748B)' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#ECFDF5',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px'
              }}
            >
              <CheckCircle2 size={26} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #0F172A)', margin: '0 0 6px' }}>
              No Leave Requests Found
            </h3>
            <p style={{ fontSize: 13.5, margin: 0 }}>
              {activeTab === 'PENDING'
                ? 'All teacher leave requests have been reviewed.'
                : `No faculty applications currently match the selected criteria.`}
            </p>
          </div>
        ) : (
          <div>
            {/* Active Faculty Selection Banner */}
            {selectedTeacherKeys.size > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)',
                  border: '1px solid #BFDBFE',
                  borderRadius: 8,
                  marginBottom: 12,
                  gap: 12,
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CheckCircle2 size={16} style={{ color: '#2563EB' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF' }}>
                    {selectedTeacherKeys.size} faculty member{selectedTeacherKeys.size === 1 ? '' : 's'} selected for export
                  </span>
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    &bull; Clicking &ldquo;Export Excel&rdquo; will export data only for these selected teachers
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => exportMonthlyLeaveReport(reportMonth)}
                    disabled={exporting}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 6,
                      background: '#16A34A',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: 'pointer'
                    }}
                  >
                    <FileSpreadsheet size={14} />
                    <span>Export {selectedTeacherKeys.size} Selected</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTeacherKeys(new Set())}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: '#FFFFFF',
                      color: '#475569',
                      border: '1px solid #CBD5E1',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <X size={13} />
                    <span>Clear Selection</span>
                  </button>
                </div>
              </div>
            )}
            <div className="student-table-wrap" style={{ width: '100%', overflowX: 'auto' }}>
            <table className="student-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
              <thead>
                <tr style={{ background: 'var(--table-header, #F8FAFC)', borderBottom: '1px solid var(--border, #E2E8F0)' }}>
                  <th style={{ padding: '10px 10px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase', minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={isAllVisibleSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeVisibleSelected;
                        }}
                        onChange={toggleSelectAllVisible}
                        title={isAllVisibleSelected ? 'Deselect all visible faculty' : 'Select all visible faculty for export'}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2563EB', margin: 0 }}
                      />
                      <span>FACULTY MEMBER</span>
                    </div>
                  </th>
                  <th style={{ padding: '10px 10px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase', minWidth: 155 }}>
                    APPROVED LEAVES (BY TYPE)
                  </th>
                  <th style={{ padding: '10px 10px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase', minWidth: 95 }}>
                    LEAVE TYPE
                  </th>
                  <th style={{ padding: '10px 10px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase', minWidth: 110 }}>
                    DURATION & PERIOD
                  </th>
                  <th style={{ padding: '10px 10px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase', minWidth: 110 }}>
                    REASON / DETAILS
                  </th>
                  <th style={{ padding: '10px 10px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase', minWidth: 85 }}>
                    STATUS
                  </th>
                  <th style={{ padding: '10px 10px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase', textAlign: 'right', minWidth: 140 }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((l) => {
                  const typeObj = getLeaveTypeStyle(l.leave_type);
                  const days = calculateDays(l.start_date, l.end_date);
                  const isPending = l.status === 'PENDING';
                  const initials = (l.applicant_name || 'TC')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  const teacherStats = getTeacherLeaveStats({ id: l.applicant_id, email: l.teacher_email, name: l.applicant_name });

                  return (
                    <tr
                      key={l.id}
                      style={{
                        background: selectedTeacherKeys.has(getTeacherKey(l)) ? 'rgba(239, 246, 255, 0.65)' : undefined,
                        borderBottom: '1px solid var(--border, #E2E8F0)',
                        transition: 'background 0.15s'
                      }}
                    >
                      {/* Faculty Info */}
                      <td style={{ padding: '10px 10px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={selectedTeacherKeys.has(getTeacherKey(l))}
                            onChange={() => toggleTeacherSelection(getTeacherKey(l))}
                            title={`Select ${l.applicant_name || 'faculty'} for export`}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2563EB', margin: 0, flexShrink: 0 }}
                          />
                          {l.photo_url ? (
                            <img
                              src={l.photo_url}
                              alt={l.applicant_name}
                              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid #BFDBFE', flexShrink: 0 }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: selectedTeacherKeys.has(getTeacherKey(l)) ? '#DBEAFE' : '#EFF6FF',
                                color: '#2563EB',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: 12,
                                flexShrink: 0,
                                border: selectedTeacherKeys.has(getTeacherKey(l)) ? '1px solid #3B82F6' : 'none'
                              }}
                            >
                              {initials}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text, #0F172A)' }}>
                              <PersonProfileLink kind="teacher" id={l.applicant_id} name={l.applicant_name} person={l as any} />
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748B)' }}>
                              {l.teacher_email || l.identifier || 'Faculty Member'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Approved Leaves Count (By Type) - Increases ONLY when admin approves */}
                      <td style={{ padding: '10px 10px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: teacherStats.totalApprovedDays > 0 ? '#15803D' : '#64748B',
                                background: teacherStats.totalApprovedDays > 0 ? '#DCFCE7' : '#F1F5F9',
                                border: `1px solid ${teacherStats.totalApprovedDays > 0 ? '#86EFAC' : '#E2E8F0'}`,
                                padding: '2px 6px',
                                borderRadius: 5,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title={`Total approved leave days out of policy entitlement`}
                            >
                              <CheckCircle2 size={11} color={teacherStats.totalApprovedDays > 0 ? '#15803D' : '#94A3B8'} />
                              <span>
                                Total Approved: {teacherStats.totalApprovedDays}
                                {totalAllowedQuota > 0 ? `/${totalAllowedQuota}` : ''}{' '}
                                {teacherStats.totalApprovedDays === 1 ? 'Day' : 'Days'}
                              </span>
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {allDynamicLeaveTypes.map((t) => {
                              const tStat = teacherStats.byType[t.key];
                              const countDays = tStat?.days || 0;
                              const isTaken = countDays > 0;
                              const quotaDisplay = t.allowedDays > 0 ? `${countDays}/${t.allowedDays}` : `${countDays}d`;
                              return (
                                <span
                                  key={t.key}
                                  title={`${t.label}: ${countDays} approved out of ${t.allowedDays || 'unlimited'} allowed. Increases when admin approves.`}
                                  style={{
                                    fontSize: 10,
                                    fontWeight: isTaken ? 700 : 500,
                                    color: isTaken ? '#1E40AF' : '#64748B',
                                    background: isTaken ? '#EFF6FF' : '#F8FAFC',
                                    border: `1px solid ${isTaken ? '#BFDBFE' : '#E2E8F0'}`,
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 2
                                  }}
                                >
                                  <span>{t.code || t.name}:</span>
                                  <span style={{ fontWeight: 800 }}>{quotaDisplay}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </td>

                      {/* Leave Type */}
                      <td style={{ padding: '10px 10px', verticalAlign: 'top' }}>
                        {(() => {
                          const currentLeavePolicy = allDynamicLeaveTypes.find((t) => matchesPolicy(l.leave_type, t));
                          const currentLeaveQuota = currentLeavePolicy?.allowedDays || 0;

                          return (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '3px 7px',
                                borderRadius: 5,
                                fontSize: 11.5,
                                fontWeight: 700,
                                background: typeObj.bg,
                                color: typeObj.color,
                                border: `1px solid ${typeObj.border}`
                              }}
                            >
                              <span>{typeObj.label}</span>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  padding: '1px 4px',
                                  borderRadius: 3,
                                  background: 'rgba(255, 255, 255, 0.8)',
                                  border: `1px solid ${typeObj.border}`
                                }}
                                title={`Current application: ${days} day(s)${currentLeaveQuota > 0 ? ` out of ${currentLeaveQuota} allowed ${currentLeavePolicy?.name || ''} days` : ''}`}
                              >
                                {currentLeaveQuota > 0 ? `${days}/${currentLeaveQuota}d` : `${days}d`}
                              </span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* Duration & Period */}
                      <td style={{ padding: '10px 10px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text, #0F172A)' }}>
                          {formatDate(l.start_date)} → {formatDate(l.end_date)}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #64748B)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={11} />
                          <span>{days} {days === 1 ? 'Day' : 'Days'}</span>
                        </div>
                      </td>

                      {/* Reason */}
                      <td style={{ padding: '10px 10px', verticalAlign: 'top' }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 12.5,
                            color: 'var(--text, #0F172A)',
                            lineHeight: 1.4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}
                          title={l.reason}
                        >
                          {l.reason}
                        </p>
                        <div style={{ fontSize: 11, color: 'var(--text-muted, #94A3B8)', marginTop: 2 }}>
                          Applied: {formatDate(l.created_at)}
                        </div>
                        {l.document_url && (
                          <div style={{ marginTop: 4 }}>
                            <button
                              type="button"
                              onClick={() => setViewingDoc({ url: l.document_url!, name: l.document_name || `${l.applicant_name} Leave Document` })}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 6px',
                                borderRadius: 4,
                                border: '1px solid #BFDBFE',
                                background: '#EFF6FF',
                                color: '#1D4ED8',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'background 0.15s'
                              }}
                              title="View Supporting Document"
                            >
                              <Paperclip size={10} />
                              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {l.document_name || 'View Doc'}
                              </span>
                              <Eye size={10} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 10px', verticalAlign: 'top' }}>
                        {l.status === 'PENDING' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 7px',
                              borderRadius: 5,
                              fontSize: 11.5,
                              fontWeight: 700,
                              background: '#FEF3C7',
                              color: '#B45309',
                              border: '1px solid #FDE68A'
                            }}
                          >
                            <Clock size={11} />
                            Pending
                          </span>
                        )}
                        {l.status === 'APPROVED' && (
                          <div>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 7px',
                                borderRadius: 5,
                                fontSize: 11.5,
                                fontWeight: 700,
                                background: '#DCFCE7',
                                color: '#15803D',
                                border: '1px solid #BBF7D0'
                              }}
                            >
                              <CheckCircle2 size={11} />
                              Approved
                            </span>
                            {l.review_notes && (
                              <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748B)', marginTop: 2 }}>
                                "{l.review_notes}"
                              </div>
                            )}
                          </div>
                        )}
                        {l.status === 'REJECTED' && (
                          <div>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 7px',
                                borderRadius: 5,
                                fontSize: 11.5,
                                fontWeight: 700,
                                background: '#FEE2E2',
                                color: '#B91C1C',
                                border: '1px solid #FECACA'
                              }}
                            >
                              <XCircle size={11} />
                              Rejected
                            </span>
                            {l.review_notes && (
                              <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748B)', marginTop: 2 }}>
                                "{l.review_notes}"
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 10px', verticalAlign: 'top', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => setViewingLeave(l)}
                            title="View Full Details"
                            style={{
                              padding: '4px 8px',
                              borderRadius: 5,
                              border: '1px solid var(--border, #E2E8F0)',
                              background: 'var(--surface, #FFF)',
                              color: 'var(--text, #0F172A)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              fontSize: 11.5,
                              fontWeight: 600
                            }}
                          >
                            <Eye size={12} />
                            <span>Details</span>
                          </button>

                          {isPending && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoading === l.id}
                                onClick={() => {
                                  setApprovingLeave(l);
                                  setApproveNotes('Approved by School Administration');
                                }}
                                title="Approve Request"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 5,
                                  border: 'none',
                                  background: '#16A34A',
                                  color: '#FFF',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  boxShadow: '0 1px 2px rgba(22,163,74,0.2)'
                                }}
                              >
                                <Check size={12} />
                                <span>Approve</span>
                              </button>

                              <button
                                type="button"
                                disabled={actionLoading === l.id}
                                onClick={() => {
                                  setRejectingLeave(l);
                                  setRejectReason('');
                                }}
                                title="Reject Request"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 5,
                                  border: '1px solid #FECACA',
                                  background: '#FEF2F2',
                                  color: '#DC2626',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontSize: 11.5,
                                  fontWeight: 600
                                }}
                              >
                                <X size={12} />
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>

      {/* ── View Details Modal ── */}
      {viewingLeave && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingLeave(null);
          }}
        >
          <div
            style={{
              background: 'var(--surface, #FFF)',
              border: '1px solid var(--border, #E2E8F0)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 540,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid var(--border, #E2E8F0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--modal-header, #F8FAFC)'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                  Faculty Leave Request Details
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary, #64748B)' }}>
                  Submitted on {formatDate(viewingLeave.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingLeave(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #64748B)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 22px' }}>
              {/* Teacher Summary Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--background, #F8FAFC)',
                  border: '1px solid var(--border, #E2E8F0)',
                  marginBottom: 16
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#2563EB',
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 15
                  }}
                >
                  {(viewingLeave.applicant_name || 'TC').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text, #0F172A)' }}>
                    <PersonProfileLink kind="teacher" id={viewingLeave.applicant_id} name={viewingLeave.applicant_name} person={viewingLeave as any} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #64748B)' }}>
                    {viewingLeave.teacher_email || viewingLeave.identifier || 'Faculty Member'}
                  </div>
                </div>
              </div>

              {/* Faculty's Approved Leave Ledger by Type */}
              {(() => {
                const modalStats = getTeacherLeaveStats({ id: viewingLeave.applicant_id, email: viewingLeave.teacher_email, name: viewingLeave.applicant_name });
                return (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    marginBottom: 16
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Approved Leave Record ({formatMonthDisplay(monthFilter)})
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#15803D' }}>
                        Total Approved: {modalStats.totalApprovedDays}{totalAllowedQuota > 0 ? `/${totalAllowedQuota}` : ''} {modalStats.totalApprovedDays === 1 ? 'Day' : 'Days'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {allDynamicLeaveTypes.map((t) => {
                        const tStat = modalStats.byType[t.key];
                        const days = tStat?.days || 0;
                        const isPos = days > 0;
                        const ratio = t.allowedDays > 0 ? `${days}/${t.allowedDays}` : `${days}d`;
                        return (
                          <span
                            key={t.key}
                            style={{
                              fontSize: 11.5,
                              fontWeight: isPos ? 700 : 500,
                              color: isPos ? '#1E40AF' : '#475569',
                              background: isPos ? '#EFF6FF' : '#FFF',
                              border: `1px solid ${isPos ? '#BFDBFE' : '#CBD5E1'}`,
                              padding: '2px 8px',
                              borderRadius: 5
                            }}
                          >
                            {t.label}: <strong>{ratio}</strong>
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 11, color: '#15803D', marginTop: 6, fontStyle: 'italic' }}>
                      Approved leave counts increment only when a request is approved by school admin.
                    </div>
                  </div>
                );
              })()}

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)' }}>LEAVE TYPE</div>
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 9px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        ...getLeaveTypeStyle(viewingLeave.leave_type)
                      }}
                    >
                      <span>{getLeaveTypeStyle(viewingLeave.leave_type).label}</span>
                      {(() => {
                        const pol = allDynamicLeaveTypes.find((t) => matchesPolicy(viewingLeave.leave_type, t));
                        const dur = calculateDays(viewingLeave.start_date, viewingLeave.end_date);
                        return (
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: 'rgba(255, 255, 255, 0.75)' }}>
                            {pol && pol.allowedDays > 0 ? `${dur}/${pol.allowedDays}d` : `${dur}d`}
                          </span>
                        );
                      })()}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)' }}>TOTAL DURATION</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text, #0F172A)', marginTop: 4 }}>
                    {calculateDays(viewingLeave.start_date, viewingLeave.end_date)} Days
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)' }}>FROM DATE</div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text, #0F172A)', marginTop: 4 }}>
                    {formatDate(viewingLeave.start_date)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)' }}>TO DATE</div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text, #0F172A)', marginTop: 4 }}>
                    {formatDate(viewingLeave.end_date)}
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)', marginBottom: 6 }}>
                  REASON FOR LEAVE
                </div>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: 'var(--background, #F8FAFC)',
                    border: '1px solid var(--border, #E2E8F0)',
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    color: 'var(--text, #0F172A)'
                  }}
                >
                  {viewingLeave.reason}
                </div>
              </div>

              {/* Attached Supporting Document */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748B)', marginBottom: 6 }}>
                  ATTACHED SUPPORTING DOCUMENT / PROOF
                </div>
                {viewingLeave.document_url ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          background: '#2563EB',
                          color: '#FFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {viewingLeave.document_url.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(viewingLeave.document_url) ? (
                          <ImageIcon size={18} />
                        ) : (
                          <FileText size={18} />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1E3A8A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {viewingLeave.document_name || 'Faculty Leave Document'}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#3B82F6', marginTop: 1 }}>
                          Supporting proof provided by faculty member
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setViewingDoc({ url: viewingLeave.document_url!, name: viewingLeave.document_name || `${viewingLeave.applicant_name} Leave Document` })}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#2563EB',
                          color: '#FFF',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Eye size={13} />
                        <span>View Document</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--background, #F8FAFC)',
                      border: '1px solid var(--border, #E2E8F0)',
                      fontSize: 12.5,
                      color: 'var(--text-muted, #94A3B8)',
                      fontStyle: 'italic'
                    }}
                  >
                    No supporting document attached for this request.
                  </div>
                )}
              </div>

              {/* Status & Review Info */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #E2E8F0)',
                  background: viewingLeave.status === 'APPROVED' ? '#F0FDF4' : viewingLeave.status === 'REJECTED' ? '#FEF2F2' : '#FFFBEB'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: viewingLeave.status === 'APPROVED' ? '#166534' : viewingLeave.status === 'REJECTED' ? '#991B1B' : '#92400E' }}>
                    Status: {viewingLeave.status}
                  </span>
                  {viewingLeave.reviewed_at && (
                    <span style={{ fontSize: 11.5, color: 'var(--text-secondary, #64748B)' }}>
                      Reviewed on {formatDate(viewingLeave.reviewed_at)}
                    </span>
                  )}
                </div>
                {viewingLeave.review_notes && (
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text, #0F172A)' }}>
                    Remarks: <b>{viewingLeave.review_notes}</b> ({viewingLeave.reviewer_name || 'Admin'})
                  </p>
                )}
              </div>
            </div>

            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid var(--border, #E2E8F0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 10
              }}
            >
              <button
                type="button"
                onClick={() => setViewingLeave(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #E2E8F0)',
                  background: 'var(--surface, #FFF)',
                  color: 'var(--text, #0F172A)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>

              {viewingLeave.status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setApprovingLeave(viewingLeave);
                      setApproveNotes('Approved by School Administration');
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#16A34A',
                      color: '#FFF',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    Approve Request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingLeave(viewingLeave);
                      setRejectReason('');
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    Reject Request
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Approve Modal ── */}
      {approvingLeave && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1010,
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) setApprovingLeave(null);
          }}
        >
          <div
            style={{
              background: 'var(--surface, #FFF)',
              border: '1px solid var(--border, #E2E8F0)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border, #E2E8F0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={20} color="#16A34A" />
                <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                  Approve Faculty Leave
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setApprovingLeave(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #64748B)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 22px' }}>
              <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--text, #0F172A)' }}>
                Are you sure you want to approve <b>{approvingLeave.applicant_name}</b>'s leave request for{' '}
                <b>{calculateDays(approvingLeave.start_date, approvingLeave.end_date)} day(s)</b> ({formatDate(approvingLeave.start_date)} to {formatDate(approvingLeave.end_date)})?
              </p>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #0F172A)', marginBottom: 6 }}>
                  Approval Remarks (Optional):
                </label>
                <input
                  type="text"
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Approved by School Administration"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #CBD5E1)',
                    background: 'var(--surface, #FFF)',
                    color: 'var(--text, #0F172A)',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border, #E2E8F0)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setApprovingLeave(null)}
                disabled={actionLoading === approvingLeave.id}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #CBD5E1)',
                  background: 'var(--surface, #FFF)',
                  color: 'var(--text, #0F172A)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading === approvingLeave.id}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#16A34A',
                  color: '#FFF',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                {actionLoading === approvingLeave.id ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectingLeave && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1010,
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) setRejectingLeave(null);
          }}
        >
          <div
            style={{
              background: 'var(--surface, #FFF)',
              border: '1px solid var(--border, #E2E8F0)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border, #E2E8F0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <XCircle size={20} color="#DC2626" />
                <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: 'var(--text, #0F172A)' }}>
                  Reject Faculty Leave Application
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingLeave(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #64748B)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 22px' }}>
              <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--text, #0F172A)' }}>
                Please provide a rejection note or reason for declining <b>{rejectingLeave.applicant_name}</b>'s leave request:
              </p>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #0F172A)', marginBottom: 6 }}>
                  Reason for Rejection <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <AutoExpandingTextarea
                  minHeight={42}
                  maxHeight={180}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Inadequate staffing for scheduled examinations, please reschedule..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #CBD5E1)',
                    background: 'var(--surface, #FFF)',
                    color: 'var(--text, #0F172A)',
                    fontSize: 13,
                    lineHeight: 1.45,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border, #E2E8F0)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setRejectingLeave(null)}
                disabled={actionLoading === rejectingLeave.id}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #CBD5E1)',
                  background: 'var(--surface, #FFF)',
                  color: 'var(--text, #0F172A)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={actionLoading === rejectingLeave.id}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFF',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                {actionLoading === rejectingLeave.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Preview Modal ── */}
      {viewingDoc && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingDoc(null);
          }}
        >
          <div
            style={{
              background: 'var(--surface, #FFF)',
              border: '1px solid var(--border, #E2E8F0)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border, #E2E8F0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--modal-header, #F8FAFC)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Paperclip size={18} color="#2563EB" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text, #0F172A)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {viewingDoc.name}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => openDocumentInNewTab(viewingDoc.url)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border, #CBD5E1)',
                    background: '#FFF',
                    color: 'var(--text, #0F172A)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                  title="Open in new window"
                >
                  <ExternalLink size={13} />
                  <span>Open New Tab</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadDocument(viewingDoc.url, viewingDoc.name)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#2563EB',
                    color: '#FFF',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                  title="Download File"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingDoc(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary, #64748B)',
                    padding: 4,
                    marginLeft: 4
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--card-subtle, #F1F5F9)' }}>
              {viewingDoc.url.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(viewingDoc.url) ? (
                <img
                  src={viewingDoc.url}
                  alt={viewingDoc.name}
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
              ) : viewingDoc.url.startsWith('data:application/pdf') || /\.pdf$/i.test(viewingDoc.url) ? (
                <iframe
                  src={viewingDoc.url}
                  title={viewingDoc.name}
                  style={{ width: '100%', height: '65vh', border: 'none', borderRadius: 8 }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-card, #FFF)', borderRadius: 10, width: '100%', maxWidth: 420, border: '1px solid var(--border, #e2e8f0)' }}>
                  <FileText size={48} color="#2563EB" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text, #0F172A)', marginBottom: 4 }}>
                    {viewingDoc.name}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted, #64748B)', marginBottom: 16 }}>
                    Direct inline preview is not supported for this file type. Please open or download it to view.
                  </p>
                  <button
                    type="button"
                    onClick={() => downloadDocument(viewingDoc.url, viewingDoc.name)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#2563EB',
                      color: '#FFF',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Download size={14} />
                    <span>Download File</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
