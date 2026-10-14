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
      <div className="student-subpage-header">
        <div className="student-subpage-title-row">
          <Link to="/student/dashboard" className="student-back-link">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title">Weekly Class Timetable</h1>
          <p className="student-subpage-desc">
            Official class schedule and room allocations {profile ? `for ${profile.className} · Section ${profile.sectionName}` : 'for your enrolled class and section'}.
          </p>
        </div>
      </div>

      {/* Subject Filter Notification Banner */}
      {subjectParam && (
        <div className="student-timetable-filter-banner">
          <span style={{ fontSize: 13 }}>
            Showing timetable routine for subject: <b>"{subjectParam}"</b>
          </span>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 600
            }}
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Day Tabs */}
      <div className="student-tab-bar">
        {days.map((d) => (
          <button
            key={d.num}
            type="button"
            className={`student-tab-btn ${selectedDay === d.num ? 'active' : ''}`}
            onClick={() => setSelectedDay(d.num)}
          >
            {d.name}
          </button>
        ))}
      </div>

      <div className="student-card" style={{ marginTop: 20 }}>
        <div className="student-card-header">
          <div className="student-card-title-wrap">
            <Calendar size={18} />
            <h3 className="student-card-title">
              {days.find((d) => d.num === selectedDay)?.name} Schedule
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="student-loading-spinner">Loading timetable...</div>
        ) : dayEntries.length === 0 ? (
          <div className="student-empty-state">
            <p>No lectures scheduled for this day.</p>
          </div>
        ) : (
          <div className="student-table-wrap">
            <table className="student-table">
              <thead>
                <tr>
                  <th>PERIOD</th>
                  <th>TIME</th>
                  <th>SUBJECT</th>
                  <th>FACULTY</th>
                  <th>ROOM</th>
                </tr>
              </thead>
              <tbody>
                {dayEntries.map((e, idx) => {
                  const isMatch = Boolean(subjectParam && e.subject_name?.toLowerCase().includes(subjectParam.toLowerCase()));
                  return (
                    <tr 
                      key={e.id || idx}
                      style={{
                        background: isMatch ? 'rgba(37, 99, 235, 0.08)' : undefined,
                        borderLeft: isMatch ? '3px solid #2563eb' : undefined
                      }}
                    >
                      <td className="period-cell">{idx + 1}</td>
                      <td className="time-cell">{e.start_time?.slice(0, 5)} - {e.end_time?.slice(0, 5)}</td>
                      <td className="subject-cell font-semibold">
                        {e.subject_name}
                        {isMatch && (
                          <span style={{ marginLeft: 6, fontSize: 10, background: '#2563eb', color: '#fff', padding: '1px 5px', borderRadius: 4, verticalAlign: 'middle' }}>
                            Matched
                          </span>
                        )}
                      </td>
                      <td>{e.teacher_name}</td>
                      <td className="room-cell">{e.room || `Room ${profile?.classNumber || 10}`}</td>
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
