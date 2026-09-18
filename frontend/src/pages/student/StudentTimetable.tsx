import React, { useState, useEffect } from 'react';
import { Calendar, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentApi, TimetableEntry } from '../../services/studentApi';

export function StudentTimetable() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
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
            Official class schedule and room allocations for Class 10 - Section A.
          </p>
        </div>
      </div>

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
                {dayEntries.map((e, idx) => (
                  <tr key={e.id || idx}>
                    <td className="period-cell">{idx + 1}</td>
                    <td className="time-cell">{e.start_time?.slice(0, 5)} - {e.end_time?.slice(0, 5)}</td>
                    <td className="subject-cell font-semibold">{e.subject_name}</td>
                    <td>{e.teacher_name}</td>
                    <td className="room-cell">{e.room || `A-10${idx + 1}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
