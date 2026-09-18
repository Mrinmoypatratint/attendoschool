import React, { useState, useEffect } from 'react';
import { GraduationCap, ArrowLeft, Award, Calendar, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentApi, Exam } from '../../services/studentApi';

export function StudentExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentApi
      .getExams()
      .then((res) => {
        setExams(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const upcoming = exams.filter((e) => !e.marks_obtained);
  const results = exams.filter((e) => e.marks_obtained !== undefined);

  return (
    <div className="student-subpage">
      <div className="student-subpage-header">
        <div className="student-subpage-title-row">
          <Link to="/student/dashboard" className="student-back-link">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title">Exams & Academic Results</h1>
          <p className="student-subpage-desc">
            Official examination timetable and verified report cards.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="student-loading-spinner">Loading exam details...</div>
      ) : (
        <>
          {/* Upcoming Exams Section */}
          <div className="student-card" style={{ marginBottom: 24 }}>
            <div className="student-card-header">
              <div className="student-card-title-wrap">
                <Calendar size={18} />
                <h3 className="student-card-title">Upcoming Examinations</h3>
              </div>
            </div>

            {upcoming.length === 0 ? (
              <div className="student-empty-state">
                <p>No upcoming exams currently scheduled.</p>
              </div>
            ) : (
              <div className="student-table-wrap">
                <table className="student-table">
                  <thead>
                    <tr>
                      <th>EXAMINATION</th>
                      <th>SUBJECT</th>
                      <th>DATE</th>
                      <th>TIMING</th>
                      <th>HALL / ROOM</th>
                      <th>TOTAL MARKS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((ex) => (
                      <tr key={ex.id}>
                        <td className="font-semibold">{ex.title}</td>
                        <td>{ex.subject_name}</td>
                        <td>{ex.exam_date}</td>
                        <td>{ex.start_time?.slice(0, 5)} - {ex.end_time?.slice(0, 5)}</td>
                        <td>{ex.room || 'Examination Hall'}</td>
                        <td>{ex.total_marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Published Results Section */}
          <div className="student-card">
            <div className="student-card-header">
              <div className="student-card-title-wrap">
                <Award size={18} />
                <h3 className="student-card-title">Published Results & Marksheets</h3>
              </div>
            </div>

            {results.length === 0 ? (
              <div className="student-empty-state">
                <p>No term results published yet.</p>
              </div>
            ) : (
              <div className="student-table-wrap">
                <table className="student-table">
                  <thead>
                    <tr>
                      <th>ASSESSMENT</th>
                      <th>SUBJECT</th>
                      <th>SCORE</th>
                      <th>GRADE</th>
                      <th>REMARKS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id}>
                        <td className="font-semibold">{r.title}</td>
                        <td>{r.subject_name}</td>
                        <td>
                          <b>{r.marks_obtained}</b> / {r.total_marks}
                        </td>
                        <td>
                          <span className="student-grade-badge">{r.grade || 'A'}</span>
                        </td>
                        <td>{r.remarks || 'Good performance'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
