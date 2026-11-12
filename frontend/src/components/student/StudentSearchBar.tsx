import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  LayoutDashboard,
  CalendarCheck,
  Calendar,
  FileCheck,
  GraduationCap,
  Award,
  Megaphone,
  FileText,
  User as UserIcon,
  BookOpen,
  ArrowRight,
  Clock,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { studentApi, Announcement, TimetableEntry, Assignment, Exam } from '../../services/studentApi';

interface SearchItem {
  id: string;
  category: 'page' | 'subject' | 'announcement' | 'assignment' | 'exam';
  categoryLabel: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  date?: string;
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
}

const PAGE_ITEMS: (SearchItem & { keywords: string[] })[] = [
  {
    id: 'page-dashboard',
    category: 'page',
    categoryLabel: 'Navigation',
    title: 'Dashboard',
    subtitle: 'Summary overview, today timetable, attendance & notifications',
    keywords: ['dashboard', 'home', 'main', 'overview', 'kpi'],
    to: '/student/dashboard',
    icon: LayoutDashboard
  },
  {
    id: 'page-attendance',
    category: 'page',
    categoryLabel: 'Navigation',
    title: 'My Attendance',
    subtitle: 'Attendance percentage, daily logs, check-ins & leaves',
    keywords: ['attendance', 'present', 'absent', 'percentage', 'roll', 'checkin', 'leaves'],
    to: '/student/attendance',
    icon: CalendarCheck
  },
  {
    id: 'page-timetable',
    category: 'page',
    categoryLabel: 'Navigation',
    title: 'Class Timetable',
    subtitle: 'Weekly routine, period schedules, subject classrooms & teachers',
    keywords: ['timetable', 'routine', 'periods', 'schedule', 'classes', 'timing'],
    to: '/student/timetable',
    icon: Calendar
  },
  {
    id: 'page-assignments',
    category: 'page',
    categoryLabel: 'Navigation',
    title: 'Homework & Assignments',
    subtitle: 'Pending submissions, class homework, teacher marks & feedback',
    keywords: ['assignments', 'homework', 'tasks', 'projects', 'submissions', 'work'],
    to: '/student/assignments',
    icon: FileCheck
  },
  {
    id: 'page-results',
    category: 'page',
    categoryLabel: 'Navigation',
    title: 'Result',
    subtitle: 'Exam dates, marks obtained, subject grades & official report cards',
    keywords: ['result', 'results', 'exams', 'tests', 'marks', 'grades', 'score', 'report card'],
    to: '/student/results',
    icon: Award
  },
  {
    id: 'page-announcements',
    category: 'page',
    categoryLabel: 'Navigation',
    title: 'Announcements & Circulars',
    subtitle: 'Official circulars, school notices, principal circulars & updates',
    keywords: ['announcements', 'notices', 'circulars', 'bulletin', 'news', 'broadcast'],
    to: '/student/announcements',
    icon: Megaphone
  },
  {
    id: 'page-leave-request',
    category: 'page',
    categoryLabel: 'Navigation',
    title: 'Leave Request',
    subtitle: 'Submit sick or casual leave excuse, track approval status',
    keywords: ['leave', 'sick', 'holiday', 'absence', 'excuse', 'application'],
    to: '/student/leave-request',
    icon: FileText
  },
  {
    id: 'page-profile',
    category: 'page',
    categoryLabel: 'Navigation',
    title: 'My Profile & Credentials',
    subtitle: 'Admission number, roll, class section, photo & password change',
    keywords: ['profile', 'account', 'password', 'roll number', 'admission', 'student id', 'personal details'],
    to: '/student/profile',
    icon: UserIcon
  }
];

