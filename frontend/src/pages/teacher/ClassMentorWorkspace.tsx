import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users, ShieldCheck, FileText, RefreshCw, AlertCircle, Loader2, Award,
  Plus, Edit2, Trash2, Calendar, BookOpen, Search, ArrowLeft, Save, CheckCircle2,
  Check, X, TrendingUp, Maximize2, Minimize2
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

interface MentoredExam {
  id: string;
  title: string;
  subject_id?: string;
  subject_name?: string;
  subject_code?: string;
  grading_system?: 'MARKS' | 'CGPA' | 'GRADE';
  term?: string;
  exam_date: string;
  total_marks: number;
  passing_marks: number;
  graded_count?: number;
  total_students?: number;
  average_marks?: number;
  pass_count?: number;
  created_at?: string;
}

interface StudentWithMark {
  student_id: string;
  name: string;
  roll_number: string;
  admission_number: string;
  photo_url?: string;
  email?: string;
  marks_obtained: string | number;
  grade: string;
  remarks: string;
}

interface SubjectItem {
  id: string;
  name: string;
  code?: string;
}

function computeGradeFromPercentage(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

function formatDate(val?: string): string {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return val;
  }
}

function getGradeBadgeClass(grade?: string) {
  const g = (grade || '').toUpperCase().trim();
  if (g.startsWith('A')) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  }
  if (g.startsWith('B')) {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
  }
  if (g.startsWith('C')) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  }
  return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
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

  // Result Publish State
  const [exams, setExams] = useState<MentoredExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examsError, setExamsError] = useState<string | null>(null);

  // Subject options (strictly from School Admin subjects)
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);

  // Publishing / Editing View State
  const [isPublishingView, setIsPublishingView] = useState(false);
  const [editingExam, setEditingExam] = useState<MentoredExam | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formGradingSystem, setFormGradingSystem] = useState<'MARKS' | 'CGPA' | 'GRADE'>('MARKS');
  const [formTotalValue, setFormTotalValue] = useState<number | string>(100);
  const [formPassingMarks, setFormPassingMarks] = useState<number | string>(40);
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formSubjectName, setFormSubjectName] = useState('');
  const [formExamDate, setFormExamDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Student Marks Table
  const [studentsWithMarks, setStudentsWithMarks] = useState<StudentWithMark[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submittingResults, setSubmittingResults] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Graded Students View Modal State
  const [showGradedModal, setShowGradedModal] = useState(false);
  const [isGradedModalMaximized, setIsGradedModalMaximized] = useState(false);
  const [selectedExamForGradedView, setSelectedExamForGradedView] = useState<MentoredExam | null>(null);
  const [gradedStudentsList, setGradedStudentsList] = useState<StudentWithMark[]>([]);
  const [loadingGradedModal, setLoadingGradedModal] = useState(false);
  const [gradedModalFilter, setGradedModalFilter] = useState<'GRADED' | 'ALL'>('GRADED');
  const [gradedModalSearch, setGradedModalSearch] = useState('');

  // Active Academic Session (synced with header selector)
  const [activeSession, setActiveSession] = useState<string>(() => {
    return localStorage.getItem('attendo_academic_session') || localStorage.getItem('attendo_active_academic_year') || '';
  });
  const [activeYearId, setActiveYearId] = useState<string>(() => {
    return localStorage.getItem('attendo_active_academic_year_id') || '';
  });

  useEffect(() => {
    const syncSession = () => {
      const next = localStorage.getItem('attendo_academic_session') || localStorage.getItem('attendo_active_academic_year') || '';
      const nextId = localStorage.getItem('attendo_active_academic_year_id') || '';
      setActiveSession(next);
      setActiveYearId(nextId);
    };
    window.addEventListener('sessionChanged', syncSession);
    window.addEventListener('storage', syncSession);
    return () => {
      window.removeEventListener('sessionChanged', syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, []);

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

  // Fetch school subjects created by School Admin
  useEffect(() => {
    api.get('/subjects')
      .then((res) => {
        setSubjects(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        setSubjects([]);
      });
  }, []);

  // 2. Fetch Published Exams for the Mentored Section (filtered by active session)
  const loadExams = useCallback(async (classId: string, sectionId: string, sessionOverride?: string, yearIdOverride?: string) => {
    setLoadingExams(true);
    setExamsError(null);
    const sessionToUse = sessionOverride !== undefined ? sessionOverride : activeSession;
    const yearIdToUse = yearIdOverride !== undefined ? yearIdOverride : activeYearId;
    try {
      const res = await api.get('/teacher/mentor/exams', {
        params: {
          class_id: classId,
          section_id: sectionId,
          ...(sessionToUse ? { session: sessionToUse } : {}),
          ...(yearIdToUse ? { academicYearId: yearIdToUse } : {})
        }
      });
      setExams(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to load mentored exams:', err);
      setExamsError(err?.response?.data?.message || 'Unable to load examination results.');
    } finally {
      setLoadingExams(false);
    }
  }, [activeSession, activeYearId]);

  useEffect(() => {
    if (activeTab === 'RESULTS' && selectedSection) {
      loadExams(selectedSection.class_id, selectedSection.section_id, activeSession, activeYearId);
      // If user switches session while inside the publish/edit screen, refresh or return to list
      if (isPublishingView) {
        if (editingExam) {
          setIsPublishingView(false);
          setEditingExam(null);
        } else {
          setLoadingStudents(true);
          setStudentsWithMarks([]);
          api.get('/teacher/mentor/exam-marks', {
            params: {
              class_id: selectedSection.class_id,
              section_id: selectedSection.section_id,
              ...(activeSession ? { session: activeSession } : {}),
              ...(activeYearId ? { academicYearId: activeYearId } : {})
            }
          })
            .then((res) => {
              const stList: StudentWithMark[] = (res.data?.students || []).map((s: any) => ({
                student_id: s.student_id || s.id,
                name: s.name,
                roll_number: s.roll_number || '1',
                admission_number: s.admission_number || '',
                photo_url: s.photo_url,
                email: s.email,
                marks_obtained: '',
                grade: '',
                remarks: ''
              }));
              setStudentsWithMarks(stList);
            })
            .catch(() => setStudentsWithMarks([]))
            .finally(() => setLoadingStudents(false));
        }
      }
    }
  }, [activeTab, selectedSection, activeSession, activeYearId, loadExams]);

  // Start creating new assessment
  const handleStartNewAssessment = async () => {
    if (!selectedSection) return;
    setEditingExam(null);
    setFormTitle('');
    setFormGradingSystem('MARKS');
    setFormTotalValue(100);
    setFormPassingMarks(40);
    const firstSub = subjects[0];
    setFormSubjectId(firstSub ? firstSub.id : '');
    setFormSubjectName(firstSub ? firstSub.name : '');
    setFormExamDate(new Date().toISOString().slice(0, 10));
    setPublishSuccessMsg(null);
    setPublishError(null);
    setStudentSearch('');
    setIsPublishingView(true);
    setLoadingStudents(true);

    try {
      const res = await api.get('/teacher/mentor/exam-marks', {
        params: {
          class_id: selectedSection.class_id,
          section_id: selectedSection.section_id,
          ...(activeSession ? { session: activeSession } : {}),
          ...(activeYearId ? { academicYearId: activeYearId } : {})
        }
      });
      const stList: StudentWithMark[] = (res.data?.students || []).map((s: any) => ({
        student_id: s.student_id || s.id,
        name: s.name,
        roll_number: s.roll_number || '1',
        admission_number: s.admission_number || '',
        photo_url: s.photo_url,
        email: s.email,
        marks_obtained: '',
        grade: '',
        remarks: ''
      }));
      setStudentsWithMarks(stList);
    } catch (err: any) {
      console.error('Failed to load students for exam:', err);
      setPublishError(err?.response?.data?.message || 'Could not load student list for this class.');
    } finally {
      setLoadingStudents(false);
    }
  };

  // Start editing existing assessment
  const handleStartEditAssessment = async (exam: MentoredExam, onlyGraded = false) => {
    if (!selectedSection) return;
    setEditingExam(exam);
    setFormTitle(exam.title);
    const sys = (exam.grading_system as 'MARKS' | 'CGPA' | 'GRADE') || 'MARKS';
    setFormGradingSystem(sys);
    setFormTotalValue(exam.total_marks || (sys === 'CGPA' ? 10.0 : 100));
    setFormPassingMarks(exam.passing_marks || 40);
    const matchedSubject = exam.subject_id
      ? subjects.find(s => s.id === exam.subject_id)
      : subjects.find(s => s.name.toLowerCase() === String(exam.subject_name || '').toLowerCase());
    setFormSubjectId(matchedSubject?.id || exam.subject_id || '');
    setFormSubjectName(matchedSubject?.name || exam.subject_name || '');
    setFormExamDate(exam.exam_date ? exam.exam_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setPublishSuccessMsg(null);
    setPublishError(null);
    setStudentSearch('');
    setIsPublishingView(true);
    setLoadingStudents(true);

    try {
      const res = await api.get('/teacher/mentor/exam-marks', {
        params: {
          class_id: selectedSection.class_id,
          section_id: selectedSection.section_id,
          exam_id: exam.id,
          ...(activeSession ? { session: activeSession } : {}),
          ...(activeYearId ? { academicYearId: activeYearId } : {})
        }
      });
      const stList: StudentWithMark[] = (res.data?.students || []).map((s: any) => ({
        student_id: s.student_id || s.id,
        name: s.name,
        roll_number: s.roll_number || '1',
        admission_number: s.admission_number || '',
        photo_url: s.photo_url,
        email: s.email,
        marks_obtained: s.marks_obtained !== null && s.marks_obtained !== undefined ? s.marks_obtained : '',
        grade: s.grade || '',
        remarks: s.remarks || ''
      }));
      if (onlyGraded) {
        const gradedOnly = stList.filter(
          (s) =>
            (s.marks_obtained !== '' && s.marks_obtained !== null && s.marks_obtained !== undefined) ||
            (s.grade && s.grade.trim() !== '')
        );
        setStudentsWithMarks(gradedOnly.length > 0 ? gradedOnly : stList);
      } else {
        setStudentsWithMarks(stList);
      }
    } catch (err: any) {
      console.error('Failed to load students for exam:', err);
      setPublishError(err?.response?.data?.message || 'Could not load student marks for this exam.');
    } finally {
      setLoadingStudents(false);
    }
  };

  // Handle Mark / Score Change for a student
  const handleStudentScoreChange = (studentId: string, val: string) => {
    const totalNum = Number(formTotalValue) || (formGradingSystem === 'CGPA' ? 10 : 100);
    const passNum = Number(formPassingMarks) || (formGradingSystem === 'CGPA' ? 4 : 40);

    setStudentsWithMarks(prev => prev.map(s => {
      if (s.student_id !== studentId) return s;
      if (val === '') {
        return { ...s, marks_obtained: '', grade: '', remarks: '' };
      }
      const numVal = Math.min(totalNum, Math.max(0, Number(val)));
      const pct = totalNum > 0 ? (numVal / totalNum) * 100 : 0;
      const grade = computeGradeFromPercentage(pct);
      const defaultRemark = numVal >= passNum ? 'Good performance' : 'Needs improvement';
      return {
        ...s,
        marks_obtained: numVal,
        grade,
        remarks: s.remarks ? s.remarks : defaultRemark
      };
    }));
  };

  const handleStudentGradeChange = (studentId: string, grade: string) => {
    setStudentsWithMarks(prev => prev.map(s => s.student_id === studentId ? { ...s, grade } : s));
  };

  const handleStudentRemarksChange = (studentId: string, remarks: string) => {
    setStudentsWithMarks(prev => prev.map(s => s.student_id === studentId ? { ...s, remarks } : s));
  };

  // Publish / Save Results to Backend
  const handleSaveAndPublish = async () => {
    if (!selectedSection) return;
    if (!formTitle.trim()) {
      setPublishError('Please enter an assessment title.');
      return;
    }
    if (!formExamDate) {
      setPublishError('Please select an examination date.');
      return;
    }

    let totalScore = 100;
    let passingScore = 40;

    if (formGradingSystem === 'MARKS') {
      totalScore = Number(formTotalValue);
      if (isNaN(totalScore) || totalScore <= 0) {
        setPublishError('Total marks must be greater than 0.');
        return;
      }
      passingScore = Number(formPassingMarks) || Math.round(totalScore * 0.4);
    } else if (formGradingSystem === 'CGPA') {
      totalScore = Number(formTotalValue);
      if (isNaN(totalScore) || totalScore <= 0) {
        setPublishError('Total CGPA scale must be greater than 0.');
        return;
      }
      passingScore = Number(formPassingMarks) || 4.0;
    } else if (formGradingSystem === 'GRADE') {
      totalScore = 100;
      passingScore = 40;
    }

    setSubmittingResults(true);
    setPublishError(null);
    setPublishSuccessMsg(null);

    try {
      const resolvedSubject = subjects.find(s => s.id === formSubjectId);
      const finalSubjectName = resolvedSubject?.name || formSubjectName || '';
      if (!formSubjectId && !finalSubjectName) {
        setPublishError('Please select a subject.');
        setSubmittingResults(false);
        return;
      }

      const payload = {
        examId: editingExam?.id,
        classId: selectedSection.class_id,
        sectionId: selectedSection.section_id,
        subjectId: formSubjectId || undefined,
        subjectName: finalSubjectName,
        title: formTitle.trim(),
        gradingSystem: formGradingSystem,
        examDate: formExamDate || new Date().toISOString().slice(0, 10),
        totalMarks: totalScore,
        passingMarks: passingScore,
        ...(activeSession ? { session: activeSession } : {}),
        ...(activeYearId ? { academicYearId: activeYearId } : {}),
        results: studentsWithMarks.map(s => ({
          studentId: s.student_id,
          marksObtained: formGradingSystem === 'GRADE'
            ? null
            : (s.marks_obtained !== '' && s.marks_obtained !== null && !isNaN(Number(s.marks_obtained)) ? Number(s.marks_obtained) : null),
          grade: s.grade || undefined,
          remarks: s.remarks || undefined
        }))
      };

      const res = await api.post('/teacher/mentor/publish-results', payload);
      setPublishSuccessMsg(res.data?.message || 'Assessment results published and synced to student profiles successfully!');
      // Reload exam list
      await loadExams(selectedSection.class_id, selectedSection.section_id);
      setTimeout(() => {
        setIsPublishingView(false);
      }, 1200);
    } catch (err: any) {
      console.error('Publish error:', err);
      setPublishError(err?.response?.data?.message || 'Failed to publish assessment results.');
    } finally {
      setSubmittingResults(false);
    }
  };

  // Delete Exam
  const handleDeleteExam = async (examId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}" and all associated student marks?`)) return;
    try {
      await api.delete(`/teacher/mentor/exams/${examId}`);
      if (selectedSection) {
        await loadExams(selectedSection.class_id, selectedSection.section_id);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete examination.');
    }
  };

  // Open Graded Students Viewer Modal
  const handleOpenGradedStudentsModal = async (exam: MentoredExam) => {
    if (!selectedSection) return;
    setSelectedExamForGradedView(exam);
    setShowGradedModal(true);
    setIsGradedModalMaximized(false);
    setLoadingGradedModal(true);
    setGradedModalFilter('GRADED');
    setGradedModalSearch('');
    setGradedStudentsList([]);

    try {
      let rawStudents: any[] = [];
      let fetchedFromExamMarks = false;
      try {
        const res = await api.get('/teacher/mentor/exam-marks', {
          params: {
            class_id: selectedSection.class_id,
            section_id: selectedSection.section_id,
            exam_id: exam.id,
            ...(activeSession ? { session: activeSession } : {}),
            ...(activeYearId ? { academicYearId: activeYearId } : {})
          }
        });
        if (Array.isArray(res.data?.students)) {
          rawStudents = res.data.students;
          fetchedFromExamMarks = true;
        }
      } catch (err) {
        console.warn('Error fetching exam-marks for graded modal:', err);
      }

      if (!fetchedFromExamMarks && rawStudents.length === 0) {
        try {
          const res2 = await api.get(`/teacher/classes/${selectedSection.class_id}/${selectedSection.section_id}/students`);
          if (Array.isArray(res2.data) && res2.data.length > 0) {
            rawStudents = res2.data;
          }
        } catch (_e) {
          try {
            const res3 = await api.get(`/teacher/students/${selectedSection.class_id}/${selectedSection.section_id}`);
            if (Array.isArray(res3.data) && res3.data.length > 0) {
              rawStudents = res3.data;
            }
          } catch (_e2) {}
        }
      }

      const mapped: StudentWithMark[] = rawStudents.map((s: any) => ({
        student_id: s.id || s.student_id,
        name: s.name || s.fullName || 'Student',
        roll_number: String(s.roll_number || s.rollNumber || '—'),
        admission_number: String(s.admission_number || s.admissionNumber || s.admission_no || '—'),
        photo_url: s.photo_url || s.photoUrl,
        email: s.email,
        marks_obtained: s.marks_obtained !== undefined && s.marks_obtained !== null ? s.marks_obtained : '',
        grade: s.grade || '',
        remarks: s.remarks || ''
      }));

      // Sort by roll number numerically (1, 2, 3...)
      mapped.sort((a, b) =>
        String(a.roll_number || '').localeCompare(String(b.roll_number || ''), undefined, { numeric: true })
      );

      setGradedStudentsList(mapped);
    } catch (err: any) {
      console.error('Failed to load graded students:', err);
    } finally {
      setLoadingGradedModal(false);
    }
  };

  // Graded Count for modal
  const modalGradedCount = useMemo(() => {
    return gradedStudentsList.filter(
      (s) =>
        (s.marks_obtained !== '' && s.marks_obtained !== null && s.marks_obtained !== undefined) ||
        (s.grade && s.grade.trim() !== '')
    ).length;
  }, [gradedStudentsList]);

  // Filtered Students inside Graded Modal
  const modalFilteredStudents = useMemo(() => {
    let list = gradedStudentsList;
    if (gradedModalFilter === 'GRADED') {
      list = list.filter(
        (s) =>
          (s.marks_obtained !== '' && s.marks_obtained !== null && s.marks_obtained !== undefined) ||
          (s.grade && s.grade.trim() !== '')
      );
    }
    if (!gradedModalSearch.trim()) return list;
    const q = gradedModalSearch.toLowerCase().trim();
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        s.admission_number.toLowerCase().includes(q) ||
        s.remarks.toLowerCase().includes(q)
    );
  }, [gradedStudentsList, gradedModalFilter, gradedModalSearch]);

  // Filtered Students for the entry view
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return studentsWithMarks;
    const q = studentSearch.toLowerCase().trim();
    return studentsWithMarks.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.roll_number.toLowerCase().includes(q) ||
      s.admission_number.toLowerCase().includes(q)
    );
  }, [studentsWithMarks, studentSearch]);

  // Overall class stats from exams list
  const examStats = useMemo(() => {
    if (exams.length === 0) return { totalExams: 0, totalGraded: 0, avgMarks: '0%' };
    const totalExams = exams.length;
    const totalGraded = exams.reduce((acc, e) => acc + (Number(e.graded_count) || 0), 0);
    const avgSum = exams.reduce((acc, e) => acc + (Number(e.average_marks) || 0), 0);
    const avgMarks = (avgSum / totalExams).toFixed(1) + '%';
    return { totalExams, totalGraded, avgMarks };
  }, [exams]);

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
      <div className="panel" style={{ textAlign: 'center', padding: 40, color: "var(--destructive)" }}>
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
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: "var(--secondary)", border: "1px solid var(--border-focus, var(--border))", display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sidebar-accent)', margin: '0 auto 16px' }}>
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
            <span style={{ fontSize: 11.5, fontWeight: 700, background: "var(--accent)", color: 'var(--sidebar-accent)', border: '1px solid var(--border-focus)', padding: '2px 8px', borderRadius: 9999 }}>
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
                if (found) {
                  setSelectedSection(found);
                  setIsPublishingView(false);
                }
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

      {/* Single Section Badge Banner if only 1 section mentored */}
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
              onClick={() => {
                setSelectedSection(m);
                setIsPublishingView(false);
              }}
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
          borderBottom: "2px solid var(--border, var(--border))",
          marginBottom: 20
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('REPORTS');
            setSearchParams({ tab: 'REPORTS' });
            setIsPublishingView(false);
          }}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'REPORTS' ? "3px solid var(--border)" : '3px solid transparent',
            color: activeTab === 'REPORTS' ? "var(--primary)" : "var(--text-secondary, var(--muted-foreground))",
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
          onClick={() => {
            setActiveTab('RESULTS');
            setSearchParams({ tab: 'RESULTS' });
          }}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'RESULTS' ? "3px solid var(--border)" : '3px solid transparent',
            color: activeTab === 'RESULTS' ? "var(--primary)" : "var(--text-secondary, var(--muted-foreground))",
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

      {/* TAB 2: RESULT PUBLISH */}
      {activeTab === 'RESULTS' && (
        <div className="as-results-pane">
          {/* Sub-view: Publishing / Editing Marks Form */}
          {isPublishingView ? (
            <div className="student-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              {/* Form Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3 mb-6">
                <div>
                  <button
                    type="button"
                    onClick={() => setIsPublishingView(false)}
                    style={{ background: 'transparent', border: 'none', padding: 0, color: '#e11d48', boxShadow: 'none' }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline mb-2 cursor-pointer"
                  >
                    <ArrowLeft size={16} /> <span>Back to Assessment List</span>
                  </button>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white m-0">
                    {editingExam ? `Edit Evaluation: ${editingExam.title}` : `Publish Assessment Results`}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">
                    Class {selectedSection?.class_number} — Section {selectedSection?.section_name} · {activeSession ? `Session ${activeSession} · ` : ''}Enter student performance records to publish to student portal.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPublishingView(false)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAndPublish}
                    disabled={submittingResults}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-xs cursor-pointer shadow-sm transition-colors"
                  >
                    {submittingResults ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>{submittingResults ? 'Publishing...' : 'Publish Results'}</span>
                  </button>
                </div>
              </div>

              {/* Success / Error Alerts */}
              {publishSuccessMsg && (
                <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{publishSuccessMsg}</span>
                </div>
              )}
              {publishError && (
                <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{publishError}</span>
                </div>
              )}

              {/* Assessment Meta Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                {/* 1. Assessment Title (Clean input, no hardcoded suggestions) */}
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Assessment Title *
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="Enter assessment title..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                {/* 2. Subject (Strictly from School Admin) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Subject *
                  </label>
                  <select
                    value={formSubjectId}
                    onChange={e => {
                      setFormSubjectId(e.target.value);
                      const found = subjects.find(s => s.id === e.target.value);
                      setFormSubjectName(found ? found.name : '');
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  >
                    {subjects.length === 0 ? (
                      <option value="">No subjects configured by Admin</option>
                    ) : (
                      <>
                        {!formSubjectId && <option value="">Select subject...</option>}
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                {/* 3. Grading System Concept: Marks, CGPA, Grade */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Grading System *
                  </label>
                  <select
                    value={formGradingSystem}
                    onChange={e => {
                      const sys = e.target.value as 'MARKS' | 'CGPA' | 'GRADE';
                      setFormGradingSystem(sys);
                      if (sys === 'MARKS') {
                        setFormTotalValue(100);
                        setFormPassingMarks(40);
                      } else if (sys === 'CGPA') {
                        setFormTotalValue(10.0);
                        setFormPassingMarks(4.0);
                      } else if (sys === 'GRADE') {
                        setFormTotalValue('A+');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="MARKS">Marks (Numeric score)</option>
                    <option value="CGPA">CGPA (Point scale)</option>
                    <option value="GRADE">Grade (Letter grades)</option>
                  </select>
                </div>

                {/* 4. Total CGPA / Grade / Marks input (Customizable by user) */}
                <div>
                  {formGradingSystem === 'MARKS' && (
                    <>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Total Marks *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={formTotalValue}
                        onChange={e => {
                          const t = e.target.value;
                          setFormTotalValue(t);
                          const num = Number(t);
                          if (!isNaN(num) && num > 0) {
                            setFormPassingMarks(Math.round(num * 0.4));
                          }
                        }}
                        placeholder="e.g. 100"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono font-bold"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Pass: {formPassingMarks} marks
                      </span>
                    </>
                  )}

                  {formGradingSystem === 'CGPA' && (
                    <>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Total CGPA Scale *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="100"
                        value={formTotalValue}
                        onChange={e => {
                          const t = e.target.value;
                          setFormTotalValue(t);
                          const num = Number(t);
                          if (!isNaN(num) && num > 0) {
                            setFormPassingMarks((num * 0.4).toFixed(1));
                          }
                        }}
                        placeholder="e.g. 10.0 or 4.0"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono font-bold"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Pass: {formPassingMarks} CGPA
                      </span>
                    </>
                  )}

                  {formGradingSystem === 'GRADE' && (
                    <>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Highest Grade Scale *
                      </label>
                      <input
                        type="text"
                        value={formTotalValue}
                        onChange={e => setFormTotalValue(e.target.value)}
                        placeholder="e.g. A+ or O (Outstanding)"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-bold"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Top grade achievable
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Student Marks Entry Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex-1 max-w-sm">
                  <Search size={14} className="text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by student name, roll number..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="border-none outline-none bg-transparent text-xs w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  />
                  {studentSearch && (
                    <button
                      type="button"
                      onClick={() => setStudentSearch('')}
                      className="bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Marks Table */}
              {loadingStudents ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                  Loading students for Class {selectedSection?.class_number} Section {selectedSection?.section_name}...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  <Users size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300 m-0 mb-1">No Students Found</p>
                  <p className="text-xs m-0">No active students found in this mentored section.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300">
                        <th className="p-3 w-14">ROLL</th>
                        <th className="p-3">STUDENT NAME &amp; ADMISSION NO</th>
                        {formGradingSystem === 'MARKS' && (
                          <>
                            <th className="p-3 w-36">MARKS (/{formTotalValue})</th>
                            <th className="p-3 w-20 text-center">PCT (%)</th>
                            <th className="p-3 w-24 text-center">GRADE</th>
                          </>
                        )}
                        {formGradingSystem === 'CGPA' && (
                          <>
                            <th className="p-3 w-36">CGPA (/{formTotalValue})</th>
                            <th className="p-3 w-20 text-center">PCT (%)</th>
                            <th className="p-3 w-24 text-center">EQUIV GRADE</th>
                          </>
                        )}
                        {formGradingSystem === 'GRADE' && (
                          <th className="p-3 w-36 text-center">GRADE OBTAINED</th>
                        )}
                        <th className="p-3">MENTOR REMARKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((st) => {
                        const marksNum = st.marks_obtained !== '' && st.marks_obtained !== null && !isNaN(Number(st.marks_obtained))
                          ? Number(st.marks_obtained)
                          : null;
                        const totalNum = Number(formTotalValue) || (formGradingSystem === 'CGPA' ? 10 : 100);
                        const pct = marksNum !== null ? ((marksNum / totalNum) * 100).toFixed(0) : '—';
                        const passNum = Number(formPassingMarks) || (formGradingSystem === 'CGPA' ? 4 : 40);
                        const isPass = marksNum !== null ? marksNum >= passNum : null;

                        return (
                          <tr key={st.student_id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                              {st.roll_number}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-[11px] text-slate-600 dark:text-slate-300">
                                  {st.photo_url ? (
                                    <img src={st.photo_url} alt={st.name} className="w-full h-full object-cover" />
                                  ) : (
                                    st.name.charAt(0)
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white">{st.name}</div>
                                  <div className="text-[11px] text-slate-400 font-mono">Adm: {st.admission_number || '—'}</div>
                                </div>
                              </div>
                            </td>

                            {/* MARKS SYSTEM */}
                            {formGradingSystem === 'MARKS' && (
                              <>
                                <td className="p-3">
                                  <input
                                    type="number"
                                    min="0"
                                    max={formTotalValue}
                                    value={st.marks_obtained}
                                    onChange={e => handleStudentScoreChange(st.student_id, e.target.value)}
                                    placeholder="0"
                                    className="w-24 px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono font-bold text-right"
                                  />
                                </td>
                                <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400">
                                  {pct !== '—' ? `${pct}%` : '—'}
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="text"
                                    maxLength={3}
                                    value={st.grade}
                                    onChange={e => handleStudentGradeChange(st.student_id, e.target.value.toUpperCase())}
                                    placeholder="A"
                                    className={`w-14 px-2 py-1 text-center font-bold text-xs rounded border outline-none ${
                                      isPass === true
                                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                        : isPass === false
                                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                                    }`}
                                  />
                                </td>
                              </>
                            )}

                            {/* CGPA SYSTEM */}
                            {formGradingSystem === 'CGPA' && (
                              <>
                                <td className="p-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={formTotalValue}
                                    value={st.marks_obtained}
                                    onChange={e => handleStudentScoreChange(st.student_id, e.target.value)}
                                    placeholder="0.0"
                                    className="w-24 px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono font-bold text-right"
                                  />
                                </td>
                                <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400">
                                  {pct !== '—' ? `${pct}%` : '—'}
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="text"
                                    maxLength={3}
                                    value={st.grade}
                                    onChange={e => handleStudentGradeChange(st.student_id, e.target.value.toUpperCase())}
                                    placeholder="A"
                                    className="w-14 px-2 py-1 text-center font-bold text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                                  />
                                </td>
                              </>
                            )}

                            {/* GRADE SYSTEM */}
                            {formGradingSystem === 'GRADE' && (
                              <td className="p-3 text-center">
                                <select
                                  value={st.grade}
                                  onChange={e => handleStudentGradeChange(st.student_id, e.target.value)}
                                  className="w-28 px-2 py-1 text-center font-bold text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                                >
                                  <option value="">Select</option>
                                  <option value="A+">A+ (Outstanding)</option>
                                  <option value="A">A (Excellent)</option>
                                  <option value="B+">B+ (Very Good)</option>
                                  <option value="B">B (Good)</option>
                                  <option value="C">C (Satisfactory)</option>
                                  <option value="D">D (Pass)</option>
                                  <option value="F">F (Fail)</option>
                                </select>
                              </td>
                            )}

                            <td className="p-3">
                              <input
                                type="text"
                                value={st.remarks}
                                onChange={e => handleStudentRemarksChange(st.student_id, e.target.value)}
                                placeholder="e.g. Excellent work, Good effort"
                                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom Action Bar */}
              <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">
                  Graded:{' '}
                  {formGradingSystem === 'GRADE'
                    ? studentsWithMarks.filter(s => s.grade && s.grade.trim() !== '').length
                    : studentsWithMarks.filter(s => s.marks_obtained !== '' && s.marks_obtained !== null).length}{' '}
                  / {studentsWithMarks.length} students
                </span>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsPublishingView(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAndPublish}
                    disabled={submittingResults}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-xs cursor-pointer shadow-sm transition-colors"
                  >
                    {submittingResults ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>{submittingResults ? 'Publishing...' : 'Publish & Sync to Student Portals'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Sub-view: Assessments List */
            <div>
              {/* Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white m-0">
                    Class {selectedSection?.class_number} — Section {selectedSection?.section_name} Results
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-1">
                    Manage and publish examination marks, CGPA, or letter grades. Published evaluations sync instantly to students' profile &amp; result pages.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => selectedSection && loadExams(selectedSection.class_id, selectedSection.section_id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    <RefreshCw size={13} className={loadingExams ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartNewAssessment}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer shadow-sm transition-colors"
                  >
                    <Plus size={15} />
                    <span>Publish Assessment Marks</span>
                  </button>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1 font-semibold">
                    <span>Published Assessments</span>
                    <Award size={15} className="text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{examStats.totalExams}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Subject examination papers recorded</div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1 font-semibold">
                    <span>Total Graded Entries</span>
                    <Users size={15} className="text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{examStats.totalGraded}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Student evaluations published</div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1 font-semibold">
                    <span>Average Class Score</span>
                    <TrendingUp size={15} className="text-sky-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{examStats.avgMarks}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Cumulative section performance</div>
                </div>
              </div>

              {/* Exams List Table */}
              <div className="student-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                {loadingExams ? (
                  <div className="py-14 text-center text-sm text-slate-500">
                    <Loader2 size={26} className="animate-spin mx-auto mb-2 text-blue-600" />
                    Loading examination assessments...
                  </div>
                ) : examsError ? (
                  <div className="py-10 text-center text-rose-500 text-sm">
                    <AlertCircle size={28} className="mx-auto mb-2" />
                    <p className="font-semibold">{examsError}</p>
                  </div>
                ) : exams.length === 0 ? (
                  <div className="py-14 text-center">
                    <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
                      <Award size={26} />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white m-0 mb-1">
                      No Academic Results Published Yet
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
                      As Class Mentor, you can enter and publish subject marks, CGPA, or letter grades for each student in Class {selectedSection?.class_number} — Section {selectedSection?.section_name}.
                    </p>
                    <button
                      type="button"
                      onClick={handleStartNewAssessment}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer shadow-sm transition-colors"
                    >
                      <Plus size={15} />
                      <span>Publish First Assessment Marks</span>
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300">
                          <th className="p-3">ASSESSMENT TITLE</th>
                          <th className="p-3">SUBJECT</th>
                          <th className="p-3">EXAM DATE</th>
                          <th className="p-3 text-right">EVALUATION SCALE</th>
                          <th className="p-3 text-center">STUDENTS GRADED</th>
                          <th className="p-3 text-center">CLASS AVERAGE</th>
                          <th className="p-3 text-right">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exams.map(exam => (
                          <tr key={exam.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3">
                              <div className="font-bold text-slate-900 dark:text-white text-sm">{exam.title}</div>
                              <span className="inline-block mt-0.5 px-2 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {exam.grading_system === 'CGPA' ? 'CGPA System' : exam.grading_system === 'GRADE' ? 'Letter Grade' : 'Marks System'}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                              {exam.subject_name || 'General'}
                            </td>
                            <td className="p-3 text-slate-500">
                              {formatDate(exam.exam_date)}
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                              {exam.grading_system === 'CGPA'
                                ? `Scale: ${exam.total_marks || 10} CGPA`
                                : exam.grading_system === 'GRADE'
                                ? 'Grade Scale'
                                : `${exam.total_marks} Marks (Pass: ${exam.passing_marks || 40})`}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleOpenGradedStudentsModal(exam)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-all cursor-pointer shadow-xs hover:shadow-sm"
                                title="Click to view student names and marks"
                              >
                                <Users size={12} />
                                <span>{exam.graded_count || 0} Graded</span>
                              </button>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {exam.average_marks ? `${exam.average_marks}%` : '—'}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditAssessment(exam)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                                  title="Enter / Edit Marks"
                                >
                                  <Edit2 size={13} />
                                  <span>Edit Marks</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExam(exam.id, exam.title)}
                                  className="p-1 rounded-lg border border-transparent text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                  title="Delete Exam"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal for Graded Students & Marks Viewer ── */}
      {showGradedModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs transition-all ${isGradedModalMaximized ? 'p-2 sm:p-3' : 'p-4'}`}>
          <div className={`bg-white dark:bg-slate-900 flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 transition-all duration-200 ${
            isGradedModalMaximized
              ? 'w-full h-full max-w-[98vw] max-h-[96vh] rounded-2xl p-6'
              : 'rounded-2xl max-w-3xl w-full p-6 max-h-[90vh]'
          }`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Award size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">
                    {selectedExamForGradedView?.title} — Student Marks
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">
                    {selectedExamForGradedView?.subject_name || 'General'} · Class {selectedSection?.class_number} - Section {selectedSection?.section_name} ·{' '}
                    {selectedExamForGradedView?.exam_date ? formatDate(selectedExamForGradedView.exam_date) : ''} · Scale:{' '}
                    {selectedExamForGradedView?.grading_system === 'CGPA'
                      ? `${selectedExamForGradedView.total_marks || 10} CGPA`
                      : selectedExamForGradedView?.grading_system === 'GRADE'
                      ? 'Letter Grade'
                      : `${selectedExamForGradedView?.total_marks || 100} Marks`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsGradedModalMaximized((prev) => !prev)}
                  className="bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title={isGradedModalMaximized ? "Restore default size" : "Maximize dialog"}
                >
                  {isGradedModalMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowGradedModal(false);
                    setIsGradedModalMaximized(false);
                  }}
                  className="bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Controls Bar: Search & Filter Pills */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 mb-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 w-full sm:max-w-xs text-xs shadow-xs">
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student or roll no..."
                  value={gradedModalSearch}
                  onChange={(e) => setGradedModalSearch(e.target.value)}
                  className="border-none outline-none bg-transparent text-xs w-full text-slate-900 dark:text-white placeholder:text-slate-400"
                />
                {gradedModalSearch && (
                  <button
                    type="button"
                    onClick={() => setGradedModalSearch('')}
                    className="bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setGradedModalFilter('GRADED')}
                  className={`px-3 py-1 rounded-lg border-none cursor-pointer transition-colors ${
                    gradedModalFilter === 'GRADED'
                      ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs font-bold'
                      : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Graded ({modalGradedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setGradedModalFilter('ALL')}
                  className={`px-3 py-1 rounded-lg border-none cursor-pointer transition-colors ${
                    gradedModalFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs font-bold'
                      : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  All Students ({gradedStudentsList.length})
                </button>
              </div>
            </div>

            {/* Students List Table Container */}
            <div className="overflow-y-auto flex-1 border border-slate-200 dark:border-slate-800 rounded-xl">
              {loadingGradedModal ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2 text-rose-600" />
                  <p className="text-xs m-0">Loading student scores...</p>
                </div>
              ) : modalFilteredStudents.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Users size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm m-0">
                    {gradedModalFilter === 'GRADED' ? 'No Graded Students Yet' : 'No Students Found'}
                  </p>
                  <p className="text-xs text-slate-500 m-0 mt-1">
                    {gradedModalFilter === 'GRADED'
                      ? 'Marks have not been recorded for any student in this assessment.'
                      : 'No student matches your search term.'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300 z-10">
                    <tr>
                      <th className="p-3 w-16 text-center">ROLL</th>
                      <th className="p-3">STUDENT NAME &amp; ADMISSION NO</th>
                      <th className="p-3 text-right">MARKS / SCORE</th>
                      <th className="p-3 text-center">GRADE</th>
                      <th className="p-3">MENTOR REMARKS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {modalFilteredStudents.map((s) => {
                      const isGraded = (s.marks_obtained !== '' && s.marks_obtained !== null && s.marks_obtained !== undefined) || (s.grade && s.grade.trim() !== '');
                      const totalScale = selectedExamForGradedView?.total_marks || (selectedExamForGradedView?.grading_system === 'CGPA' ? 10 : 100);
                      const obt = Number(s.marks_obtained);
                      const pct = !isNaN(obt) && totalScale > 0 ? (obt / totalScale) * 100 : null;

                      return (
                        <tr key={s.student_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                          <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">
                            {s.roll_number}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs uppercase">
                                {s.name.charAt(0)}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white block text-sm">
                                  {s.name}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  Adm: {s.admission_number || '—'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono">
                            {isGraded ? (
                              selectedExamForGradedView?.grading_system === 'CGPA' ? (
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                                    {s.marks_obtained}
                                  </span>
                                  <span className="text-slate-400 text-xs ml-1">/ {totalScale} CGPA</span>
                                  {pct !== null && (
                                    <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 ml-1.5">
                                      ({pct.toFixed(0)}%)
                                    </span>
                                  )}
                                </div>
                              ) : selectedExamForGradedView?.grading_system === 'GRADE' ? (
                                <span className="font-bold text-slate-900 dark:text-white text-sm">
                                  {s.grade || '—'}
                                </span>
                              ) : (
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                                    {s.marks_obtained}
                                  </span>
                                  <span className="text-slate-400 text-xs ml-1">/ {totalScale}</span>
                                  {pct !== null && (
                                    <span className="text-[11px] font-semibold text-slate-500 ml-1.5">
                                      ({pct.toFixed(0)}%)
                                    </span>
                                  )}
                                </div>
                              )
                            ) : (
                              <span className="text-xs text-slate-400 italic">Not Graded</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {s.grade ? (
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${getGradeBadgeClass(
                                  s.grade
                                )}`}
                              >
                                {s.grade}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                            {s.remarks || <span className="text-slate-400 italic">No remarks</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 font-medium">
                Showing {modalFilteredStudents.length} of {gradedStudentsList.length} students ({modalGradedCount} graded)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowGradedModal(false);
                    setIsGradedModalMaximized(false);
                    if (selectedExamForGradedView) {
                      handleStartEditAssessment(selectedExamForGradedView, true);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs cursor-pointer shadow-sm transition-colors"
                >
                  <Edit2 size={13} />
                  <span>Edit Marks</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowGradedModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 cursor-pointer shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassMentorWorkspace;
