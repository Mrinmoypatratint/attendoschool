import React, { useState, useEffect } from 'react';
import { Megaphone, ArrowLeft, AlertCircle, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { studentApi, Announcement } from '../../services/studentApi';

export function StudentAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentApi
      .getAnnouncements()
      .then((res) => {
        setAnnouncements(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="student-subpage">
      <div className="student-subpage-header">
        <div className="student-subpage-title-row">
          <Link to="/student/dashboard" className="student-back-link">
            <ArrowLeft size={16} /> <span>Dashboard</span>
          </Link>
          <h1 className="student-subpage-title">School Announcements</h1>
          <p className="student-subpage-desc">
            Official notices, circulars, and academic broadcasts.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="student-loading-spinner">Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <div className="student-empty-state">
          <p>No announcements at this time.</p>
        </div>
      ) : (
        <div className="student-announcements-feed">
          {announcements.map((a) => (
            <div key={a.id} className="student-card student-notice-card">
              <div className="notice-header">
                <div className="notice-badge-group">
                  <span className={`notice-priority-badge priority-${a.priority.toLowerCase()}`}>
                    {a.priority}
                  </span>
                  <span className="notice-date">
                    <Calendar size={13} /> {new Date(a.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {a.author_name && <span className="notice-author">By: {a.author_name}</span>}
              </div>
              <h3 className="notice-title">{a.title}</h3>
              <p className="notice-body">{a.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