export function StudentSearchBar() {
  const nav = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch indexed student data in background
  useEffect(() => {
    let isMounted = true;
    setLoadingData(true);
    Promise.allSettled([
      studentApi.getAnnouncements(),
      studentApi.getTimetable(),
      studentApi.getAssignments(),
      studentApi.getExams()
    ]).then(([annRes, timeRes, asgRes, examRes]) => {
      if (!isMounted) return;
      if (annRes.status === 'fulfilled' && Array.isArray(annRes.value)) setAnnouncements(annRes.value);
      if (timeRes.status === 'fulfilled' && Array.isArray(timeRes.value)) setTimetable(timeRes.value);
      if (asgRes.status === 'fulfilled' && Array.isArray(asgRes.value)) setAssignments(asgRes.value);
      if (examRes.status === 'fulfilled' && Array.isArray(examRes.value)) setExams(examRes.value);
      setLoadingData(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Extract unique subjects from timetable
  const subjectItems = useMemo<SearchItem[]>(() => {
    const map = new Map<string, { subject: string; teachers: Set<string>; rooms: Set<string> }>();
    timetable.forEach((t) => {
      const sName = (t.subject_name || '').trim();
      if (!sName) return;
      if (!map.has(sName)) {
        map.set(sName, { subject: sName, teachers: new Set(), rooms: new Set() });
      }
      const item = map.get(sName)!;
      if (t.teacher_name) item.teachers.add(t.teacher_name);
      if (t.room) item.rooms.add(t.room);
    });

    return Array.from(map.values()).map((s) => ({
      id: `subj-${s.subject}`,
      category: 'subject',
      categoryLabel: 'Classes & Subjects',
      title: s.subject,
      subtitle: `${s.teachers.size > 0 ? Array.from(s.teachers).join(', ') : 'Weekly routine'}${s.rooms.size > 0 ? ` · Room ${Array.from(s.rooms).join(', ')}` : ''}`,
      badge: 'Subject',
      to: `/student/timetable?subject=${encodeURIComponent(s.subject)}`,
      icon: BookOpen
    }));
  }, [timetable]);

  // Transform announcements to searchable items
  const announcementItems = useMemo<SearchItem[]>(() => {
    return announcements.map((a) => ({
      id: `ann-${a.id}`,
      category: 'announcement',
      categoryLabel: 'Announcements',
      title: a.title,
      subtitle: a.message?.slice(0, 75) + ((a.message?.length || 0) > 75 ? '...' : ''),
      badge: a.priority || 'Notice',
      badgeColor: a.priority === 'URGENT' || a.priority === 'HIGH' ? '#d32f2f' : '#e11d55',
      date: a.published_at ? new Date(a.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : undefined,
      to: `/student/announcements?q=${encodeURIComponent(a.title)}`,
      icon: Megaphone
    }));
  }, [announcements]);

  // Transform assignments to searchable items
  const assignmentItems = useMemo<SearchItem[]>(() => {
    return assignments.map((asg) => ({
      id: `asg-${asg.id}`,
      category: 'assignment',
      categoryLabel: 'Assignments',
      title: asg.title,
      subtitle: `${asg.subject_name || 'Assignment'}${asg.due_date ? ` · Due: ${new Date(asg.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`,
      badge: asg.submission_status,
      badgeColor: asg.submission_status === 'PENDING' ? '#b8781c' : asg.submission_status === 'OVERDUE' ? '#d32f2f' : '#03806a',
      to: `/student/assignments?q=${encodeURIComponent(asg.title)}`,
      icon: FileCheck
    }));
  }, [assignments]);

  // Transform exams to searchable items
  const examItems = useMemo<SearchItem[]>(() => {
    return exams.map((ex) => ({
      id: `ex-${ex.id}`,
      category: 'exam',
      categoryLabel: 'Result',
      title: ex.title || ex.subject_name,
      subtitle: `${ex.subject_name}${ex.exam_date ? ` · Date: ${new Date(ex.exam_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}${ex.room ? ` (Room ${ex.room})` : ''}`,
      badge: ex.grade ? `Grade ${ex.grade}` : (ex.marks_obtained !== undefined ? `${ex.marks_obtained}/${ex.total_marks}` : 'Upcoming'),
      badgeColor: '#5c6bc0',
      to: '/student/results',
      icon: Award
    }));
  }, [exams]);

  // Filtered Results
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        pages: PAGE_ITEMS.slice(0, 4),
        subjects: subjectItems.slice(0, 3),
        announcements: announcementItems.slice(0, 3),
        assignments: assignmentItems.slice(0, 3),
        exams: examItems.slice(0, 2),
        totalCount: 0
      };
    }

    const pages = PAGE_ITEMS.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      (p.subtitle && p.subtitle.toLowerCase().includes(q)) ||
      p.keywords.some((k) => k.includes(q))
    );

    const subjects = subjectItems.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      (s.subtitle && s.subtitle.toLowerCase().includes(q))
    );

    const anns = announcementItems.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      (a.subtitle && a.subtitle.toLowerCase().includes(q))
    );

    const asgs = assignmentItems.filter((asg) =>
      asg.title.toLowerCase().includes(q) ||
      (asg.subtitle && asg.subtitle.toLowerCase().includes(q))
    );

    const exs = examItems.filter((ex) =>
      ex.title.toLowerCase().includes(q) ||
      (ex.subtitle && ex.subtitle.toLowerCase().includes(q))
    );

    const total = pages.length + subjects.length + anns.length + asgs.length + exs.length;

    return {
      pages,
      subjects,
      announcements: anns,
      assignments: asgs,
      exams: exs,
      totalCount: total
    };
  }, [searchQuery, subjectItems, announcementItems, assignmentItems, examItems]);

  // Flat list for keyboard indexing
  const flatItems = useMemo<SearchItem[]>(() => {
    const q = searchQuery.trim();
    if (!q) {
      return [
        ...filtered.pages,
        ...filtered.subjects,
        ...filtered.announcements
      ];
    }
    return [
      ...filtered.pages,
      ...filtered.subjects,
      ...filtered.announcements,
      ...filtered.assignments,
      ...filtered.exams
    ];
  }, [searchQuery, filtered]);

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  const handleSelect = (item: SearchItem) => {
    setIsOpen(false);
    setSearchQuery('');
    nav(item.to);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems.length > 0) {
        const target = flatItems[activeIndex] || flatItems[0];
        handleSelect(target);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  let cumulativeIndex = 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Search Input Bar */}
      <div
        className="student-search-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--bg-subtle, #f5f5f6)',
          border: isOpen ? '1px solid #e11d55' : '1px solid var(--border, #eaeaec)',
          boxShadow: isOpen ? '0 0 0 3px rgba(225, 29, 85, 0.15)' : 'none',
          borderRadius: 4,
          padding: '7px 14px',
          width: '100%',
          transition: 'all 0.18s ease',
          boxSizing: 'border-box'
        }}
      >
        <Search
          size={16}
          className="student-search-icon"
          style={{ color: isOpen ? '#e11d55' : 'var(--text-secondary, #696e79)', flexShrink: 0 }}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search classes, subjects, announcements..."
          aria-label="Search classes, subjects, announcements"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            color: 'var(--text, #1c1f2e)',
            width: '100%',
            padding: 0
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              inputRef.current?.focus();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              color: 'var(--text-secondary, #696e79)',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 999
            }}
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown Floating Results Menu */}
      {isOpen && (
        <div
          className="student-search-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: '100%',
            minWidth: 420,
            maxWidth: 540,
            maxHeight: 440,
            overflowY: 'auto',
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border, #d4d5d9)',
            borderRadius: 4,
            boxShadow: 'none',
            zIndex: 1000,
            padding: '8px 0',
            backdropFilter: 'blur(12px)',
            boxSizing: 'border-box'
          }}
        >
          {/* Header indicator */}
          <div
            className="search-dropdown-header"
            style={{
              padding: '6px 14px 10px',
              borderBottom: '1px solid var(--border, #f5f5f6)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--text-secondary, #696e79)'
            }}
          >
            <span>
              {searchQuery.trim()
                ? `Results for "${searchQuery}" (${filtered.totalCount} matches)`
                : 'Quick Shortcuts & Common Sections'}
            </span>
            {loadingData && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#e11d55' }}>
                <Loader2 size={11} style={{ animation: 'spinAnim 0.8s linear infinite' }} /> Indexing...
              </span>
            )}
          </div>

          {/* If No Results */}
          {searchQuery.trim() && filtered.totalCount === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--bg-subtle, #f5f5f6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: 'var(--text-secondary, #696e79)'
                }}
              >
                <Search size={22} />
              </div>
              <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--text, #1c1f2e)' }}>
                No matches found
              </h4>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary, #696e79)' }}>
                No classes, subjects, or announcements matched <b>"{searchQuery}"</b>.
              </p>
              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  gap: 6,
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}
              >
                {['Timetable', 'Math', 'Attendance', 'Homework', 'Circular'].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setSearchQuery(suggestion);
                      inputRef.current?.focus();
                    }}
                    style={{
                      background: 'var(--bg-subtle, #f9f9fa)',
                      border: '1px solid var(--border, #eaeaec)',
                      padding: '3px 9px',
                      borderRadius: 100,
                      fontSize: 11.5,
                      color: '#e11d55',
                      cursor: 'pointer'
                    }}
                  >
                    Try "{suggestion}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '4px 0' }}>
              {/* Category 1: Navigation Pages */}
              {filtered.pages.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      padding: '6px 14px 4px',
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted, #94969f)'
                    }}
                  >
                    Navigation Pages ({filtered.pages.length})
                  </div>
                  {filtered.pages.map((item) => {
                    const itemIdx = cumulativeIndex++;
                    const isSelected = itemIdx === activeIndex;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(itemIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 14px',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(225, 29, 85, 0.08)' : 'transparent',
                          transition: 'background 0.12s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 4,
                              background: isSelected ? '#e11d55' : 'var(--bg-subtle, #f5f5f6)',
                              color: isSelected ? '#ffffff' : '#e11d55',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Icon size={15} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #1c1f2e)' }}>
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div
                                style={{
                                  fontSize: 11.5,
                                  color: 'var(--text-secondary, #696e79)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: '#e11d55', fontWeight: 600, flexShrink: 0 }}>
                          Jump ↵
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Category 2: Classes & Subjects */}
              {filtered.subjects.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      padding: '6px 14px 4px',
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted, #94969f)'
                    }}
                  >
                    Classes & Subjects ({filtered.subjects.length})
                  </div>
                  {filtered.subjects.map((item) => {
                    const itemIdx = cumulativeIndex++;
                    const isSelected = itemIdx === activeIndex;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(itemIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 14px',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(225, 29, 85, 0.08)' : 'transparent',
                          transition: 'background 0.12s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 4,
                              background: '#e6f2f0',
                              color: '#03806a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Icon size={15} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #1c1f2e)' }}>
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div
                                style={{
                                  fontSize: 11.5,
                                  color: 'var(--text-secondary, #696e79)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 100,
                            background: '#cce6e1',
                            color: '#02604f',
                            fontWeight: 600,
                            flexShrink: 0
                          }}
                        >
                          Timetable
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Category 3: Announcements */}
              {filtered.announcements.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      padding: '6px 14px 4px',
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted, #94969f)'
                    }}
                  >
                    Announcements & Notices ({filtered.announcements.length})
                  </div>
                  {filtered.announcements.map((item) => {
                    const itemIdx = cumulativeIndex++;
                    const isSelected = itemIdx === activeIndex;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(itemIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 14px',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(225, 29, 85, 0.08)' : 'transparent',
                          transition: 'background 0.12s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 4,
                              background: '#fff2f4',
                              color: '#e11d55',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Icon size={15} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #1c1f2e)' }}>
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div
                                style={{
                                  fontSize: 11.5,
                                  color: 'var(--text-secondary, #696e79)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {item.date && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted, #94969f)' }}>{item.date}</span>
                          )}
                          <span
                            style={{
                              fontSize: 10.5,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: item.badgeColor ? `${item.badgeColor}18` : '#fff2f4',
                              color: item.badgeColor || '#e11d55',
                              fontWeight: 700
                            }}
                          >
                            {item.badge}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Category 4: Assignments */}
              {filtered.assignments.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      padding: '6px 14px 4px',
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted, #94969f)'
                    }}
                  >
                    Homework & Assignments ({filtered.assignments.length})
                  </div>
                  {filtered.assignments.map((item) => {
                    const itemIdx = cumulativeIndex++;
                    const isSelected = itemIdx === activeIndex;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(itemIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 14px',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(225, 29, 85, 0.08)' : 'transparent',
                          transition: 'background 0.12s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 4,
                              background: '#fbecd3',
                              color: '#8f5c12',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Icon size={15} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #1c1f2e)' }}>
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div
                                style={{
                                  fontSize: 11.5,
                                  color: 'var(--text-secondary, #696e79)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 10.5,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: item.badgeColor ? `${item.badgeColor}18` : '#fbecd3',
                            color: item.badgeColor || '#8f5c12',
                            fontWeight: 700,
                            flexShrink: 0
                          }}
                        >
                          {item.badge}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Category 5: Exams */}
              {filtered.exams.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      padding: '6px 14px 4px',
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted, #94969f)'
                    }}
                  >
                    Result ({filtered.exams.length})
                  </div>
                  {filtered.exams.map((item) => {
                    const itemIdx = cumulativeIndex++;
                    const isSelected = itemIdx === activeIndex;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(itemIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 14px',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(225, 29, 85, 0.08)' : 'transparent',
                          transition: 'background 0.12s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 4,
                              background: '#dde1f2',
                              color: '#48549a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Icon size={15} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #1c1f2e)' }}>
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div
                                style={{
                                  fontSize: 11.5,
                                  color: 'var(--text-secondary, #696e79)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 10.5,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: '#dde1f2',
                            color: '#48549a',
                            fontWeight: 700,
                            flexShrink: 0
                          }}
                        >
                          {item.badge}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Footer keyboard navigation hint */}
          <div
            style={{
              padding: '8px 14px 4px',
              borderTop: '1px solid var(--border, #f5f5f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--text-muted, #94969f)'
            }}
          >
            <span>
              Use <b>↑</b> <b>↓</b> to navigate · <b>↵ Enter</b> to select · <b>ESC</b> to close
            </span>
            <span style={{ color: '#e11d55', fontWeight: 600 }}>AttendoSchool Search</span>
          </div>
        </div>
      )}
    </div>
  );
}
