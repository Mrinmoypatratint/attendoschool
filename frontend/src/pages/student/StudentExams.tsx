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
      <div className="student-subpage-header mb-6">
        <div className="student-subpage-title-row">
          <Link to="/student/dashboard" className="student-back-link inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-2">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title text-2xl font-bold text-slate-900 dark:text-white m-0 mb-1">Exams & Academic Results</h1>
          <p className="student-subpage-desc text-sm text-slate-500 dark:text-slate-400 m-0">
            Official examination timetable and verified report cards.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="student-loading-spinner py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading exam details...</div>
      ) : (
        <>
          {/* Upcoming Exams Section */}
          <div className="student-card bg-white dark:bg-[#131b2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm mb-6">
            <div className="student-card-header flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="student-card-title-wrap flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <Calendar size={18} />
                <h3 className="student-card-title text-base font-bold text-slate-900 dark:text-white m-0">Upcoming Examinations</h3>
              </div>
            </div>

            {upcoming.length === 0 ? (
              <div className="student-empty-state py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                <p>No upcoming exams currently scheduled.</p>
              </div>
            ) : (
              <div className="student-table-wrap overflow-x-auto">
                <table className="student-table w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">EXAMINATION</th>
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">SUBJECT</th>
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">DATE</th>
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">TIMING</th>
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">HALL / ROOM</th>
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">TOTAL MARKS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((ex) => (
                      <tr key={ex.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5 px-4 font-semibold text-slate-900 dark:text-white">{ex.title}</td>
                        <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">{ex.subject_name}</td>
                        <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">{ex.exam_date}</td>
                        <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">{ex.start_time?.slice(0, 5)} - {ex.end_time?.slice(0, 5)}</td>
                        <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">{ex.room || 'Examination Hall'}</td>
                        <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">{ex.total_marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Published Results Section */}
          <div className="student-card bg-white dark:bg-[#131b2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
            <div className="student-card-header flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="student-card-title-wrap flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <Award size={18} />
                <h3 className="student-card-title text-base font-bold text-slate-900 dark:text-white m-0">Published Results & Marksheets</h3>
              </div>
            </div>

            {results.length === 0 ? (
              <div className="student-empty-state py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                <p>No term results published yet.</p>
              </div>
            ) : (
              <div className="student-table-wrap overflow-x-auto">
                <table className="student-table w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">ASSESSMENT</th>
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">SUBJECT</th>
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">SCORE</th>
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">GRADE</th>
                      <th className="p-3 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">REMARKS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5 px-4 font-semibold text-slate-900 dark:text-white">{r.title}</td>
                        <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">{r.subject_name}</td>
                        <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">
                          <b className="font-bold text-slate-900 dark:text-white">{r.marks_obtained}</b> / {r.total_marks}
                        </td>
                        <td className="p-3.5 px-4">
                          <span className="student-grade-badge inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                            {r.grade || 'A'}
                          </span>
                        </td>
                        <td className="p-3.5 px-4 text-slate-800 dark:text-slate-200">{r.remarks || 'Good performance'}</td>
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
