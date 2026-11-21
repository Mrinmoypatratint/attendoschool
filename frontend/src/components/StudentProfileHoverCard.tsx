export function formatDobOnly(val: unknown): string {
  if (!val) return '';
  const s = String(val).trim();
  if (!s || s === '—' || s === 'null' || s === 'undefined') return '';
  // Strip ISO time part (T...) or space-separated time
  const dateOnly = s.split('T')[0].split(' ')[0].trim();
  // If YYYY-MM-DD, convert to standard DD-MM-YYYY
  const ymd = dateOnly.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    return `${ymd[3].padStart(2, '0')}-${ymd[2].padStart(2, '0')}-${ymd[1]}`;
  }
  // If already DD-MM-YYYY
  const dmy = dateOnly.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return `${dmy[1].padStart(2, '0')}-${dmy[2].padStart(2, '0')}-${dmy[3]}`;
  }
  return dateOnly;
}

import { api } from '../api';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatGender } from '../utils/gender';
import {
  GraduationCap,
  Mail,
  Phone,
  Calendar,
  MapPin,
  User,
  ShieldCheck,
  Sparkles,
  X,
  Copy,
  Check,
  Hash,
  Cake,
  ExternalLink,
  ChevronRight,
  ChevronUp,
  Activity,
  FileCheck2,
  Award
} from 'lucide-react';

// In-memory cache for resolved student average marks to optimize repeat hovers
const studentAverageMarksCache = new Map<string, string>();

export interface StudentHoverData {
  id?: string;
  name: string;
  attendance_percentage?: number | string;
  attendancePercentage?: number | string;
  assignment_submissions_count?: number;
  assignmentSubmissionsCount?: number;
  submission_count?: number;
  average_marks?: number | string;
  averageMarks?: number | string;
  avg_marks?: number | string;
  first_name?: string;
  last_name?: string;
  roll_number?: string | number;
  rollNumber?: string | number;
  admission_number?: string;
  admissionNumber?: string;
  class_number?: number | string;
  class_id?: string;
  class_name?: string;
  class_label?: string;
  className?: string;
  section_id?: string;
  sectionId?: string;
  section_name?: string;
  sectionName?: string;
  section?: string;
  session?: string;
  session_name?: string;
  academic_year_id?: string;
  academic_session?: string;
  academicSession?: string;
  gender?: string;
  date_of_birth?: string;
  dob?: string;
  student_email?: string;
  email?: string;
  parent_name?: string;
  parentName?: string;
  parent_sms_number?: string;
  parent_phone?: string;
  parentPhone?: string;
  parent_email?: string;
  parentEmail?: string;
  address?: string;
  photo_url?: string;
  photoUrl?: string;
  school_name?: string;
  schoolName?: string;
}

interface StudentProfileHoverCardProps {
  student: StudentHoverData;
  activeSession?: string;
  children: React.ReactNode;
  /** 'student' (default on student directory): immediately displays roll no, admission no, gender, date of birth, parent details, with no toggle button or attendance metrics.
   *  'report': initial condensed view with 'View Details' button to expand attendance percentage and assignment counts.
   */
  mode?: 'student' | 'report';
  /** 'attendance': custom variant for Admin Attendance and Teacher Mentor Workspace popups
   *  (Average Marks card, Gender in badge row, no Active SIS badge).
   *  'directory': original student directory layout (Gender card, Active SIS badge, no Average Marks).
   */
  variant?: 'directory' | 'attendance';
}

