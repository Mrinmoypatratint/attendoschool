import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CalendarCheck,
  FileCheck,
  GraduationCap,
  Megaphone,
  Clock,
  ChevronRight,
  ArrowRight,
  CheckSquare,
  Trophy,
  ChevronLeft,
  BookOpen,
  FlaskConical,
  BookMarked,
  Award,
  CheckCircle2,
  Building2,
  PartyPopper
} from 'lucide-react';
import { api } from '../../api';
import { studentApi, StudentDashboardData } from '../../services/studentApi';
import { useAuth } from '../../hooks/useAuth';

function getHolidayCategoryStyle(type?: string) {
  switch (type) {
    case 'NATIONAL':
      return { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', label: 'National Holiday' };
    case 'FESTIVAL':
      return { background: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe', label: 'Festival Holiday' };
    case 'GAZETTED':
      return { background: '#e0e7ff', color: '#3730a3', border: '1px solid #a5b4fc', label: 'Gazetted Holiday' };
    case 'REGIONAL':
      return { background: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4', label: 'Regional Holiday' };
    case 'INSTITUTIONAL':
      return { background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', label: 'Institutional Break' };
    default:
      return { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', label: type || 'Holiday' };
  }
}

function isTeacherNotice(a: any): boolean {
  if (a.author_role === 'TEACHER' || a.created_by_role === 'TEACHER') return true;
  const author = (a.author_name || '').toLowerCase();
  if (author.includes('school admin') || author.includes('dav admin') || author.includes('administration') || author.includes('principal') || author.includes('management')) {
    return false;
  }
  const role = (a.author_role || a.created_by_role || '').toUpperCase();
  if (['SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
    return false;
  }
  if (a.author_name && !author.includes('admin') && !author.includes('administration')) {
    return true;
  }
  return false;
}

export function StudentDashboard() {
  const { user: authUser } = useAuth();
  const cacheKey = authUser?.id ? `cached_student_dashboard_${authUser.id}` : null;

  const [data, setData] = useState<StudentDashboardData | null>(() => {
    try {
      if (!cacheKey) return null;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Validate cached data belongs to the current user
        if (parsed?.student?.id && authUser?.studentId && parsed.student.id !== authUser.studentId) {
          sessionStorage.removeItem(cacheKey);
          return null;
        }
        return parsed;
      }
    } catch { }
    return null;
  });
  const [loading, setLoading] = useState(() => !data);
  const [error, setError] = useState('');

  // Dynamic Mini Calendar state - must be declared at top level to obey Rules of Hooks
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [holidays, setHolidays] = useState<any[]>([]);

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await api.get('/calendar/holidays');
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setHolidays(res.data.data);
      } else if (Array.isArray(res.data)) {
        setHolidays(res.data);
      }
    } catch (err) {
      console.warn('[StudentDashboard] Could not fetch calendar holidays:', err);
    }
  }, []);

  const fetchDashboard = useCallback((showSpinner = false) => {
    if (showSpinner && !data) setLoading(true);
    studentApi
      .getDashboard()
      .then((res) => {
        setData(res);
        try {
          if (cacheKey) {
            Object.keys(sessionStorage).forEach(key => {
              if (key.startsWith('cached_student_dashboard_') && key !== cacheKey) {
                sessionStorage.removeItem(key);
              }
            });
            sessionStorage.setItem(cacheKey, JSON.stringify(res));
          }
        } catch { }
        setLoading(false);
      })
      .catch((err) => {
        if (!data) {
          setError(err?.response?.data?.message || 'Failed to load dashboard data');
        }
        setLoading(false);
      });
  }, [cacheKey, data]);

  useEffect(() => {
    fetchDashboard(false);
    fetchHolidays();
    const handleRefresh = () => {
      fetchDashboard(false);
      fetchHolidays();
    };
    window.addEventListener('announcements-read', handleRefresh);
    window.addEventListener('calendarHolidaysChanged', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('storage', handleRefresh);
    return () => {
      window.removeEventListener('announcements-read', handleRefresh);
      window.removeEventListener('calendarHolidaysChanged', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('storage', handleRefresh);
    };
  }, [fetchDashboard, fetchHolidays]);

  if (loading) {
    return (
      <div className="student-loading-wrap">
        <div className="student-skeleton-hero" />
        <div className="student-skeleton-kpis">
          <div className="student-skeleton-card" />
          <div className="student-skeleton-card" />
          <div className="student-skeleton-card" />
          <div className="student-skeleton-card" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="student-error-box p-8 text-center rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 max-w-md mx-auto my-12">
        <h3 className="text-lg font-bold text-red-700 dark:text-red-400 m-0 mb-2">Unable to load dashboard</h3>
        <p className="text-xs text-red-600 dark:text-red-300 m-0 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="student-btn-primary px-4 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors shadow-sm">
          Retry
        </button>
      </div>
    );
  }

  const student = data?.student;
  const kpis = data?.kpis;
  const timetable = data?.todayTimetable || [];
  const announcements = data?.announcements || [];
  const assignments = data?.pendingAssignments || [];
  const recentAttendance = data?.recentAttendance || [];

  const today = new Date();

  const calYear = calendarViewDate.getFullYear();
  const calMonth = calendarViewDate.getMonth();

  const calMonthName = calendarViewDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const handlePrevMonth = () => {
    setCalendarViewDate(new Date(calYear, calMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarViewDate(new Date(calYear, calMonth + 1, 1));
  };

  const handleResetToday = () => {
    const now = new Date();
    setCalendarViewDate(now);
    setSelectedDate(now);
  };

  const isViewingCurrentMonth =
    calYear === today.getFullYear() && calMonth === today.getMonth();

  // First day of current month (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
  const daysInCurrentMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

  // Previous month trailing padding days
  const prevMonthDays: number[] = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    prevMonthDays.push(daysInPrevMonth - i);
  }

  // Next month leading padding days (fill consistent 35 or 42 grid cells)
  const totalOccupied = prevMonthDays.length + daysInCurrentMonth;
  const targetTotalCells = totalOccupied <= 35 ? 35 : 42;
  const nextMonthDaysCount = targetTotalCells - totalOccupied;
  const nextMonthDays: number[] = [];
  for (let i = 1; i <= nextMonthDaysCount; i++) {
    nextMonthDays.push(i);
  }

  // Map attendance dots for the current month
  const attendanceDayMap = new Map<number, 'Present' | 'Absent'>();
  if (recentAttendance && Array.isArray(recentAttendance)) {
    recentAttendance.forEach((rec) => {
      try {
        const d = new Date(rec.date);
        if (!isNaN(d.getTime()) && d.getFullYear() === calYear && d.getMonth() === calMonth) {
          attendanceDayMap.set(d.getDate(), rec.status);
        }
      } catch { }
    });
  }

  // Map declared holidays
  const holidayMap = useMemo(() => {
    const map = new Map<string, any>();
    holidays.forEach((h: any) => {
      if (h.is_active !== false && h.holiday_date) {
        const dateKey = String(h.holiday_date).slice(0, 10);
        map.set(dateKey, h);
      }
    });
    return map;
  }, [holidays]);

  // Upcoming exam indicator for current month
  let examDayInMonth: number | null = null;
  if (data?.upcomingExam?.date) {
    try {
      const ed = new Date(data.upcomingExam.date);
      if (!isNaN(ed.getTime()) && ed.getFullYear() === calYear && ed.getMonth() === calMonth) {
        examDayInMonth = ed.getDate();
      }
    } catch { }
  }

  // Dynamic greeting based on current local hour (reused for synchronized visual theme)
  const currentHour = new Date().getHours();
  const isMorning = currentHour >= 5 && currentHour < 12;
  const isAfternoon = currentHour >= 12 && currentHour < 17;
  const isEvening = currentHour >= 17 && currentHour < 21;

  const greetingText = isMorning
    ? 'Good Morning'
    : isAfternoon
    ? 'Good Afternoon'
    : isEvening
    ? 'Good Evening'
    : 'Good Night';

  const greetingEmoji = (currentHour >= 21 || currentHour < 5) ? '🌙' : '👋';

  const visualThemeClass = isMorning
    ? 'student-visual-morning'
    : isAfternoon
    ? 'student-visual-afternoon'
    : isEvening
    ? 'student-visual-evening'
    : 'student-visual-night';

  const visualLabels = isMorning
    ? ['LEARN', 'GROW', 'BELONG']
    : isAfternoon
    ? ['FOCUS', 'EXCEL', 'BELONG']
    : isEvening
    ? ['REFLECT', 'REVIEW', 'REST']
    : ['REST', 'RECHARGE', 'DREAM'];

  return (
    <div className="student-dashboard-page">
      {/* Top Hero Showcase */}
      <section className="student-hero-banner">
        <div className="student-hero-content">
          <div className="student-greeting-row">
            <h1 className="student-greeting-title">
              {greetingText}, <span className="student-greeting-name">{String(student?.name || authUser?.name || 'STUDENT').toUpperCase()}</span> {greetingEmoji}
            </h1>
          </div>
          <div className="student-greeting-meta flex items-center flex-wrap gap-2 mt-2">
            <span className="student-meta-pill">{(student?.className || authUser?.className) ? `${student?.className || authUser?.className} · Section ${student?.sectionName || authUser?.sectionName || 'A'}` : 'Enrolled'}</span>
            <span className="student-meta-pill">Roll #{student?.rollNumber || authUser?.rollNumber || '—'}</span>
            {student?.admissionNumber && (
              <span className="student-meta-pill tracking-wide font-semibold">Adm: {student.admissionNumber}</span>
            )}
          </div>
        </div>

        <div className={`student-hero-quote-card ${visualThemeClass}`}>
          <div className="student-quote-text-side">
            <p className="student-hero-quote">
              "Consistent effort today leads to success tomorrow."
            </p>
          </div>
          <div className="student-quote-img-side">
            <img src="/educational_student_campus.jpg" alt="Campus" className="student-campus-thumb" />
            <div className="student-campus-overlay">
              {visualLabels.map((lbl, idx) => (
                <span key={idx}>{lbl}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4 KPI Summary Cards */}
      <section className="student-kpi-grid">
        {/* Attendance KPI */}
        <Link to="/student/attendance" className="student-kpi-card attendance-kpi">
          <div className="student-kpi-card-top">
            <div className="student-kpi-icon-wrap green-icon">
              <CalendarCheck size={20} />
            </div>
            <span className="student-kpi-label">Attendance</span>
            <ChevronRight size={15} className="student-kpi-chevron" />
          </div>
          <div className="student-kpi-body">
            <div className="student-kpi-value">{kpis?.attendancePercentage ?? 92}%</div>
            <div className="student-kpi-sub">{kpis?.attendanceText || 'Present: 138 / 150 days'}</div>
          </div>
        </Link>

        {/* Assignments KPI */}
        <Link to="/student/assignments" className="student-kpi-card assignments-kpi">
          <div className="student-kpi-card-top">
            <div className="student-kpi-icon-wrap blue-icon">
              <FileCheck size={20} />
            </div>
            <span className="student-kpi-label">Assignments</span>
            <ChevronRight size={15} className="student-kpi-chevron" />
          </div>
          <div className="student-kpi-body">
            <div className="student-kpi-value">{kpis?.pendingAssignmentsCount ?? 5}</div>
            <div className="student-kpi-sub">Pending submissions</div>
          </div>
        </Link>

        {/* Result KPI */}
        <Link to="/student/results" className="student-kpi-card exams-kpi">
          <div className="student-kpi-card-top">
            <div className="student-kpi-icon-wrap coral-icon">
              <Award size={20} />
            </div>
            <span className="student-kpi-label">Result</span>
            <ChevronRight size={15} className="student-kpi-chevron" />
          </div>
          <div className="student-kpi-body">
            <div className="student-kpi-value student-kpi-value-sm">Marksheet &amp; Grades</div>
            <div className="student-kpi-sub">Official academic evaluation</div>
          </div>
        </Link>

        {/* Announcements KPI */}
        <Link to="/student/announcements" className="student-kpi-card announcements-kpi">
          <div className="student-kpi-card-top">
            <div className="student-kpi-icon-wrap purple-icon">
              <Megaphone size={20} />
            </div>
            <span className="student-kpi-label">Announcements</span>
            <ChevronRight size={15} className="student-kpi-chevron" />
          </div>
          <div className="student-kpi-body">
            <div className="student-kpi-value">{kpis?.announcementsCount ?? 3}</div>
            <div className="student-kpi-sub">New updates</div>
          </div>
        </Link>
      </section>

      {/* Main Multi-Column Content Grid */}
      <div className="student-main-grid">
        {/* Left / Center Column */}
        <div className="student-grid-col-left">
          {/* Today's Timetable Card */}
          <div className="student-card student-timetable-card">
            <div className="student-card-header">
              <div className="student-card-title-wrap">
                <Clock size={18} className="student-card-title-icon" />
                <h3 className="student-card-title">Today's Timetable</h3>
              </div>
              <Link to="/student/timetable" className="student-card-action-link">
                Full Timetable <ArrowRight size={14} />
              </Link>
            </div>

            {/* Desktop Table View */}
            <div className="student-table-wrap student-desktop-timetable">
              <table className="student-table">
                <thead>
                  <tr>
                    <th>PERIOD</th>
                    <th>TIME</th>
                    <th>SUBJECT</th>
                    <th>TEACHER</th>
                    <th>ROOM</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {timetable.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 px-3 text-slate-500 dark:text-slate-400">
                        No classes scheduled for today
                      </td>
                    </tr>
                  ) : (
                    timetable.map((t) => (
                      <tr key={t.periodNumber}>
                        <td className="period-cell">{t.periodNumber}</td>
                        <td className="time-cell">{t.time}</td>
                        <td className="subject-cell font-semibold">{t.subject}</td>
                        <td className="teacher-cell">{t.teacher}</td>
                        <td className="room-cell">{t.room}</td>
                        <td>
                          <span className={`student-status-badge status-${t.status.toLowerCase()}`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Schedule Timeline View */}
            <div className="student-mobile-timetable">
              {timetable.length === 0 ? (
                <div className="text-center py-5 px-2.5 text-slate-500 text-xs">
                  No classes scheduled for today 🎉
                </div>
              ) : (
                timetable.map((t) => (
                  <div key={t.periodNumber} className="student-period-card">
                    <div className="student-period-top">
                      <span className="student-period-num">Period {t.periodNumber}</span>
                      <span className={`student-status-badge status-${t.status.toLowerCase()}`}>
                        {t.status}
                      </span>
                    </div>
                    <div className="student-period-subject">{t.subject}</div>
                    <div className="student-period-meta">
                      <span>{t.time}</span>
                      <span>•</span>
                      <span>{t.teacher}</span>
                      <span>•</span>
                      <span>Room {t.room}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dual Widget Row: Announcements & Pending Tasks */}
          <div className="student-dual-widget-row">
            {/* Latest Announcements */}
            <div className="student-card student-announcements-card">
              <div className="student-card-header">
                <div className="student-card-title-wrap">
                  <Megaphone size={18} className="student-card-title-icon" />
                  <h3 className="student-card-title">Latest Announcements</h3>
                </div>
                <Link to="/student/announcements" className="student-card-action-link">
                  View All <ArrowRight size={14} />
                </Link>
              </div>

              <div className="student-list">
                {announcements.length === 0 ? (
                  <div className="text-center py-6 px-4 text-slate-500">
                    <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1.5 block" />
                    <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">All caught up!</div>
                    <p className="m-0 mt-1 text-[11px] text-slate-400">You have read all current school announcements.</p>
                  </div>
                ) : (
                  announcements.map((a, i) => (
                    <Link to="/student/announcements" key={a.id || i} className="student-announcement-item">
                      <div className={`student-item-icon-bubble ${i === 0 ? 'blue-bubble' : i === 1 ? 'green-bubble' : 'coral-bubble'}`}>
                        {i === 0 ? <BookOpen size={16} /> : i === 1 ? <FlaskConical size={16} /> : <CalendarCheck size={16} />}
                      </div>
                      <div className="student-item-info">
                        <div className="student-item-headline">
                          <span className="student-item-title">{a.title}</span>
                          <span className="student-item-date">{a.date}</span>
                        </div>
                        <div style={{ marginTop: 2, marginBottom: 2 }}>
                          {isTeacherNotice(a) ? (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1.5px 6px',
                              borderRadius: 4,
                              backgroundColor: "var(--secondary)",
                              color: "var(--success)",
                              border: "1px solid var(--border)",
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3.5
                            }}>
                              <GraduationCap size={10} /> Teacher: {a.author_name || 'Teacher'}
                            </span>
                          ) : (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1.5px 6px',
                              borderRadius: 4,
                              backgroundColor: "var(--card)",
                              color: "var(--primary)",
                              border: "1px solid var(--border)",
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3.5
                            }}>
                              <Building2 size={10} /> By School Admin
                            </span>
                          )}
                        </div>
                        <p className="student-item-desc">{a.description}</p>
                      </div>
                      <ChevronRight size={16} className="student-item-chevron" />
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Pending Tasks */}
            <div className="student-card student-tasks-card">
              <div className="student-card-header">
                <div className="student-card-title-wrap">
                  <CheckSquare size={18} className="student-card-title-icon" />
                  <h3 className="student-card-title">Pending Tasks</h3>
                </div>
                <Link to="/student/assignments" className="student-card-action-link">
                  View All <ArrowRight size={14} />
                </Link>
              </div>

              <div className="student-list">
                {assignments.length === 0 ? (
                  <div className="text-center py-4 px-2 text-xs text-slate-500">
                    No pending assignments. All caught up! 🎉
                  </div>
                ) : (
                  assignments.map((t, i) => (
                    <Link to="/student/assignments" key={t.id || i} className="student-task-item">
                      <div className={`student-item-icon-bubble ${i === 0 ? 'purple-bubble' : i === 1 ? 'amber-bubble' : 'blue-bubble'}`}>
                        {i === 0 ? <FileCheck size={16} /> : i === 1 ? <BookMarked size={16} /> : <FlaskConical size={16} />}
                      </div>
                      <div className="student-item-info">
                        <span className="student-item-title">{t.title}</span>
                        <span className="student-item-sub">Due: {t.dueDate}</span>
                      </div>
                      <span className="student-countdown-pill">{t.daysLeft}</span>
                      <ChevronRight size={16} className="student-item-chevron" />
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar Column */}
        <div className="student-grid-col-right">
          {/* Mini Calendar Widget */}
          <div className="student-card student-calendar-card">
            <div className="student-calendar-header">
              <div className="student-calendar-title-wrap">
                <Calendar size={18} />
                <span className="student-calendar-month">{calMonthName}</span>
              </div>
              <div className="student-calendar-nav">
                {!isViewingCurrentMonth && (
                  <button
                    type="button"
                    onClick={handleResetToday}
                    className="student-cal-today-btn"
                    title="Jump to today"
                  >
                    Today
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                  title="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="Next month"
                  title="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="student-calendar-grid">
              <div className="cal-day-header">Sun</div>
              <div className="cal-day-header">Mon</div>
              <div className="cal-day-header">Tue</div>
              <div className="cal-day-header">Wed</div>
              <div className="cal-day-header">Thu</div>
              <div className="cal-day-header">Fri</div>
              <div className="cal-day-header">Sat</div>

              {/* Previous month padding days */}
              {prevMonthDays.map((d) => (
                <div
                  key={`prev-${d}`}
                  className="cal-date muted cursor-pointer"
                  onClick={() => {
                    const newD = new Date(calYear, calMonth - 1, d);
                    setCalendarViewDate(newD);
                    setSelectedDate(newD);
                  }}
                >
                  {d}
                </div>
              ))}

              {/* Current month days */}
              {Array.from({ length: daysInCurrentMonth }, (_, idx) => {
                const dayNum = idx + 1;
                const isToday =
                  today.getFullYear() === calYear &&
                  today.getMonth() === calMonth &&
                  today.getDate() === dayNum;
                const isSelected =
                  selectedDate.getFullYear() === calYear &&
                  selectedDate.getMonth() === calMonth &&
                  selectedDate.getDate() === dayNum;

                const dayDateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const dayHoliday = holidayMap.get(dayDateStr);

                const isActive = isSelected;
                const attStatus = attendanceDayMap.get(dayNum);
                const isExam = examDayInMonth === dayNum;

                let dotClass = '';
                if (dayHoliday) {
                  dotClass = 'dot-holiday is-holiday';
                } else if (isExam) {
                  dotClass = 'dot-exam';
                } else if (attStatus === 'Present') {
                  dotClass = 'dot-present';
                } else if (attStatus === 'Absent') {
                  dotClass = 'dot-absent';
                }

                const classes = [
                  'cal-date',
                  'cursor-pointer',
                  isActive ? 'active-date' : '',
                  isToday && !isActive ? 'today-date' : '',
                  dotClass
                ].filter(Boolean).join(' ');

                const tooltip = dayHoliday
                  ? `${dayNum} ${calMonthName} · 🎉 ${dayHoliday.name} (${dayHoliday.holiday_type || 'Holiday'})`
                  : isToday
                  ? `Today (${dayNum} ${calMonthName})`
                  : `${dayNum} ${calMonthName}`;

                return (
                  <div
                    key={dayNum}
                    className={classes}
                    onClick={() => setSelectedDate(new Date(calYear, calMonth, dayNum))}
                    title={tooltip}
                  >
                    {dayNum}
                  </div>
                );
              })}

              {/* Next month padding days */}
              {nextMonthDays.map((d) => (
                <div
                  key={`next-${d}`}
                  className="cal-date muted cursor-pointer"
                  onClick={() => {
                    const newD = new Date(calYear, calMonth + 1, d);
                    setCalendarViewDate(newD);
                    setSelectedDate(newD);
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Selected Date Details Panel */}
            {(() => {
              const selYear = selectedDate.getFullYear();
              const selMonth = selectedDate.getMonth();
              const selDay = selectedDate.getDate();
              const selDateKey = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`;
              const selHoliday = holidayMap.get(selDateKey);
              const isSelSunday = selectedDate.getDay() === 0;
              const isSelToday = selectedDate.toDateString() === today.toDateString();
              const selAtt = attendanceDayMap.get(selDay);
              const isSelExam = examDayInMonth === selDay && selMonth === calMonth && selYear === calYear;

              const formattedSelDate = selectedDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              if (selHoliday) {
                const catStyle = getHolidayCategoryStyle(selHoliday.holiday_type);
                return (
                  <div className="student-selected-day-panel holiday-day">
                    <div className="student-selected-day-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <PartyPopper size={16} style={{ color: '#d97706' }} />
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text, #0f172a)' }}>
                          {formattedSelDate}
                        </span>
                        {isSelToday && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#dbeafe', color: '#1d4ed8' }}>
                            Today
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, ...catStyle }}>
                        {catStyle.label || selHoliday.holiday_type || 'Holiday'}
                      </span>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                        {selHoliday.name}
                      </div>
                      {selHoliday.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginTop: 2 }}>
                          {selHoliday.description}
                        </div>
                      )}
                      <div style={{ fontSize: 11.5, color: '#d97706', marginTop: 4, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>🎉</span> School Closed · Declared Holiday
                      </div>
                    </div>
                  </div>
                );
              }

              if (isSelSunday) {
                return (
                  <div className="student-selected-day-panel weekend-day">
                    <div className="student-selected-day-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={15} style={{ color: '#64748b' }} />
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text, #0f172a)' }}>
                          {formattedSelDate}
                        </span>
                        {isSelToday && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#dbeafe', color: '#1d4ed8' }}>
                            Today
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: 'rgba(100, 116, 139, 0.1)', color: '#64748b' }}>
                        Weekend
                      </span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary, #64748b)' }}>
                      Sunday · Weekly Off (School is closed)
                    </div>
                  </div>
                );
              }

              return (
                <div className="student-selected-day-panel">
                  <div className="student-selected-day-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CalendarCheck size={15} style={{ color: '#2563eb' }} />
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text, #0f172a)' }}>
                        {formattedSelDate}
                      </span>
                      {isSelToday && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#dbeafe', color: '#1d4ed8' }}>
                          Today
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                      Working Day
                    </span>
                  </div>
                  {isSelExam ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                      📝 Upcoming Examination scheduled on this date
                    </div>
                  ) : selAtt ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: selAtt === 'Present' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      Attendance: {selAtt} {selAtt === 'Present' ? '✓' : '✗'}
                    </div>
                  ) : (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                      Regular school day · Classes in session
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Recent Attendance Widget */}
          <div className="student-card student-recent-attendance-card">
            <div className="student-card-header">
              <div className="student-card-title-wrap">
                <Clock size={18} className="student-card-title-icon" />
                <h3 className="student-card-title">Recent Attendance</h3>
              </div>
              <Link to="/student/attendance" className="student-card-action-link">
                View All <ArrowRight size={14} />
              </Link>
            </div>

            <div className="student-recent-attendance-list">
              {recentAttendance.length === 0 ? (
                <div className="text-center py-4 px-2 text-xs text-slate-500">
                  No recent attendance records
                </div>
              ) : (
                recentAttendance.map((rec, i) => (
                  <div key={i} className="student-recent-att-row">
                    <span className="student-att-date">{rec.date}</span>
                    <span className={`student-att-pill ${rec.status === 'Present' ? 'present' : 'absent'}`}>
                      <span className="att-indicator-dot" />
                      {rec.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inspiring Bottom Banner */}
      <footer className="student-footer-banner">
        <div className="student-footer-left">
          <div className="student-trophy-badge">
            <Trophy size={20} />
          </div>
          <div className="student-footer-text">
            <h4 className="student-footer-title">Keep Going!</h4>
            <p className="student-footer-sub">
              Good attendance, consistent effort and a positive attitude always lead to great results.
            </p>
          </div>
        </div>
        <div className="student-footer-badges">
          <span>Believe</span>
          <span>·</span>
          <span>Learn</span>
          <span>·</span>
          <span>Achieve</span>
        </div>
      </footer>
    </div>
  );
}
