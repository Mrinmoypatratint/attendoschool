import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users, ShieldCheck, FileText, RefreshCw, AlertCircle, Loader2, Award
} from 'lucide-react';
import { api } from '../../api';
import AttendanceReports from '../admin/AttendanceReports';

interface MentoredClass {
  mentor_record_id: string;
  class_id: string;
  section_id: string;
  class_number: number;
  section_name: string;
  assigned_at?: string;
}

export function ClassMentorWorkspace() {
  const [mentoredClasses, setMentoredClasses] = useState<MentoredClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Active Selected Section
  const [selectedSection, setSelectedSection] = useState<MentoredClass | null>(null);
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'RESULTS'>(
    tabParam === 'RESULTS' ? 'RESULTS' : 'REPORTS'
  );

  useEffect(() => {
    if (tabParam === 'RESULTS') {
      setActiveTab('RESULTS');
    } else {
      setActiveTab('REPORTS');
    }
  }, [tabParam]);

  // 1. Fetch Mentored Classes for Logged-In Teacher
  const loadMyClasses = useCallback(async () => {
    setLoadingClasses(true);
    setClassesError(null);
    try {
      const res = await api.get('/teacher/mentor/my-classes');
      const data: MentoredClass[] = Array.isArray(res.data) ? res.data : [];
      setMentoredClasses(data);
      if (data.length > 0 && !selectedSection) {
        setSelectedSection(data[0]);
      } else if (data.length > 0 && selectedSection) {
        const stillExists = data.find(c => c.class_id === selectedSection.class_id && c.section_id === selectedSection.section_id);
        setSelectedSection(stillExists || data[0]);
      } else {
        setSelectedSection(null);
      }
    } catch (err: any) {
      console.error('Failed to load mentored classes:', err);
      setClassesError(err?.response?.data?.message || 'Unable to load your mentored class assignments.');
    } finally {
      setLoadingClasses(false);
    }
  }, [selectedSection]);

  useEffect(() => {
    loadMyClasses();
  }, []);

  if (loadingClasses) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>
        <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
        <p>Loading your Class Mentor workspace...</p>
      </div>
    );
  }

  if (classesError) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 40, color: '#d32f2f' }}>
        <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
        <p style={{ fontWeight: 600, fontSize: 16 }}>{classesError}</p>
        <button type="button" className="btn-secondary" onClick={loadMyClasses} style={{ marginTop: 16 }}>
          Retry Loading
        </button>
      </div>
    );
  }

  // EMPTY STATE: Logged-In Teacher is not assigned as mentor for any section
  if (mentoredClasses.length === 0) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: '60px 20px', maxWidth: 640, margin: '40px auto' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(127, 140, 205, 0.12)', border: '1px solid var(--border-focus, rgba(127, 140, 205, 0.3))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sidebar-accent)', margin: '0 auto 16px' }}>
          <Users size={28} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
          No Class Mentor Assignments
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 24px' }}>
          You are not currently assigned as a Class Mentor for any class or section. Class Mentors oversee section attendance reports and result publications.
        </p>
        <button type="button" className="btn-secondary" onClick={loadMyClasses} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={15} /> Check For New Assignments
        </button>
      </div>
    );
  }

  return (
    <div className="as-mentor-workspace">
      {/* Workspace Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              Class Mentor Workspace
            </h1>
            <span style={{ fontSize: 11.5, fontWeight: 700, background: 'rgba(225, 29, 85, 0.1)', color: 'var(--sidebar-accent)', border: '1px solid var(--border-focus)', padding: '2px 8px', borderRadius: 9999 }}>
              Mentor Access
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Inspect section attendance reports and publish academic examination results.
          </p>
        </div>

        {/* Section Switcher (Supports multiple mentored sections) */}
        {mentoredClasses.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', padding: '6px 12px', borderRadius: 4, border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Select Section:</span>
            <select
              value={`${selectedSection?.class_id}:${selectedSection?.section_id}`}
              onChange={e => {
                const [cId, sId] = e.target.value.split(':');
                const found = mentoredClasses.find(m => m.class_id === cId && m.section_id === sId);
                if (found) setSelectedSection(found);
              }}
              style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}
            >
              {mentoredClasses.map(m => (
                <option key={`${m.class_id}:${m.section_id}`} value={`${m.class_id}:${m.section_id}`}>
                  Class {m.class_number} — Section {m.section_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Single Section Badge Banner if only 1 section mentored (Section ID removed) */}
      {mentoredClasses.length === 1 && selectedSection && (
        <div className="p-3 px-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-sky-500/5 border border-blue-500/20 mb-5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Assigned Mentor for Class {selectedSection.class_number} — Section {selectedSection.section_name}
            </span>
          </div>
        </div>
      )}

      {/* Multi-Section Tabs */}
      {mentoredClasses.length > 1 && (
        <div className="student-tab-bar mb-4">
          {mentoredClasses.map(m => (
            <button
              key={`${m.class_id}:${m.section_id}`}
              type="button"
              className={`student-tab-btn ${selectedSection?.class_id === m.class_id && selectedSection?.section_id === m.section_id ? 'active' : ''}`}
              onClick={() => setSelectedSection(m)}
            >
              Class {m.class_number} - Section {m.section_name}
            </button>
          ))}
        </div>
      )}

      {/* Tab Navigation: 1st Tab = Report, 2nd Tab = Result Publish */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          borderBottom: '2px solid var(--border, #eaeaec)',
          marginBottom: 20
        }}
      >
        <button
          type="button"
          onClick={() => { setActiveTab('REPORTS'); setSearchParams({ tab: 'REPORTS' }); }}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'REPORTS' ? '3px solid #e11d55' : '3px solid transparent',
            color: activeTab === 'REPORTS' ? '#e11d55' : 'var(--text-secondary, #696e79)',
            fontWeight: activeTab === 'REPORTS' ? 700 : 500,
            fontSize: 15,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease'
          }}
        >
          <FileText size={18} />
          <span>Report</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('RESULTS'); setSearchParams({ tab: 'RESULTS' }); }}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'RESULTS' ? '3px solid #e11d55' : '3px solid transparent',
            color: activeTab === 'RESULTS' ? '#e11d55' : 'var(--text-secondary, #696e79)',
            fontWeight: activeTab === 'RESULTS' ? 700 : 500,
            fontSize: 15,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease'
          }}
        >
          <Award size={18} />
          <span>Result Publish</span>
        </button>
      </div>

      {/* TAB 1: ATTENDANCE & SECTION REPORTS */}
      {activeTab === 'REPORTS' && (
        <div className="as-reports-pane">
          <AttendanceReports
            embedded={true}
            defaultClassId={selectedSection?.class_id}
            defaultSectionId={selectedSection?.section_id}
            defaultClassNumber={selectedSection?.class_number}
            defaultSectionName={selectedSection?.section_name}
          />
        </div>
      )}

      {/* TAB 2: RESULT PUBLISH (BLANK PAGE) */}
      {activeTab === 'RESULTS' && (
        <div
          style={{
            background: 'var(--surface, #FFF)',
            border: '1px solid var(--border, #eaeaec)',
            borderRadius: 4,
            padding: '72px 24px',
            textAlign: 'center',
            boxShadow: 'none'
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 4,
              background: 'rgba(225, 29, 85, 0.1)',
              color: '#e11d55',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}
          >
            <Award size={28} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text, #1c1f2e)', margin: '0 0 8px' }}>
            Result Publish
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary, #696e79)', maxWidth: 460, margin: '0 auto' }}>
            Result publication and marks management for Class {selectedSection?.class_number} — Section {selectedSection?.section_name} will be available here soon.
          </p>
        </div>
      )}
    </div>
  );
}

export default ClassMentorWorkspace;
