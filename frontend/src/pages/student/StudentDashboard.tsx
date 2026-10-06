import React, { useState, useEffect } from 'react';
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
  Award
} from 'lucide-react';
import { studentApi, StudentDashboardData } from '../../services/studentApi';

export function StudentDashboard() {
  const [data, setData] = useState<StudentDashboardData | null>(() => {
    try {
      const cached = sessionStorage.getItem('cached_student_dashboard');
      if (cached) return JSON.parse(cached);
    } catch { }
    return null;
  });
  const [loading, setLoading] = useState(() => !data);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    studentApi
      .getDashboard()
      .then((res) => {
        if (!isMounted) return;
        setData(res);
        try {
          sessionStorage.setItem('cached_student_dashboard', JSON.stringify(res));
        } catch { }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (!data) {
          setError(err?.response?.data?.message || 'Failed to load dashboard data');
        }
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
      <div className="student-error-box">
        <h3>Unable to load dashboard</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="student-btn-primary">
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

  // Dynamic Mini Calendar state
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
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

  return (
    <div className="student-dashboard-page">
      {/* Top Hero Showcase */}
      <section className="student-hero-banner">
        <div className="student-hero-content">
          <div className="student-greeting-row">
            <h1 className="student-greeting-title">
              Good Morning, <span className="student-greeting-name">{student?.name || 'Rohan Sharma'}</span> 👋
            </h1>
          </div>
          <div className="student-greeting-meta">
            <span className="student-meta-pill">{student?.className || 'Class 10'} · Section {student?.sectionName || 'A'}</span>
            <span className="student-meta-pill">Roll #{student?.rollNumber || '25'}</span>
            {student?.admissionNumber && (
              <span className="student-meta-pill" style={{ letterSpacing: '0.02em', fontWeight: 600 }}>Adm: {student.admissionNumber}</span>
            )}
            <span className="student-meta-pill student-meta-school">{student?.schoolName || 'AttendoSchool'}</span>
          </div>
        </div>

        <div className="student-hero-quote-card">
          <div className="student-quote-text-side">
            <p className="student-hero-quote">
              "Consistent effort today leads to success tomorrow."
            </p>
          </div>
          <div className="student-quote-img-side">
            <img src="/educational_student_campus.jpg" alt="Campus" className="student-campus-thumb" />
            <div className="student-campus-overlay">
              <span>LEARN</span>
              <span>GROW</span>
              <span>BELONG</span>
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

        {/* Exams KPI */}
        <Link to="/student/exams" className="student-kpi-card exams-kpi">
          <div className="student-kpi-card-top">
            <div className="student-kpi-icon-wrap coral-icon">
              <GraduationCap size={20} />
            </div>
            <span className="student-kpi-label">Exams</span>
            <ChevronRight size={15} className="student-kpi-chevron" />
          </div>
          <div className="student-kpi-body">
            <div className="student-kpi-value student-kpi-value-sm">Next: {kpis?.upcomingExamTitle?.split('-')[0]?.trim() || 'Maths'}</div>
            <div className="student-kpi-sub">{kpis?.upcomingExamTitle?.includes('-') ? kpis.upcomingExamTitle.split('-')[1].trim() : (kpis?.upcomingExamTitle || 'No upcoming exam scheduled')}</div>
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
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-secondary)' }}>
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
                <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-secondary)', fontSize: 13 }}>
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
                  <div style={{ textAlign: 'center', padding: '16px 8px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    No new announcements at this time
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
                  <div style={{ textAlign: 'center', padding: '16px 8px', fontSize: 13, color: 'var(--text-secondary)' }}>
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
                  className="cal-date muted"
                  onClick={() => {
                    const newD = new Date(calYear, calMonth - 1, d);
                    setCalendarViewDate(newD);
                    setSelectedDate(newD);
                  }}
                  style={{ cursor: 'pointer' }}
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

                const isActive = isSelected;
                const attStatus = attendanceDayMap.get(dayNum);
                const isExam = examDayInMonth === dayNum;

                let dotClass = '';
                if (isExam) {
                  dotClass = 'dot-exam';
                } else if (attStatus === 'Present') {
                  dotClass = 'dot-present';
                } else if (attStatus === 'Absent') {
                  dotClass = 'dot-absent';
                }

                const classes = [
                  'cal-date',
                  isActive ? 'active-date' : '',
                  isToday && !isActive ? 'today-date' : '',
                  dotClass
                ].filter(Boolean).join(' ');

                return (
                  <div
                    key={dayNum}
                    className={classes}
                    onClick={() => setSelectedDate(new Date(calYear, calMonth, dayNum))}
                    style={{ cursor: 'pointer' }}
                    title={isToday ? `Today (${dayNum} ${calMonthName})` : `${dayNum} ${calMonthName}`}
                  >
                    {dayNum}
                  </div>
                );
              })}

              {/* Next month padding days */}
              {nextMonthDays.map((d) => (
                <div
                  key={`next-${d}`}
                  className="cal-date muted"
                  onClick={() => {
                    const newD = new Date(calYear, calMonth + 1, d);
                    setCalendarViewDate(newD);
                    setSelectedDate(newD);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {d}
                </div>
              ))}
            </div>
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
                <div style={{ textAlign: 'center', padding: '16px 8px', fontSize: 13, color: 'var(--text-secondary)' }}>
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
