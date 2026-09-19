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
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    studentApi
      .getDashboard()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Failed to load dashboard data');
        setLoading(false);
      });
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
            <span className="student-meta-pill student-meta-school">{student?.schoolName || 'Greenwood International School'}</span>
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
          <div className="student-kpi-icon-wrap green-icon">
            <CalendarCheck size={24} />
          </div>
          <div className="student-kpi-body">
            <div className="student-kpi-header">
              <span className="student-kpi-label">Attendance</span>
              <ChevronRight size={16} className="student-kpi-chevron" />
            </div>
            <div className="student-kpi-value">{kpis?.attendancePercentage ?? 92}%</div>
            <div className="student-kpi-sub">{kpis?.attendanceText || 'Present: 138 / 150 days'}</div>
          </div>
        </Link>

        {/* Assignments KPI */}
        <Link to="/student/assignments" className="student-kpi-card assignments-kpi">
          <div className="student-kpi-icon-wrap blue-icon">
            <FileCheck size={24} />
          </div>
          <div className="student-kpi-body">
            <div className="student-kpi-header">
              <span className="student-kpi-label">Assignments</span>
              <ChevronRight size={16} className="student-kpi-chevron" />
            </div>
            <div className="student-kpi-value">{kpis?.pendingAssignmentsCount ?? 5}</div>
            <div className="student-kpi-sub">Pending submissions</div>
          </div>
        </Link>

        {/* Exams KPI */}
        <Link to="/student/exams" className="student-kpi-card exams-kpi">
          <div className="student-kpi-icon-wrap coral-icon">
            <GraduationCap size={24} />
          </div>
          <div className="student-kpi-body">
            <div className="student-kpi-header">
              <span className="student-kpi-label">Exams</span>
              <ChevronRight size={16} className="student-kpi-chevron" />
            </div>
            <div className="student-kpi-value student-kpi-value-sm">Next Exam</div>
            <div className="student-kpi-sub">{kpis?.upcomingExamTitle || 'Maths - 22 Sep 2025'}</div>
          </div>
        </Link>

        {/* Announcements KPI */}
        <Link to="/student/announcements" className="student-kpi-card announcements-kpi">
          <div className="student-kpi-icon-wrap purple-icon">
            <Megaphone size={24} />
          </div>
          <div className="student-kpi-body">
            <div className="student-kpi-header">
              <span className="student-kpi-label">Announcements</span>
              <ChevronRight size={16} className="student-kpi-chevron" />
            </div>
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
                View Full Timetable <ArrowRight size={14} />
              </Link>
            </div>

            <div className="student-table-wrap">
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
                  {timetable.map((t) => (
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
                  ))}
                </tbody>
              </table>
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
                {announcements.map((a, i) => (
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
                ))}
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
                {assignments.map((t, i) => (
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
                ))}
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
                <span className="student-calendar-month">September 2025</span>
              </div>
              <div className="student-calendar-nav">
                <button type="button" aria-label="Previous month"><ChevronLeft size={16} /></button>
                <button type="button" aria-label="Next month"><ChevronRight size={16} /></button>
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

              {/* September 2025 calendar days mockup */}
              <div className="cal-date muted">31</div>
              <div className="cal-date">1</div>
              <div className="cal-date">2</div>
              <div className="cal-date dot-present">3</div>
              <div className="cal-date">4</div>
              <div className="cal-date">5</div>
              <div className="cal-date">6</div>

              <div className="cal-date">7</div>
              <div className="cal-date">8</div>
              <div className="cal-date dot-present">9</div>
              <div className="cal-date dot-present">10</div>
              <div className="cal-date">11</div>
              <div className="cal-date dot-absent">12</div>
              <div className="cal-date">13</div>

              <div className="cal-date">14</div>
              <div className="cal-date dot-present">15</div>
              <div className="cal-date dot-present">16</div>
              <div className="cal-date active-date">17</div>
              <div className="cal-date">18</div>
              <div className="cal-date">19</div>
              <div className="cal-date">20</div>

              <div className="cal-date">21</div>
              <div className="cal-date dot-exam">22</div>
              <div className="cal-date">23</div>
              <div className="cal-date">24</div>
              <div className="cal-date dot-exam">25</div>
              <div className="cal-date">26</div>
              <div className="cal-date">27</div>

              <div className="cal-date">28</div>
              <div className="cal-date">29</div>
              <div className="cal-date">30</div>
              <div className="cal-date muted">1</div>
              <div className="cal-date muted">2</div>
              <div className="cal-date muted">3</div>
              <div className="cal-date muted">4</div>
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
              {recentAttendance.map((rec, i) => (
                <div key={i} className="student-recent-att-row">
                  <span className="student-att-date">{rec.date}</span>
                  <span className={`student-att-pill ${rec.status === 'Present' ? 'present' : 'absent'}`}>
                    <span className="att-indicator-dot" />
                    {rec.status}
                  </span>
                </div>
              ))}
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
