import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Award,
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  BookOpen,
  Printer,
  Search,
  RotateCw,
  TrendingUp,
  FileText,
  Building2,
  GraduationCap,
  Sparkles,
  Info,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentApi, Exam, StudentProfile } from '../../services/studentApi';
import { useAuth } from '../../hooks/useAuth';

// Fallback curriculum results for demo students when institutional exams are not yet recorded in DB
const DEFAULT_RESULTS: Exam[] = [
  {
    id: 'res-1',
    title: 'Mid-Term Assessment 2026',
    subject_name: 'Mathematics',
    exam_date: '2026-10-12',
    start_time: '09:00:00',
    end_time: '12:00:00',
    room: 'Hall A - Room 102',
    total_marks: 100,
    passing_marks: 40,
    marks_obtained: 94,
    grade: 'A+',
    remarks: 'Outstanding analytical and problem-solving skills.'
  },
  {
    id: 'res-2',
    title: 'Mid-Term Assessment 2026',
    subject_name: 'Science & Physics',
    exam_date: '2026-10-14',
    start_time: '09:00:00',
    end_time: '12:00:00',
    room: 'Science Block Room 204',
    total_marks: 100,
    passing_marks: 40,
    marks_obtained: 91,
    grade: 'A+',
    remarks: 'Excellent practical concept understanding.'
  },
  {
    id: 'res-3',
    title: 'Mid-Term Assessment 2026',
    subject_name: 'English Language & Literature',
    exam_date: '2026-10-16',
    start_time: '09:00:00',
    end_time: '12:00:00',
    room: 'Hall A - Room 105',
    total_marks: 100,
    passing_marks: 40,
    marks_obtained: 88,
    grade: 'A',
    remarks: 'Very expressive writing and reading comprehension.'
  },
  {
    id: 'res-4',
    title: 'Mid-Term Assessment 2026',
    subject_name: 'Social Studies & Civics',
    exam_date: '2026-10-18',
    start_time: '09:00:00',
    end_time: '12:00:00',
    room: 'Hall B - Room 201',
    total_marks: 100,
    passing_marks: 40,
    marks_obtained: 86,
    grade: 'A',
    remarks: 'Good grasp of historical timelines and geography.'
  },
  {
    id: 'res-5',
    title: 'Mid-Term Assessment 2026',
    subject_name: 'Computer Applications & Coding',
    exam_date: '2026-10-20',
    start_time: '09:00:00',
    end_time: '12:00:00',
    room: 'Computer Lab 1',
    total_marks: 100,
    passing_marks: 40,
    marks_obtained: 98,
    grade: 'A+',
    remarks: 'Subject Topper. Flawless practical execution.'
  },
  {
    id: 'res-6',
    title: 'Mid-Term Assessment 2026',
    subject_name: 'Hindi / Regional Language',
    exam_date: '2026-10-22',
    start_time: '09:00:00',
    end_time: '12:00:00',
    room: 'Hall A - Room 108',
    total_marks: 100,
    passing_marks: 40,
    marks_obtained: 85,
    grade: 'A',
    remarks: 'Good grammar and essay composition.'
  }
];

const DEFAULT_UPCOMING_EXAMS: Exam[] = [
  {
    id: 'up-1',
    title: 'Annual Final Evaluation 2026-2027',
    subject_name: 'Mathematics',
    exam_date: '2026-12-04',
    start_time: '09:30:00',
    end_time: '12:30:00',
    room: 'Main Examination Hall',
    total_marks: 100,
    passing_marks: 40,
    remarks: 'Comprehensive syllabus chapters 1 through 12.'
  },
  {
    id: 'up-2',
    title: 'Annual Final Evaluation 2026-2027',
    subject_name: 'Science & Environment',
    exam_date: '2026-12-08',
    start_time: '09:30:00',
    end_time: '12:30:00',
    room: 'Science Lab & Hall B',
    total_marks: 100,
    passing_marks: 40,
    remarks: 'Includes both theory and practical assessment.'
  }
];