export function StudentProfileHoverCard({
  student,
  activeSession,
  children,
  mode,
  variant
}: StudentProfileHoverCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [studentData, setStudentData] = useState<StudentHoverData>(student);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // Determine mode: explicitly passed or detected by route (default to 'report' on /reports, 'student' elsewhere)
  const isHashReport = typeof window !== 'undefined' && window.location.hash.toLowerCase().includes('/reports');
  const effectiveMode: 'student' | 'report' = mode || (isHashReport ? 'report' : 'student');
  const isReportMode = effectiveMode === 'report';
  const isExpanded = !isReportMode || showDetails;

  // Determine if this is an Attendance or Teacher Mentor Workspace profile popup
  const isHashAttendanceOrMentor = typeof window !== 'undefined' && (
    window.location.hash.toLowerCase().includes('/attendance') ||
    window.location.hash.toLowerCase().includes('/mentor-workspace') ||
    window.location.pathname.toLowerCase().includes('/attendance') ||
    window.location.pathname.toLowerCase().includes('/mentor-workspace')
  );
  const isAttendanceOrMentor =
    variant === 'attendance' ||
    (variant !== 'directory' && mode !== 'student' && (mode === 'report' || isHashAttendanceOrMentor));

  // Average Marks state for Attendance / Mentor Workspace
  const [avgMarks, setAvgMarks] = useState<string | null>(() => {
    const direct =
      studentData.average_marks ??
      studentData.averageMarks ??
      studentData.avg_marks ??
      (studentData as any).marks_average ??
      (studentData as any).marks_percentage;
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
      const num = Number(String(direct).replace('%', '').trim());
      return !isNaN(num) ? `${num.toFixed(1).replace(/\.0$/, '')}%` : String(direct);
    }
    const studentId = studentData.id || (studentData as any).student_id || (studentData as any).studentId;
    if (studentId && studentAverageMarksCache.has(studentId)) {
      return studentAverageMarksCache.get(studentId)!;
    }
    return null;
  });
  const [avgMarksLoading, setAvgMarksLoading] = useState(false);

  // Resolve student real average marks for Attendance & Mentor Workspace
  useEffect(() => {
    if (!isOpen || !isAttendanceOrMentor) return;

    // 1. Direct marks from studentData
    const direct =
      studentData.average_marks ??
      studentData.averageMarks ??
      studentData.avg_marks ??
      (studentData as any).marks_average ??
      (studentData as any).marks_percentage;
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
      const num = Number(String(direct).replace('%', '').trim());
      setAvgMarks(!isNaN(num) ? `${num.toFixed(1).replace(/\.0$/, '')}%` : String(direct));
      return;
    }

    const studentId = studentData.id || (studentData as any).student_id || (studentData as any).studentId;
    if (!studentId) {
      setAvgMarks('N/A');
      return;
    }

    // 2. Check in-memory cache for this session
    if (studentAverageMarksCache.has(studentId)) {
      setAvgMarks(studentAverageMarksCache.get(studentId)!);
      return;
    }

    const classId = studentData.class_id || (studentData as any).classId;
    const sectionId = studentData.section_id || (studentData as any).sectionId;
    const session = studentData.session || studentData.session_name || activeSession;

    if (classId && sectionId) {
      setAvgMarksLoading(true);
      let isMounted = true;

      api.get('/teacher/mentor/exams', {
        params: { class_id: classId, section_id: sectionId, session: session || undefined }
      }).then(async ({ data: examsList }) => {
        if (!isMounted) return;
        const exams = Array.isArray(examsList) ? examsList : [];
        const publishedExams = exams.filter((e: any) => (e.status || 'PUBLISHED') === 'PUBLISHED' && (Number(e.graded_count) || 0) > 0);

        if (publishedExams.length === 0) {
          studentAverageMarksCache.set(studentId, 'N/A');
          if (isMounted) {
            setAvgMarks('N/A');
            setAvgMarksLoading(false);
          }
          return;
        }

        const markPromises = publishedExams.map((ex: any) =>
          api.get('/teacher/mentor/exam-marks', {
            params: { class_id: classId, section_id: sectionId, exam_id: ex.id, session: session || undefined }
          }).then(res => ({
            exam: ex,
            students: Array.isArray(res.data?.students) ? res.data.students : []
          })).catch(() => null)
        );

        const examResults = await Promise.all(markPromises);
        if (!isMounted) return;

        let totalObtained = 0;
        let totalMax = 0;
        let validMarksCount = 0;

        for (const item of examResults) {
          if (!item) continue;
          const match = item.students.find((s: any) =>
            (s.student_id && (s.student_id === studentId || String(s.student_id) === String(studentId))) ||
            (s.id && (s.id === studentId || String(s.id) === String(studentId)))
          );
          if (match && match.marks_obtained !== null && match.marks_obtained !== undefined && match.marks_obtained !== '' && !isNaN(Number(match.marks_obtained))) {
            const obt = Number(match.marks_obtained);
            const maxVal = Number(item.exam.total_marks) || (item.exam.grading_system === 'CGPA' ? 10 : 100);
            if (maxVal > 0) {
              totalObtained += obt;
              totalMax += maxVal;
              validMarksCount++;
            }
          }
        }

        const resultVal = (validMarksCount > 0 && totalMax > 0)
          ? `${((totalObtained / totalMax) * 100).toFixed(1).replace(/\.0$/, '')}%`
          : 'N/A';

        studentAverageMarksCache.set(studentId, resultVal);
        if (isMounted) {
          setAvgMarks(resultVal);
          setAvgMarksLoading(false);
        }
      }).catch(() => {
        if (isMounted) {
          studentAverageMarksCache.set(studentId, 'N/A');
          setAvgMarks('N/A');
          setAvgMarksLoading(false);
        }
      });

      return () => { isMounted = false; };
    } else {
      setAvgMarks('N/A');
    }
  }, [isOpen, isAttendanceOrMentor, studentData.id, (studentData as any).student_id, (studentData as any).studentId, studentData.class_id, studentData.section_id, activeSession]);

  useEffect(() => {
    if (!isOpen) setShowDetails(false);
  }, [isOpen]);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStudentData(student);
  }, [student]);

  // When card opens, if essential fields are missing, fetch fresh details
  useEffect(() => {
    if (!isOpen) return;
    const studentId = studentData.id || (studentData as any).student_id || (studentData as any).studentId;
    const isMissingDetails = 
      (!studentData.admission_number && !studentData.admissionNumber && !(studentData as any).admission_no) ||
      (!studentData.email && !studentData.student_email) ||
      (!studentData.gender);

    if (isMissingDetails && studentId) {
      api.get('/people/students/' + studentId).then(({ data }) => {
        if (data) {
          setStudentData(prev => ({ ...prev, ...data }));
        }
      }).catch(() => {
        api.get('/students/' + studentId).then(({ data }) => {
          if (data) {
            setStudentData(prev => ({ ...prev, ...data }));
          }
        }).catch(() => {});
      });
    }
  }, [isOpen, studentData.id, (studentData as any).student_id, (studentData as any).studentId]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  const handleCopy = (text: string, key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1800);
  };

  // Close when pressing Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Derived student attributes
  const fullName = String(studentData.name || 'STUDENT').toUpperCase();
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ST';

  const roll = studentData.roll_number ?? studentData.rollNumber ?? (studentData as any).roll ?? (studentData as any).roll_no ?? (studentData as any).rollNo ?? '—';
  const adm = studentData.admission_number || studentData.admissionNumber || (studentData as any).admission_no || (studentData as any).admissionNo || (studentData as any).adm_no || (studentData as any).admNo || '—';
  const photo = studentData.photo_url || studentData.photoUrl;

  // Class label
  const cNum = Number(studentData.class_number);
  const cId = String(studentData.class_id || '');
  let classStr = 'Class 1';
  if (cNum === -1 || /l.?kg/i.test(cId)) classStr = 'L-KG';
  else if (cNum === 0 || /u.?kg/i.test(cId)) classStr = 'U-KG';
  else if (!isNaN(cNum) && cNum > 0) classStr = 'Class ' + cNum;
  else if (studentData.class_label || studentData.class_name || studentData.className) {
    const raw = String(studentData.class_label || studentData.class_name || studentData.className);
    classStr = raw.startsWith('Class') ? raw : ('Class ' + raw);
  }

  // Section label
  const rawSec = String(studentData.section_name || studentData.sectionName || studentData.section || 'A').trim();
  const secStr = rawSec.replace(/^section\s*/i, '').trim() || 'A';

  // Session
  const sessionStr =
    studentData.session ||
    studentData.session_name ||
    studentData.academic_session ||
    studentData.academicSession ||
    activeSession ||
    '2026–2027 Academic Session';

  // Gender & DOB
  const genderStr = formatGender(studentData.gender || (studentData as any).sex) || 'Not Specified';
  const dobRaw = studentData.date_of_birth || studentData.dob || (studentData as any).birth_date || '';
  const dobClean = formatDobOnly(dobRaw);
  const dobStr = dobClean && dobClean !== '—' ? dobClean : null;

  // Emails & parent contact
  const studentEmail = studentData.student_email || studentData.email || (studentData as any).user_email;
  const parentName = studentData.parent_name || studentData.parentName || (studentData as any).father_name || (studentData as any).mother_name || (studentData as any).guardian_name || 'Parent / Guardian';
  const parentPhone = studentData.parent_sms_number || studentData.parent_phone || studentData.parentPhone || (studentData as any).parent_whatsapp || (studentData as any).parent_whatsapp_no || (studentData as any).phone || (studentData as any).father_phone || (studentData as any).mother_phone;
  const parentEmail = studentData.parent_email || studentData.parentEmail;
  const address = studentData.address;

  // Real Attendance Percentage and Assignment Submission Counts
  const attRate =
    studentData.attendance_percentage ??
    studentData.attendancePercentage ??
    (studentData as any).attendance_rate ??
    (student as any).attendance_percentage;
  const attRateNum = attRate !== undefined && attRate !== null && !isNaN(Number(attRate))
    ? Number(attRate)
    : 0;
  const displayAttRate = attRateNum.toFixed(2).replace(/\.00$/, '');

  const subCount =
    studentData.assignment_submissions_count ??
    studentData.assignmentSubmissionsCount ??
    studentData.submission_count ??
    (studentData as any).submissions_count;
  const displaySubmissionCount = subCount !== undefined && subCount !== null && !isNaN(Number(subCount))
    ? Number(subCount)
    : 0;

  return (
    <>
      <span
        ref={triggerRef}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e as any);
          }
        }}
        role="button"
        tabIndex={0}
        title="Click to view student quick profile"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
          borderRadius: 4,
          padding: '2px 6px',
          margin: '-2px -6px',
          color: 'var(--text, #282c3f)',
          textDecoration: 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#e11d55';
          e.currentTarget.style.backgroundColor = 'rgba(225, 29, 85, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text, #282c3f)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        className="student-name-click-trigger"
      >
        {children}
      </span>

      {isOpen &&
        createPortal(
          <div
            className="student-profile-backdrop"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99999,
              backgroundColor: 'rgba(28, 31, 46, 0.52)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
          >
            <div
              ref={cardRef}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 440,
                backgroundColor: 'var(--bg-card, #ffffff)',
                borderRadius: 4,
                boxShadow:
                  'none',
                border: '1px solid var(--border, #eaeaec)',
                overflow: 'hidden',
                zIndex: 100000,
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                animation: 'studentProfileCardPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                pointerEvents: 'auto',
                position: 'relative'
              }}
            >
              {/* Header Gradient Banner with Ambient Glow Orbs */}
              <div
                style={{
                  height: 74,
                  background: '#7a1031',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '14px 16px 0 16px',
                  overflow: 'hidden'
                }}
              >
                {/* Ambient Decorative Lighting */}
                <div
                  style={{
                    position: 'absolute',
                    top: -30,
                    right: 40,
                    width: 140,
                    height: 140,
                    borderRadius: '50%',
                    background: 'transparent',
                    pointerEvents: 'none'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: -20,
                    left: 80,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'transparent',
                    pointerEvents: 'none'
                  }}
                />

                {/* Left Badge: Student Profile */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '0.02em',
                    background: 'rgba(255, 255, 255, 0.18)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    padding: '4px 10px',
                    borderRadius: 999,
                    boxShadow: 'none'
                  }}
                >
                  <GraduationCap size={13} />
                  <span>Student Profile</span>
                </div>

                {/* Right Controls: Active SIS Status (Student Directory only) + Close Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 2 }}>
                  {!isAttendanceOrMentor && (
                    <div
                      style={{
                        fontSize: 11,
                        color: '#fff2f4',
                        fontWeight: 650,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        background: 'rgba(255, 255, 255, 0.16)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        padding: '4px 9px',
                        borderRadius: 999
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: '#339988',
                          boxShadow: 'none',
                          display: 'inline-block'
                        }}
                      />
                      <span>Active SIS</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                    }}
                    title="Close profile (Esc)"
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '50%',
                      width: 26,
                      height: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      padding: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.35)';
                      e.currentTarget.style.transform = 'scale(1.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Profile Avatar & Hero Section */}
              <div style={{ padding: '0 18px 14px 18px', position: 'relative' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    marginTop: -34,
                    marginBottom: 12
                  }}
                >
                  {/* Avatar Container with Multi-layer Shadow & Online Badge */}
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        width: 66,
                        height: 66,
                        borderRadius: '50%',
                        border: '3.5px solid var(--bg-card, #ffffff)',
                        boxShadow: 'none',
                        backgroundColor: '#e11d55',
                        background: '#e11d55',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 22,
                        letterSpacing: '0.04em',
                        overflow: 'hidden',
                        position: 'relative',
                        flexShrink: 0
                      }}
                    >
                      <span style={{ position: 'absolute', userSelect: 'none' }}>{initials}</span>
                      {photo && (
                        <img
                          src={photo}
                          alt={fullName}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            position: 'relative',
                            zIndex: 1
                          }}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    {/* Active Status Badge on Avatar */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        right: 2,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        backgroundColor: '#03806a',
                        border: '2.5px solid var(--bg-card, #ffffff)',
                        boxShadow: 'none'
                      }}
                      title="Enrolled & Active"
                    />
                  </div>

                  {/* Roll & Admission ID Micro-Badges */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {roll !== '—' && (
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 750,
                          color: '#e11d55',
                          backgroundColor: 'rgba(225, 29, 85, 0.12)',
                          border: '1px solid rgba(225, 29, 85, 0.25)',
                          padding: '3px 9px',
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: 'none'
                        }}
                        title="Student Roll Number"
                      >
                        <Hash size={12} color="#e11d55" />
                        <span>Roll: {roll}</span>
                      </div>
                    )}
                    {adm !== '—' && (
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 750,
                          color: '#e11d55',
                          backgroundColor: 'rgba(225, 29, 85, 0.12)',
                          border: '1px solid rgba(225, 29, 85, 0.25)',
                          padding: '3px 9px',
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: 'none'
                        }}
                        title="Official Student Admission ID"
                      >
                        <Hash size={12} color="#e11d55" />
                        <span>Adm: {adm}</span>
                      </div>
                    )}
                    {isAttendanceOrMentor && genderStr && (
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 750,
                          color:
                            genderStr.toLowerCase() === 'female'
                              ? '#e11d55'
                              : genderStr.toLowerCase() === 'male'
                              ? '#5c6bc0'
                              : 'var(--text-secondary, #696e79)',
                          backgroundColor:
                            genderStr.toLowerCase() === 'female'
                              ? 'rgba(225, 29, 85, 0.12)'
                              : genderStr.toLowerCase() === 'male'
                              ? 'rgba(92, 107, 192, 0.12)'
                              : 'rgba(105, 110, 121, 0.12)',
                          border: `1px solid ${
                            genderStr.toLowerCase() === 'female'
                              ? 'rgba(225, 29, 85, 0.25)'
                              : genderStr.toLowerCase() === 'male'
                              ? 'rgba(92, 107, 192, 0.25)'
                              : 'rgba(105, 110, 121, 0.25)'
                          }`,
                          padding: '3px 9px',
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: 'none'
                        }}
                        title={`Student Gender: ${genderStr}`}
                      >
                        <User
                          size={12}
                          color={
                            genderStr.toLowerCase() === 'female'
                              ? '#e11d55'
                              : genderStr.toLowerCase() === 'male'
                              ? '#5c6bc0'
                              : '#696e79'
                          }
                        />
                        <span>{genderStr}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Student Full Name & Academic Grouping */}
                <div style={{ marginBottom: 10 }}>
                  <h3
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: 18,
                      fontWeight: 800,
                      color: 'var(--text, #1c1f2e)',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.25
                    }}
                  >
                    {fullName}
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#e11d55',
                        backgroundColor: 'rgba(225, 29, 85, 0.12)',
                        border: '1px solid rgba(225, 29, 85, 0.25)',
                        padding: '2px 8px',
                        borderRadius: 4
                      }}
                    >
                      {classStr} • Section {secStr}
                    </span>

                    <span
                      style={{
                        fontSize: 11.5,
                        color: 'var(--text-muted, #696e79)',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Calendar size={12} color="#94969f" />
                      <span>{sessionStr}</span>
                    </span>
                  </div>
                </div>

                {/* Expanded Details Revealed (Immediately in 'student' mode, or when 'View Details' clicked in 'report' mode) */}
                {isExpanded && (
                  <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
                    {/* Attendance Rate & Assignment Submissions Cards (Only shown in report mode) */}
                    {isReportMode && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 8,
                          marginBottom: 10
                        }}
                      >
                        {/* Attendance Percentage Card */}
                        <div
                          style={{
                            backgroundColor: 'var(--card-subtle, #f9f9fa)',
                            padding: '8px 12px',
                            borderRadius: 4,
                            border: '1px solid var(--border, #eaeaec)'
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'var(--text-muted, #696e79)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Activity size={11} color="#e11d55" />
                            <span>Attendance Rate</span>
                          </div>
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 800,
                              color: attRateNum >= 75 ? '#03806a' : attRateNum > 0 ? '#b8781c' : 'var(--text, #1c1f2e)',
                              marginTop: 2
                            }}
                          >
                            {displayAttRate}%
                          </div>
                        </div>

                        {/* Assignment Submission Count Card */}
                        <div
                          style={{
                            backgroundColor: 'var(--card-subtle, #f9f9fa)',
                            padding: '8px 12px',
                            borderRadius: 4,
                            border: '1px solid var(--border, #eaeaec)'
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'var(--text-muted, #696e79)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <FileCheck2 size={11} color="#5c6bc0" />
                            <span>Assignments</span>
                          </div>
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 800,
                              color: '#e11d55',
                              marginTop: 2
                            }}
                          >
                            {displaySubmissionCount} Submitted
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Attributes 2-Column Cards (Average Marks or Gender & Date of Birth) */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 8,
                        marginBottom: 10
                      }}
                    >
                      {isAttendanceOrMentor ? (
                        /* Average Marks Card (Attendance & Mentor Workspace) */
                        <div
                          style={{
                            backgroundColor: 'var(--card-subtle, #f9f9fa)',
                            padding: '8px 12px',
                            borderRadius: 4,
                            border: '1px solid var(--border, #eaeaec)'
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'var(--text-muted, #696e79)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Award size={11} color="#e11d55" />
                            <span>Average Marks</span>
                          </div>
                          <div style={{ marginTop: 2 }}>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: avgMarks && avgMarks !== 'N/A' ? '#03806a' : 'var(--text-muted, #94969f)',
                                fontFamily: 'Inter, system-ui, sans-serif'
                              }}
                            >
                              {avgMarksLoading ? '...' : (avgMarks || 'N/A')}
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Gender Card (Student Directory) */
                        <div
                          style={{
                            backgroundColor: 'var(--card-subtle, #f9f9fa)',
                            padding: '8px 12px',
                            borderRadius: 4,
                            border: '1px solid var(--border, #eaeaec)'
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'var(--text-muted, #696e79)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}
                          >
                            Gender
                          </div>
                          <div style={{ marginTop: 2 }}>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color:
                                  genderStr.toLowerCase() === 'female'
                                    ? '#e11d55'
                                    : genderStr.toLowerCase() === 'male'
                                    ? '#e11d55'
                                    : 'var(--text, #3e4152)',
                                backgroundColor:
                                  genderStr.toLowerCase() === 'female'
                                    ? 'rgba(225, 29, 85, 0.12)'
                                    : genderStr.toLowerCase() === 'male'
                                    ? 'rgba(225, 29, 85, 0.12)'
                                    : 'var(--bg-card, #f5f5f6)',
                                padding: '1px 6px',
                                borderRadius: 4,
                                display: 'inline-block'
                              }}
                            >
                              {genderStr}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Date of Birth Card */}
                      <div
                        style={{
                          backgroundColor: 'var(--card-subtle, #f9f9fa)',
                          padding: '8px 12px',
                          borderRadius: 4,
                          border: '1px solid var(--border, #eaeaec)'
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'var(--text-muted, #696e79)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Cake size={10} color="#94969f" />
                          <span>Date of Birth</span>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: dobStr ? 650 : 500,
                            color: dobStr ? 'var(--text, #1c1f2e)' : 'var(--text-muted, #94969f)',
                            fontStyle: dobStr ? 'normal' : 'italic',
                            marginTop: 2
                          }}
                        >
                          {dobStr || 'Not Recorded'}
                        </div>
                      </div>
                    </div>

                    {/* Contact & Family Information Cards */}
                    <div
                      style={{
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        border: '1px solid var(--border, #eaeaec)',
                        borderRadius: 4,
                        padding: '8px 10px',
                        display: 'grid',
                        gap: 6
                      }}
                    >
                      {/* Student Email */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '4px 6px',
                          borderRadius: 4,
                          backgroundColor: 'var(--card-subtle, #f9f9fa)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              backgroundColor: 'rgba(225, 29, 85, 0.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Mail size={12} color="#e11d55" />
                          </div>
                          {studentEmail ? (
                            <a
                              href={`mailto:${studentEmail}`}
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#e11d55',
                                textDecoration: 'none',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap'
                              }}
                              title={`Email student: ${studentEmail}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {studentEmail}
                            </a>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted, #94969f)', fontStyle: 'italic' }}>
                              No email recorded
                            </span>
                          )}
                        </div>

                        {studentEmail && (
                          <button
                            type="button"
                            onClick={(e) => handleCopy(studentEmail, 'student_email', e)}
                            title="Copy student email"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 3,
                              color: copiedKey === 'student_email' ? '#03806a' : '#94969f',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            {copiedKey === 'student_email' ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>

                      {/* Parent / Guardian Name */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '4px 6px',
                          borderRadius: 4,
                          backgroundColor: 'var(--card-subtle, #f9f9fa)'
                        }}
                      >
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(92, 107, 192, 0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <User size={12} color="#5c6bc0" />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #3e4152)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--text-muted, #696e79)' }}>Parent: </span>
                          <b style={{ color: 'var(--text, #1c1f2e)' }}>{parentName}</b>
                        </div>
                      </div>

                      {/* Parent Phone & Email */}
                      {((parentPhone && parentPhone !== '—') || parentEmail) && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 6px',
                            borderRadius: 4,
                            backgroundColor: 'var(--card-subtle, #f9f9fa)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                backgroundColor: 'rgba(3, 128, 106, 0.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              <Phone size={12} color="#03806a" />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                              {parentPhone && parentPhone !== '—' && (
                                <a
                                  href={`tel:${parentPhone}`}
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: '#03806a',
                                    textDecoration: 'none',
                                    fontFamily: 'ui-monospace, SFMono-Regular, monospace'
                                  }}
                                  title={`Call parent: ${parentPhone}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {parentPhone}
                                </a>
                              )}
                              {parentEmail && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--text-muted, #696e79)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title={parentEmail}
                                >
                                  • {parentEmail}
                                </span>
                              )}
                            </div>
                          </div>

                          {parentPhone && parentPhone !== '—' && (
                            <button
                              type="button"
                              onClick={(e) => handleCopy(parentPhone, 'parent_phone', e)}
                              title="Copy parent phone number"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 3,
                                color: copiedKey === 'parent_phone' ? '#03806a' : '#94969f',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              {copiedKey === 'parent_phone' ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Address (if present) */}
                      {address && address.trim() && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 6px',
                            borderRadius: 4,
                            backgroundColor: 'var(--card-subtle, #f9f9fa)'
                          }}
                        >
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              backgroundColor: 'rgba(233, 162, 59, 0.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <MapPin size={12} color="#e9a23b" />
                          </div>
                          <span
                            style={{
                              fontSize: 11.5,
                              color: 'var(--text-secondary, #535766)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={address}
                          >
                            {address}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Premium Status Stripe (Single unified footer bar) */}
              <div
                style={{
                  backgroundColor: 'var(--card-subtle, #f9f9fa)',
                  borderTop: '1px solid var(--border, #eaeaec)',
                  padding: '9px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: 'var(--text-muted, #696e79)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#03806a', fontWeight: 700 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: '#03806a',
                      boxShadow: 'none',
                      display: 'inline-block'
                    }}
                  />
                  <span>Enrolled Student</span>
                </div>

                {isReportMode ? (
                  /* View Details Button in Right Side Bottom (Report Mode Only) */
                  <button
                    type="button"
                    onClick={() => setShowDetails(prev => !prev)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 4,
                      border: '1px solid #e11d55',
                      backgroundColor: showDetails ? 'rgba(225, 29, 85, 0.1)' : '#e11d55',
                      color: showDetails ? '#c0174a' : '#ffffff',
                      cursor: 'pointer',
                      boxShadow: 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{showDetails ? 'Hide Details' : 'View Details'}</span>
                    {showDetails ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4.5, color: 'var(--text-muted, #535766)', fontWeight: 600 }}>
                    <ShieldCheck size={13} color="#e11d55" />
                    <span>Verified Record</span>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default StudentProfileHoverCard;
