import React, { useState, useEffect } from 'react';
import { Calendar, ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { studentApi, TimetableEntry, StudentProfile } from '../../services/studentApi';

export function StudentTimetable() {
  const [searchParams, setSearchParams] = useSearchParams();
  const subjectParam = searchParams.get('subject') || searchParams.get('q') || '';
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 1 : d; // Default to Monday if Sunday
  });

  const days = [
    { num: 1, name: 'Monday' },
    { num: 2, name: 'Tuesday' },
    { num: 3, name: 'Wednesday' },
    { num: 4, name: 'Thursday' },
    { num: 5, name: 'Friday' },
    { num: 6, name: 'Saturday' }
  ];

  useEffect(() => {
    studentApi.getProfile().then((p) => setProfile(p)).catch(() => {});
    studentApi
      .getTimetable()
      .then((res) => {
        setEntries(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // When searching for a subject, automatically jump to the day where the class is held
  useEffect(() => {
    if (subjectParam && entries.length > 0) {
      const match = entries.find(
        (e) => e.subject_name?.toLowerCase().includes(subjectParam.toLowerCase())
      );
      if (match && match.day_of_week) {
        setSelectedDay(Number(match.day_of_week));
      }
    }
  }, [subjectParam, entries]);

  const dayEntries = entries.filter((e) => Number(e.day_of_week) === selectedDay);

  return (
    <div className="student-subpage">
      <div className="student-subpage-header mb-6">
        <div className="student-subpage-title-row">
          <Link to="/student/dashboard" className="student-back-link inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-2">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title text-2xl font-bold text-slate-900 dark:text-white m-0 mb-1">Weekly Class Timetable</h1>
          <p className="student-subpage-desc text-sm text-slate-500 dark:text-slate-400 m-0">
            Official class schedule and room allocations {profile ? `for ${profile.className} · Section ${profile.sectionName}` : 'for your enrolled class and section'}.
          </p>
        </div>
      </div>

      {/* Subject Filter Notification Banner */}
      {subjectParam && (
        <div className="student-timetable-filter-banner flex items-center justify-between p-3 px-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 mb-4 text-[13px]">
          <span>
            Showing timetable routine for subject: <b>"{subjectParam}"</b>
          </span>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="bg-transparent border-0 cursor-pointer text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline p-1"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Day Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          borderBottom: '2px solid var(--border, #eaeaec)',
          marginBottom: 16,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
        className="no-scrollbar pb-px [&::-webkit-scrollbar]:hidden"
      >
        {days.map((d) => {
          const isSelected = selectedDay === d.num;
          const dayCount = entries.filter((e) => Number(e.day_of_week) === d.num).length;
          return (
            <button
              key={d.num}
              type="button"
              onClick={() => setSelectedDay(d.num)}
              style={{
                padding: '12px 20px',
                background: 'none',
                border: 'none',
                borderBottom: isSelected ? '3px solid #e11d55' : '3px solid transparent',
                color: isSelected ? '#e11d55' : 'var(--text-secondary, #696e79)',
                fontWeight: isSelected ? 700 : 500,
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
              <span>{d.name}</span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: isSelected ? '#ffe1e8' : 'var(--card-subtle, #f5f5f6)',
                  color: isSelected ? '#c0174a' : '#696e79',
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                {dayCount}
              </span>
            </button>
          );
        })}
      </div>

      <div className="student-card bg-white dark:bg-[#1c1c1c] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm mt-5">
        <div className="student-card-header flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="student-card-title-wrap flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <Calendar size={18} />
            <h3 className="student-card-title text-base font-bold text-slate-900 dark:text-white m-0">
              {days.find((d) => d.num === selectedDay)?.name} Schedule
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="student-loading-spinner py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading timetable...</div>
        ) : dayEntries.length === 0 ? (
          <div className="student-empty-state py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            <p>No lectures scheduled for this day.</p>
          </div>
        ) : (
          <div className="student-table-wrap overflow-x-auto">
            <table className="student-table w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">PERIOD</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">TIME</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">SUBJECT</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">FACULTY</th>
                  <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">ROOM</th>
                </tr>
              </thead>
              <tbody>
                {dayEntries.map((e, idx) => {
                  const isMatch = Boolean(subjectParam && e.subject_name?.toLowerCase().includes(subjectParam.toLowerCase()));
                  return (
                    <tr
                      key={e.id || idx}
                      className={`border-b border-slate-100 dark:border-slate-800/60 transition-colors ${
                        isMatch
                          ? 'bg-blue-50/70 dark:bg-blue-950/30 border-l-3 border-l-blue-600'
                          : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="period-cell p-3.5 px-4 text-slate-600 dark:text-slate-400 font-medium">{idx + 1}</td>
                      <td className="time-cell p-3.5 px-4 text-slate-600 dark:text-slate-400">{e.start_time?.slice(0, 5)} - {e.end_time?.slice(0, 5)}</td>
                      <td className="subject-cell p-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {e.subject_name}
                        {isMatch && (
                          <span className="ml-1.5 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded align-middle font-bold">
                            Matched
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">{e.teacher_name}</td>
                      <td className="room-cell p-3.5 px-4 text-slate-600 dark:text-slate-400">{e.room || `Room ${profile?.classNumber || 10}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
