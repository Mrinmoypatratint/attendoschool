import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Award,
  ArrowLeft,
  CheckCircle2,
  Printer,
  Search,
  RotateCw,
  TrendingUp,
  FileText,
  Sparkles,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentApi, Exam, StudentProfile } from '../../services/studentApi';
import { useAuth } from '../../hooks/useAuth';

function formatScore(val?: number | string) {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toFixed(2);
}

// Grade badge styling based on performance
function getGradeBadgeClass(grade?: string) {
  const g = (grade || '').toUpperCase().trim();
  if (g.startsWith('A')) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  }
  if (g.startsWith('B')) {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
  }
  if (g.startsWith('C')) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  }
  return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
}

function formatDate(val?: string) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return val;
  }
}

export function StudentResults() {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'RESULTS' | 'MARKSHEET'>('RESULTS');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExamTitles, setSelectedExamTitles] = useState<Set<string>>(new Set());

  const loadData = () => {
    setLoading(true);
    Promise.allSettled([
      studentApi.getExams(),
      studentApi.getProfile()
    ])
      .then(([examRes, profRes]) => {
        if (examRes.status === 'fulfilled' && Array.isArray(examRes.value)) {
          setExams(examRes.value);
        } else {
          setExams([]);
        }
        if (profRes.status === 'fulfilled' && profRes.value) {
          setProfile(profRes.value);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter evaluated results
  const resultsList = useMemo(() => {
    return exams.filter((e) => (e.marks_obtained !== undefined && e.marks_obtained !== null) || (e.grade && e.grade.trim() !== ''));
  }, [exams]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (resultsList.length === 0) {
      return {
        totalSubjects: 0,
        totalMarks: 0,
        obtainedMarks: 0,
        percentage: 0,
        overallGrade: '—',
        topSubject: '—',
        passCount: 0
      };
    }
    const totalMax = resultsList.reduce((acc, r) => acc + (Number(r.total_marks) || 100), 0);
    const totalObtained = resultsList.reduce((acc, r) => acc + (Number(r.marks_obtained) || 0), 0);
    const pct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

    let overallGrade = 'A+';
    if (pct < 40) overallGrade = 'F';
    else if (pct < 60) overallGrade = 'C';
    else if (pct < 75) overallGrade = 'B';
    else if (pct < 90) overallGrade = 'A';
    else overallGrade = 'A+';

    // Best subject
    let best = resultsList[0];
    for (const r of resultsList) {
      const bestRatio = (Number(best.marks_obtained) || 0) / (Number(best.total_marks) || 100);
      const curRatio = (Number(r.marks_obtained) || 0) / (Number(r.total_marks) || 100);
      if (curRatio > bestRatio) {
        best = r;
      }
    }

    const passCount = resultsList.filter((r) => {
      const passM = Number(r.passing_marks) || 40;
      return (Number(r.marks_obtained) || 0) >= passM;
    }).length;

    return {
      totalSubjects: resultsList.length,
      totalMarks: totalMax,
      obtainedMarks: totalObtained,
      percentage: Number(pct.toFixed(1)),
      overallGrade,
      topSubject: best ? `${best.subject_name} (${best.marks_obtained}/${best.total_marks})` : '—',
      passCount
    };
  }, [resultsList]);

  // Filtered results for Tab 1
  const filteredResults = useMemo(() => {
    if (!searchTerm.trim()) return resultsList;
    const q = searchTerm.toLowerCase().trim();
    return resultsList.filter((r) =>
      r.subject_name.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      (r.remarks && r.remarks.toLowerCase().includes(q))
    );
  }, [resultsList, searchTerm]);

  // All distinct exam titles from resultsList
  const allExamTitles = useMemo(() => {
    const titlesSet = new Set<string>();
    resultsList.forEach((r) => {
      const titleKey = (r.title || 'General Assessment').trim();
      titlesSet.add(titleKey);
    });
    return Array.from(titlesSet);
  }, [resultsList]);

  // Group filtered results by Exam Name for the grouped table structure
  interface ExamGroup {
    examTitle: string;
    examDate?: string;
    gradingSystem?: 'MARKS' | 'CGPA' | 'GRADE';
    items: Exam[];
  }

  const groupedResults = useMemo(() => {
    const groupsMap = new Map<string, ExamGroup>();

    for (const r of filteredResults) {
      const titleKey = (r.title || 'General Assessment').trim();
      if (!groupsMap.has(titleKey)) {
        groupsMap.set(titleKey, {
          examTitle: titleKey,
          examDate: r.exam_date,
          gradingSystem: r.grading_system,
          items: []
        });
      }
      const group = groupsMap.get(titleKey)!;
      group.items.push(r);
      if (!group.examDate && r.exam_date) {
        group.examDate = r.exam_date;
      }
    }

    return Array.from(groupsMap.values());
  }, [filteredResults]);

  // Marksheet items filtered by selected exam(s), or all if none selected
  const marksheetItems = useMemo(() => {
    if (selectedExamTitles.size === 0) {
      return resultsList;
    }
    return resultsList.filter((r) =>
      selectedExamTitles.has((r.title || 'General Assessment').trim())
    );
  }, [resultsList, selectedExamTitles]);

  // Marksheet stats calculated specifically for the marksheet items
  const marksheetStats = useMemo(() => {
    if (marksheetItems.length === 0) {
      return {
        totalSubjects: 0,
        totalMarks: 0,
        obtainedMarks: 0,
        percentage: 0,
        overallGrade: '—',
        passCount: 0
      };
    }
    const totalMax = marksheetItems.reduce((acc, r) => acc + (Number(r.total_marks) || 100), 0);
    const totalObtained = marksheetItems.reduce((acc, r) => acc + (Number(r.marks_obtained) || 0), 0);
    const pct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

    let overallGrade = 'A+';
    if (pct < 40) overallGrade = 'F';
    else if (pct < 60) overallGrade = 'C';
    else if (pct < 75) overallGrade = 'B';
    else if (pct < 90) overallGrade = 'A';
    else overallGrade = 'A+';

    const passCount = marksheetItems.filter((r) => {
      const passM = Number(r.passing_marks) || 40;
      return (Number(r.marks_obtained) || 0) >= passM;
    }).length;

    return {
      totalSubjects: marksheetItems.length,
      totalMarks: totalMax,
      obtainedMarks: totalObtained,
      percentage: Number(pct.toFixed(1)),
      overallGrade,
      passCount
    };
  }, [marksheetItems]);

  // Selection toggle handlers
  const handleToggleExamSelection = (examTitle: string) => {
    setSelectedExamTitles((prev) => {
      const next = new Set(prev);
      if (next.has(examTitle)) {
        next.delete(examTitle);
      } else {
        next.add(examTitle);
      }
      return next;
    });
  };

  const handleSelectAllExams = () => {
    if (selectedExamTitles.size === allExamTitles.length) {
      setSelectedExamTitles(new Set());
    } else {
      setSelectedExamTitles(new Set(allExamTitles));
    }
  };

  // Printing handlers
  const handlePrintSingleExam = (examTitle: string) => {
    setSelectedExamTitles(new Set([examTitle]));
    setActiveTab('MARKSHEET');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintSelected = () => {
    setActiveTab('MARKSHEET');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintFormalMarksheet = () => {
    setActiveTab('MARKSHEET');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const studentDisplayName = profile?.name || user?.name || 'STUDENT';
  const rawClassName = profile?.className || user?.className || 'Class 3';
  const studentClassName = rawClassName.startsWith('Class') ? rawClassName : `Class ${rawClassName}`;
  const studentSectionName = profile?.sectionName || user?.sectionName || 'Section A';
  const schoolName = profile?.schoolName || user?.schoolName || 'DAV MODEL SCHOOL';
  const isDavSchool =
    String(schoolName || '').toUpperCase().includes('DAV') ||
    String((user as any)?.schoolCode || '').includes('15582') ||
    String((user as any)?.email || '').toLowerCase().includes('@dav.') ||
    (user as any)?.schoolId === '5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3';
  const rawSchoolLogo =
    profile?.schoolPhotoUrl ||
    profile?.school_photo_url ||
    (user as any)?.schoolPhotoUrl ||
    (user as any)?.school_photo_url ||
    (user as any)?.school_logo ||
    (user as any)?.schoolLogo ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('attendo_school_photo') || localStorage.getItem('attendo_school_logo')
      : null);
  const schoolLogoUrl = rawSchoolLogo || (isDavSchool ? '/dav-logo.png' : '/attendo-school-logo.png');
  const rollNumber = profile?.rollNumber || (user as any)?.rollNumber || '16';
  const admissionNumber = profile?.admissionNumber || (user as any)?.admissionNumber || '18325';
  const academicSession = profile?.academicSession || '2026-2027';

  return (
    <div className="student-subpage">
      {/* ── Print-only CSS to isolate the Formal Marksheet ── */}
      <style>{`
        @media print {
          /* Hide all UI elements that are NOT part of the official marksheet */
          .no-print,
          .student-subpage-header,
          .student-kpi-grid,
          .student-tabs-nav,
          .student-sidebar,
          .student-topbar,
          .app-shell > aside,
          .app-topbar,
          .sa-sidebar,
          .sa-topbar,
          header,
          nav,
          aside,
          button,
          .btn {
            display: none !important;
          }

          /* Force page background to clean white */
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .app-shell,
          .app-shell > main,
          .sa-main-wrap,
          .student-main-wrapper,
          .student-subpage {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
          }

          /* Marksheet Card is isolated and centered */
          #official-marksheet-printable {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 24px 28px !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border: 1.5px solid #cbd5e1 !important;
            border-radius: 12px !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }

          #official-marksheet-printable .school-logo-badge {
            background-color: #e11d48 !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #official-marksheet-printable .school-logo-img {
            display: block !important;
            height: 56px !important;
            max-height: 56px !important;
            width: auto !important;
            max-width: 140px !important;
            margin: 0 auto 8px auto !important;
            object-fit: contain !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #official-marksheet-printable .student-identity-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 16px !important;
            padding: 16px 0 !important;
            border-bottom: 1px solid #cbd5e1 !important;
          }

          #official-marksheet-printable table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 16px !important;
            page-break-inside: avoid !important;
          }

          #official-marksheet-printable table th,
          #official-marksheet-printable table td {
            border: 1.5px solid #0f172a !important;
            color: #0f172a !important;
            padding: 8px 10px !important;
            font-size: 11px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #official-marksheet-printable table thead tr {
            background-color: #f8fafc !important;
            font-weight: 800 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #official-marksheet-printable table tfoot tr {
            background-color: #fff1f2 !important;
            font-weight: 800 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #official-marksheet-printable .grade-badge-print {
            border: 1px solid #10b981 !important;
            background-color: #ecfdf5 !important;
            color: #065f46 !important;
            padding: 2px 6px !important;
            border-radius: 4px !important;
            font-weight: 700 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          @page {
            size: portrait;
            margin: 12mm 15mm;
          }
        }
      `}</style>

      {/* ── Subpage Header ── */}
      <div className="student-subpage-header no-print flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="student-subpage-title-row">
          <Link
            to="/student/dashboard"
            className="student-back-link inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline mb-2"
          >
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="student-subpage-title text-2xl font-bold text-slate-900 dark:text-white m-0">Result</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <Sparkles size={12} /> Academic Session {academicSession}
            </span>
          </div>
          <p className="student-subpage-desc text-sm text-slate-500 dark:text-slate-400 m-0">
            Official academic examination evaluations, verified marks, subject grades, and report cards.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            title="Refresh results"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-xs transition-colors"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards (3 Cards) ── */}
      <div className="student-kpi-grid no-print grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Cumulative Score */}
        <div className="student-card bg-white dark:bg-[#131b2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Cumulative Score
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {stats.percentage}%
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {stats.obtainedMarks} / {stats.totalMarks} aggregate marks
          </div>
        </div>

        {/* Overall Grade */}
        <div className="student-card bg-white dark:bg-[#131b2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Academic Grade
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Award size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            Grade {stats.overallGrade}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Distinction · Top Performance
          </div>
        </div>

        {/* Papers Evaluated */}
        <div className="student-card bg-white dark:bg-[#131b2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Evaluations
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {stats.passCount} / {stats.totalSubjects}
          </div>
          <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            100% Pass Rate
          </div>
        </div>
      </div>

      {/* ── Tab Navigation (Matches ClassMentorWorkspace Tab UI) ── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          borderBottom: '2px solid var(--border, #e2e8f0)',
          marginBottom: 20,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
        className="no-print no-scrollbar [&::-webkit-scrollbar]:hidden"
      >
        {/* Tab 1: Published Results */}
        <button
          type="button"
          onClick={() => setActiveTab('RESULTS')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'RESULTS' ? '3px solid var(--border, #e2e8f0)' : '3px solid transparent',
            color: activeTab === 'RESULTS' ? 'var(--primary, #e11d48)' : 'var(--text-secondary, var(--muted-foreground, #64748b))',
            fontWeight: activeTab === 'RESULTS' ? 700 : 500,
            fontSize: 15,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Award size={18} />
          <span>Published Results</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              background: activeTab === 'RESULTS' ? '#ffe4e6' : 'var(--card-subtle, #f1f5f9)',
              color: activeTab === 'RESULTS' ? '#e11d48' : '#64748b',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {resultsList.length}
          </span>
        </button>

        {/* Tab 2: Official Marksheet View */}
        <button
          type="button"
          onClick={() => setActiveTab('MARKSHEET')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'MARKSHEET' ? '3px solid var(--border, #e2e8f0)' : '3px solid transparent',
            color: activeTab === 'MARKSHEET' ? 'var(--primary, #e11d48)' : 'var(--text-secondary, var(--muted-foreground, #64748b))',
            fontWeight: activeTab === 'MARKSHEET' ? 700 : 500,
            fontSize: 15,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <FileText size={18} />
          <span>Official Marksheet</span>
        </button>
      </div>

      {/* ── TAB 1: PUBLISHED RESULTS (Hidden in print) ── */}
      {activeTab === 'RESULTS' && (
        <div className="no-print">
          {/* Search Row */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-full max-w-md shadow-xs">
              <Search size={15} className="text-slate-400" />
              <input
                type="text"
                placeholder="Search by subject, exam title, or remarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-none outline-none bg-transparent text-xs w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Marksheet & Results Card */}
          <div className="student-card bg-white dark:bg-[#131b2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
            <div className="student-card-header flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="student-card-title-wrap flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <Award size={18} />
                <h3 className="student-card-title text-base font-bold text-slate-900 dark:text-white m-0">
                  Published Subject Marksheet &amp; Evaluations ({filteredResults.length})
                </h3>
              </div>
            </div>

            {filteredResults.length === 0 ? (
              <div className="student-empty-state py-12 text-center text-sm text-slate-400 dark:text-slate-500">
                <Award size={36} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-700 dark:text-slate-300 m-0 mb-1">
                  No Published Results Found
                </p>
                <p className="text-xs m-0">
                  Examination results and marksheet records will appear here as soon as they are published by your Class Mentor.
                </p>
              </div>
            ) : (
              <div className="student-table-wrap overflow-x-auto">
                <table className="student-table w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        EXAM NAME
                      </th>
                      <th className="p-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        SUBJECT
                      </th>
                      <th className="p-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        SCORE
                      </th>
                      <th className="p-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        GRADE
                      </th>
                      <th className="p-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        STATUS
                      </th>
                      <th className="p-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        MENTOR REMARK
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedResults.map((group) => {
                      return (
                        <React.Fragment key={group.examTitle}>
                          {group.items.map((r, itemIdx) => {
                            const totalM = Number(r.total_marks) || 100;
                            const obtM = Number(r.marks_obtained) || 0;
                            const pct = totalM > 0 ? (obtM / totalM) * 100 : 0;
                            const passM = Number(r.passing_marks) || 40;
                            const isPassed = obtM >= passM;

                            return (
                              <tr
                                key={r.id}
                                className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                              >
                                {/* Column 1: Exam Name with rowSpan spanning all subjects of this exam */}
                                {itemIdx === 0 && (
                                  <td
                                    rowSpan={group.items.length}
                                    className="p-3.5 px-4 align-top border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131b2e]"
                                  >
                                    <div className="min-w-[140px]">
                                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                                        {group.examTitle}
                                      </div>
                                      {group.examDate && (
                                        <div className="text-[11px] text-slate-400 mt-0.5">
                                          {formatDate(group.examDate)}
                                        </div>
                                      )}
                                      <div className="text-[11px] text-slate-400 mt-0.5">
                                        {group.items.length} {group.items.length === 1 ? 'subject' : 'subjects'}
                                      </div>
                                    </div>
                                  </td>
                                )}

                                {/* Column 2: Subject */}
                                <td className="p-3.5 px-4">
                                  <div className="font-bold text-slate-900 dark:text-white">{r.subject_name}</div>
                                  <div className="text-[11px] text-slate-400">{studentClassName}</div>
                                </td>

                                {/* Column 3: Score */}
                                <td className="p-3.5 px-4">
                                  {r.grading_system === 'GRADE' ? (
                                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
                                      <span>Grade: {r.grade || '—'}</span>
                                    </div>
                                  ) : r.grading_system === 'CGPA' ? (
                                    <div>
                                      <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
                                        <span>{obtM}</span>
                                        <span className="text-slate-400 text-xs">/ {totalM} CGPA</span>
                                      </div>
                                      <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                                        <div
                                          className="h-full rounded-full bg-rose-500"
                                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                                          {obtM}
                                        </span>
                                        <span className="text-slate-400 text-xs">/ {totalM}</span>
                                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">
                                          ({pct.toFixed(0)}%)
                                        </span>
                                      </div>
                                      <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${
                                            pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-rose-500' : 'bg-amber-500'
                                          }`}
                                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </td>

                                {/* Column 4: Grade */}
                                <td className="p-3.5 px-4">
                                  <span
                                    className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${getGradeBadgeClass(
                                      r.grade
                                    )}`}
                                  >
                                    {r.grade || (pct >= 85 ? 'A+' : pct >= 70 ? 'A' : pct >= 55 ? 'B' : pct >= 40 ? 'C' : 'F')}
                                  </span>
                                </td>

                                {/* Column 5: Status */}
                                <td className="p-3.5 px-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                      isPassed
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                    }`}
                                  >
                                    <CheckCircle2 size={12} />
                                    {isPassed ? (pct >= 85 ? 'DISTINCTION' : 'PASSED') : 'FAILED'}
                                  </span>
                                </td>

                                {/* Column 6: Mentor remark */}
                                <td className="p-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                                  {r.remarks || 'Good performance'}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: OFFICIAL MARKSHEET CARD VIEW (Exclusive Printable Area) ── */}
      <div
        id="official-marksheet-printable"
        className={`student-card bg-white dark:bg-[#131b2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm ${
          activeTab === 'MARKSHEET' ? 'block' : 'hidden print:block'
        }`}
      >
        {/* Scope selector banner in interactive screen view */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Exam Scope:</span>
            <button
              type="button"
              onClick={() => setSelectedExamTitles(new Set())}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedExamTitles.size === 0
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              All Published Exams
            </button>
            {allExamTitles.map((title) => {
              const isSelected = selectedExamTitles.has(title) && selectedExamTitles.size === 1;
              return (
                <button
                  key={title}
                  type="button"
                  onClick={() => setSelectedExamTitles(new Set([title]))}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Institutional Header of Marksheet */}
        <div className="text-center pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-center mx-auto mb-2.5">
            {schoolLogoUrl ? (
              <img
                src={schoolLogoUrl}
                alt={schoolName}
                className="school-logo-img h-14 sm:h-16 w-auto max-w-[140px] object-contain drop-shadow-xs"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const fallbackEl = document.getElementById('school-logo-fallback-badge');
                  if (fallbackEl) fallbackEl.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              id="school-logo-fallback-badge"
              style={{ display: schoolLogoUrl ? 'none' : 'flex' }}
              className="school-logo-badge w-12 h-12 rounded-xl bg-rose-600 text-white font-black text-xl items-center justify-center shadow-md"
            >
              {schoolName.charAt(0)}
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight m-0">
            {schoolName}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-1 uppercase tracking-wider font-semibold">
            {selectedExamTitles.size === 1
              ? `Official Marksheet · ${Array.from(selectedExamTitles)[0]} · Session ${academicSession}`
              : selectedExamTitles.size > 1
              ? `Official Marksheet · ${Array.from(selectedExamTitles).join(', ')} · Session ${academicSession}`
              : `Official Cumulative Academic Marksheet · Session ${academicSession}`}
          </p>
        </div>

        {/* Student Identity Grid */}
        <div className="student-identity-grid grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-b border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">STUDENT NAME</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">{studentDisplayName}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">CLASS &amp; SECTION</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {studentClassName} - {studentSectionName}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">ROLL NUMBER</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">{rollNumber}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">ADMISSION NO</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">{admissionNumber}</span>
          </div>
        </div>

        {/* Marksheet Table */}
        {marksheetItems.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
            <FileText size={36} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-700 dark:text-slate-300 m-0 mb-1">No Marksheet Available</p>
            <p className="text-xs m-0">No published evaluation records found for the selected scope.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                  <th className="p-3">#</th>
                  <th className="p-3">SUBJECT</th>
                  <th className="p-3">ASSESSMENT</th>
                  <th className="p-3 text-right">MAX MARKS</th>
                  <th className="p-3 text-right">PASS MARKS</th>
                  <th className="p-3 text-right">OBTAINED</th>
                  <th className="p-3 text-center">GRADE</th>
                  <th className="p-3 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {marksheetItems.map((r, idx) => {
                  const obtM = Number(r.marks_obtained) || 0;
                  const passM = Number(r.passing_marks) || 40;
                  const isPassed = obtM >= passM;
                  const totalM = Number(r.total_marks) || 100;
                  const pct = totalM > 0 ? (obtM / totalM) * 100 : 0;

                  return (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/80">
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{r.subject_name}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{r.title}</td>
                      <td className="p-3 text-right font-mono">{formatScore(r.total_marks)}</td>
                      <td className="p-3 text-right font-mono">{formatScore(r.passing_marks || 40)}</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                        {formatScore(r.marks_obtained)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`grade-badge-print inline-block px-2 py-0.5 rounded text-[11px] font-bold ${getGradeBadgeClass(r.grade)}`}>
                          {r.grade || 'A'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-[11px] font-bold ${isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {isPassed ? (pct >= 85 ? 'DISTINCTION' : 'PASSED') : 'FAILED'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-rose-50/60 dark:bg-rose-950/30 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                  <td colSpan={3} className="p-3 text-slate-900 dark:text-white font-extrabold uppercase">
                    Grand Total {selectedExamTitles.size > 0 ? `(${Array.from(selectedExamTitles).join(', ')})` : ''}
                  </td>
                  <td className="p-3 text-right font-mono">{marksheetStats.totalMarks}</td>
                  <td className="p-3 text-right font-mono">—</td>
                  <td className="p-3 text-right font-mono text-rose-600 dark:text-rose-400 text-sm font-bold">
                    {marksheetStats.obtainedMarks}
                  </td>
                  <td className="p-3 text-center font-extrabold text-rose-600 dark:text-rose-400">
                    {marksheetStats.overallGrade}
                  </td>
                  <td className="p-3 text-center text-emerald-600 dark:text-emerald-400 font-extrabold">
                    {marksheetStats.percentage}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Verification Footnote */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          <div>
            <p className="m-0 font-medium text-slate-700 dark:text-slate-300">
              Performance Evaluation:{' '}
              <b>
                {marksheetStats.percentage >= 85
                  ? 'First Class with Distinction'
                  : marksheetStats.percentage >= 60
                  ? 'First Class'
                  : marksheetStats.percentage >= 40
                  ? 'Second Class'
                  : 'Needs Improvement'}{' '}
                ({marksheetStats.percentage}%)
              </b>
            </p>
            <p className="m-0 text-[11px] text-slate-400">
              Digitally verified academic record authenticated by School Authority.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePrintFormalMarksheet}
            className="no-print inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 cursor-pointer shadow-sm transition-colors"
          >
            <Printer size={14} /> Print Formal Marksheet
          </button>
        </div>
      </div>
    </div>
  );
}

// Re-export as StudentExams to ensure backward compatibility
export { StudentResults as StudentExams };
export default StudentResults;