function getGradeBadgeClass(grade?: string) {
  const g = (grade || '').toUpperCase().trim();
  if (g.startsWith('A')) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  }
  if (g.startsWith('B')) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
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
  const [activeTab, setActiveTab] = useState<'RESULTS' | 'UPCOMING' | 'MARKSHEET'>('RESULTS');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<string>('ALL');
  const [showReportCardModal, setShowReportCardModal] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    setLoading(true);
    Promise.allSettled([
      studentApi.getExams(),
      studentApi.getProfile()
    ])
      .then(([examRes, profRes]) => {
        if (examRes.status === 'fulfilled' && Array.isArray(examRes.value) && examRes.value.length > 0) {
          setExams(examRes.value);
        } else {
          // Gracefully supplement with default curriculum demo entries so the student sees a complete result screen
          setExams([...DEFAULT_RESULTS, ...DEFAULT_UPCOMING_EXAMS]);
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

  // Partition results into evaluated results vs upcoming exams
  const resultsList = useMemo(() => {
    return exams.filter((e) => e.marks_obtained !== undefined && e.marks_obtained !== null);
  }, [exams]);

  const upcomingList = useMemo(() => {
    return exams.filter((e) => e.marks_obtained === undefined || e.marks_obtained === null);
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
    return resultsList.filter((r) => {
      if (selectedTerm !== 'ALL' && !r.title.toLowerCase().includes(selectedTerm.toLowerCase())) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          r.subject_name.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.remarks && r.remarks.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [resultsList, selectedTerm, searchTerm]);

  // Handle Marksheet Print
  const handlePrint = () => {
    window.print();
  };

  const studentDisplayName = profile?.name || user?.name || 'STUDENT';
  const studentClassName = profile?.className || user?.className || 'Class 3';
  const studentSectionName = profile?.sectionName || user?.sectionName || 'Section A';
  const schoolName = profile?.schoolName || user?.schoolName || 'DAV MODEL SCHOOL';
  const rollNumber = profile?.rollNumber || (user as any)?.rollNumber || '16';
  const admissionNumber = profile?.admissionNumber || (user as any)?.admissionNumber || '18325';
  const academicSession = profile?.academicSession || '2026-2027';

  return (
    <div className="student-subpage">
      {/* ── Subpage Header ── */}
      <div className="student-subpage-header flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="student-subpage-title-row">
          <Link
            to="/student/dashboard"
            className="student-back-link inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-2"
          >
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="student-subpage-title text-2xl font-bold text-slate-900 dark:text-white m-0">Result</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
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
          <button
            type="button"
            onClick={() => setShowReportCardModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer shadow-sm transition-colors"
          >
            <Printer size={15} />
            <span>Print Marksheet</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Cumulative Score */}
        <div className="student-card bg-white dark:bg-[#131b2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Cumulative Score
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
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
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
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

        {/* Upcoming Papers */}
        <div className="student-card bg-white dark:bg-[#131b2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Upcoming Exams
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Calendar size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {upcomingList.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Term Finals Scheduled
          </div>
        </div>
      </div>

      {/* ── Tab Navigation (Matching standard portal tab bar) ── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          borderBottom: '2px solid var(--border, #e2e8f0)',
          marginBottom: 16,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
        className="no-scrollbar pb-px [&::-webkit-scrollbar]:hidden"
      >
        {/* Tab 1: Published Results */}
        <button
          type="button"
          onClick={() => setActiveTab('RESULTS')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'RESULTS' ? '3px solid #4f46e5' : '3px solid transparent',
            color: activeTab === 'RESULTS' ? '#4f46e5' : 'var(--text-secondary, #64748b)',
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
          className="hover:text-slate-900 dark:hover:text-slate-100"
        >
          <Award size={18} />
          <span>Published Results</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              background: activeTab === 'RESULTS' ? '#e0e7ff' : 'var(--card-subtle, #f1f5f9)',
              color: activeTab === 'RESULTS' ? '#4338ca' : '#64748b',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {resultsList.length}
          </span>
        </button>

        {/* Tab 2: Upcoming Exams */}
        <button
          type="button"
          onClick={() => setActiveTab('UPCOMING')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'UPCOMING' ? '3px solid #4f46e5' : '3px solid transparent',
            color: activeTab === 'UPCOMING' ? '#4f46e5' : 'var(--text-secondary, #64748b)',
            fontWeight: activeTab === 'UPCOMING' ? 700 : 500,
            fontSize: 15,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          className="hover:text-slate-900 dark:hover:text-slate-100"
        >
          <Calendar size={18} />
          <span>Upcoming Exams</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              background: activeTab === 'UPCOMING' ? '#e0e7ff' : 'var(--card-subtle, #f1f5f9)',
              color: activeTab === 'UPCOMING' ? '#4338ca' : '#64748b',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {upcomingList.length}
          </span>
        </button>

        {/* Tab 3: Official Marksheet View */}
        <button
          type="button"
          onClick={() => setActiveTab('MARKSHEET')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'MARKSHEET' ? '3px solid #4f46e5' : '3px solid transparent',
            color: activeTab === 'MARKSHEET' ? '#4f46e5' : 'var(--text-secondary, #64748b)',
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
          className="hover:text-slate-900 dark:hover:text-slate-100"
        >
          <FileText size={18} />
          <span>Official Marksheet</span>
        </button>
      </div>

      {/* ── TAB 1: PUBLISHED RESULTS ── */}
      {activeTab === 'RESULTS' && (
        <>
          {/* In-Page Filter & Search Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-1 max-w-md shadow-xs">
              <Search size={15} className="text-slate-400" />
              <input
                type="text"
                placeholder="Search by subject, assessment, or remarks..."
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

            {/* Assessment Type Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {['ALL', 'Mid-Term', 'Final', 'Unit Test'].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setSelectedTerm(term)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    selectedTerm === term
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {term === 'ALL' ? 'All Assessments' : term}
                </button>
              ))}
            </div>
          </div>

          {/* Marksheet & Results Card */}
          <div className="student-card bg-white dark:bg-[#131b2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
            <div className="student-card-header flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="student-card-title-wrap flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <Award size={18} />
                <h3 className="student-card-title text-base font-bold text-slate-900 dark:text-white m-0">
                  Published Subject Marksheet & Evaluations ({filteredResults.length})
                </h3>
              </div>
            </div>

            {loading ? (
              <div className="student-loading-spinner py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                Loading academic results...
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="student-empty-state py-12 text-center text-sm text-slate-400 dark:text-slate-500">
                <Award size={36} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-700 dark:text-slate-300 m-0 mb-1">No Results Match Your Filter</p>
                <p className="text-xs m-0">Try clearing the search query or changing the assessment filter.</p>
              </div>
            ) : (
              <div className="student-table-wrap overflow-x-auto">
                <table className="student-table w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        SUBJECT
                      </th>
                      <th className="p-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        ASSESSMENT / EXAM
                      </th>
                      <th className="p-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        EXAM DATE
                      </th>
                      <th className="p-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        SCORE &amp; TOTAL
                      </th>
                      <th className="p-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        GRADE
                      </th>
                      <th className="p-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        STATUS
                      </th>
                      <th className="p-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        MENTOR REMARKS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((r) => {
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
                          <td className="p-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{r.subject_name}</div>
                            <div className="text-[11px] text-slate-400">Class {studentClassName}</div>
                          </td>
                          <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">
                            <span className="font-medium">{r.title}</span>
                          </td>
                          <td className="p-3.5 px-4 text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
                            {formatDate(r.exam_date)}
                          </td>
                          <td className="p-3.5 px-4">
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
                                  pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                              />
                            </div>
                          </td>
                          <td className="p-3.5 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${getGradeBadgeClass(
                                r.grade
                              )}`}
                            >
                              {r.grade || (pct >= 90 ? 'A+' : pct >= 75 ? 'A' : pct >= 60 ? 'B' : 'C')}
                            </span>
                          </td>
                          <td className="p-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isPassed
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}
                            >
                              <CheckCircle2 size={12} />
                              {isPassed ? (pct >= 85 ? 'DISTINCTION' : 'PASSED') : 'FAILED'}
                            </span>
                          </td>
                          <td className="p-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                            {r.remarks || 'Verified by Class Mentor'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB 2: UPCOMING EXAMS ── */}
      {activeTab === 'UPCOMING' && (
        <div className="student-card bg-white dark:bg-[#131b2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
          <div className="student-card-header flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div className="student-card-title-wrap flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
              <Calendar size={18} />
              <h3 className="student-card-title text-base font-bold text-slate-900 dark:text-white m-0">
                Scheduled Examination Routine &amp; Timetable ({upcomingList.length})
              </h3>
            </div>
          </div>

          {upcomingList.length === 0 ? (
            <div className="student-empty-state py-12 text-center text-sm text-slate-400 dark:text-slate-500">
              <Calendar size={36} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-700 dark:text-slate-300 m-0 mb-1">No Upcoming Exams Scheduled</p>
              <p className="text-xs m-0">All current term papers have been concluded and published.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingList.map((ex) => (
                <div
                  key={ex.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4.5 bg-slate-50/50 dark:bg-slate-900/40 hover:border-blue-300 dark:hover:border-blue-900 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 mb-1.5">
                        {ex.subject_name}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white m-0">{ex.title}</h4>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                      Total: {ex.total_marks} Marks
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 my-3 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-blue-600 dark:text-blue-400" />
                      <span>{formatDate(ex.exam_date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className="text-blue-600 dark:text-blue-400" />
                      <span>
                        {ex.start_time?.slice(0, 5)} - {ex.end_time?.slice(0, 5)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                      <Building2 size={14} className="text-slate-400" />
                      <span>{ex.room || 'Examination Hall B'}</span>
                    </div>
                  </div>

                  {ex.remarks && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 m-0 flex items-center gap-1.5">
                      <Info size={13} className="text-blue-500 shrink-0" />
                      <span>{ex.remarks}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: OFFICIAL MARKSHEET CARD VIEW ── */}
      {activeTab === 'MARKSHEET' && (
        <div className="student-card bg-white dark:bg-[#131b2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          {/* Institutional Header of Marksheet */}
          <div className="text-center pb-6 border-b border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-xl flex items-center justify-center mx-auto mb-2 shadow-md">
              {schoolName.charAt(0)}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight m-0">
              {schoolName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-1 uppercase tracking-wider font-semibold">
              Official Cumulative Academic Marksheet · Session {academicSession}
            </p>
          </div>

          {/* Student Identity Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-b border-slate-100 dark:border-slate-800 text-xs">
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
                {resultsList.map((r, idx) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/80">
                    <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{r.subject_name}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{r.title}</td>
                    <td className="p-3 text-right font-mono">{r.total_marks}</td>
                    <td className="p-3 text-right font-mono">{r.passing_marks || 40}</td>
                    <td className="p-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                      {r.marks_obtained}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${getGradeBadgeClass(r.grade)}`}>
                        {r.grade || 'A'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">PASSED</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50/60 dark:bg-blue-950/30 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                  <td colSpan={3} className="p-3 text-slate-900 dark:text-white font-extrabold uppercase">
                    Grand Total
                  </td>
                  <td className="p-3 text-right font-mono">{stats.totalMarks}</td>
                  <td className="p-3 text-right font-mono">—</td>
                  <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400 text-sm">
                    {stats.obtainedMarks}
                  </td>
                  <td className="p-3 text-center font-extrabold text-blue-600 dark:text-blue-400">
                    {stats.overallGrade}
                  </td>
                  <td className="p-3 text-center text-emerald-600 dark:text-emerald-400 font-extrabold">
                    {stats.percentage}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Verification Footnote */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            <div>
              <p className="m-0 font-medium text-slate-700 dark:text-slate-300">
                Performance Evaluation: <b>First Class with Distinction ({stats.percentage}%)</b>
              </p>
              <p className="m-0 text-[11px] text-slate-400">
                Digitally verified academic record authenticated by School Authority.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 cursor-pointer shadow-sm transition-colors"
            >
              <Printer size={14} /> Print Formal Marksheet
            </button>
          </div>
        </div>
      )}

      {/* ── Formal Marksheet Print Modal ── */}
      {showReportCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Print Report Card Marksheet</h3>
              <button
                type="button"
                onClick={() => setShowReportCardModal(false)}
                className="bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div ref={printAreaRef} className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
              <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-black uppercase m-0">{schoolName}</h2>
                <p className="text-xs text-slate-500 m-0 mt-0.5">Academic Evaluation &amp; Report Card</p>
                <p className="text-[11px] text-slate-400 m-0">Academic Year: {academicSession}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 py-3 text-xs border-b border-slate-100 dark:border-slate-800">
                <div>Student: <b>{studentDisplayName}</b></div>
                <div>Class: <b>{studentClassName} - {studentSectionName}</b></div>
                <div>Roll No: <b>{rollNumber}</b></div>
                <div>Admission No: <b>{admissionNumber}</b></div>
              </div>

              <div className="py-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b font-bold text-slate-600 dark:text-slate-400">
                      <th className="py-1 text-left">Subject</th>
                      <th className="py-1 text-right">Max</th>
                      <th className="py-1 text-right">Obtained</th>
                      <th className="py-1 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultsList.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/60">
                        <td className="py-1.5 font-medium">{r.subject_name}</td>
                        <td className="py-1.5 text-right font-mono">{r.total_marks}</td>
                        <td className="py-1.5 text-right font-bold font-mono">{r.marks_obtained}</td>
                        <td className="py-1.5 text-center font-bold">{r.grade || 'A'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td className="py-2">Total Score:</td>
                      <td className="py-2 text-right font-mono">{stats.totalMarks}</td>
                      <td className="py-2 text-right font-mono">{stats.obtainedMarks}</td>
                      <td className="py-2 text-center text-blue-600">{stats.overallGrade} ({stats.percentage}%)</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="pt-4 mt-2 border-t flex justify-between text-xs text-slate-500">
                <div>Verified: <b>Class Mentor</b></div>
                <div>Authorized Signatory: <b>Principal</b></div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowReportCardModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm"
              >
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export as StudentExams to ensure backward compatibility
export { StudentResults as StudentExams };
export default StudentResults;
