import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Plus,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  X,
  Check,
  Percent,
  Sliders,
  BookOpen,
  Sparkles,
  Info,
  Scale,
  Search,
  Filter,
  FileText,
  ChevronRight,
  TrendingUp,
  Layers,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api';

export type GradingBasisType = 'MARKS' | 'CGPA' | 'GRADE';

export interface CustomGradeTier {
  id: string;
  grade: string;
  minScore: number;
  maxScore: number;
  gradePoint?: number;
  remark: string;
  isPassing: boolean;
  colorScheme?: 'emerald' | 'blue' | 'indigo' | 'amber' | 'rose' | 'slate';
}

export interface ExamGradingConfig {
  id: string;
  examTitle: string;
  examCode: string;
  academicSession: string;
  applicableClasses: string;
  gradingType: GradingBasisType;
  status: 'ACTIVE' | 'DRAFT';
  description?: string;
  createdAt: string;
  updatedAt: string;

  // Marks Basis Configuration
  marksConfig?: {
    totalMarks: number;
    passingMarks: number;
    allowGraceMarks: boolean;
    maxGraceMarks?: number;
    displayPercentage: boolean;
  };

  // CGPA Basis Configuration
  cgpaConfig?: {
    maxCgpa: number;
    passingCgpa: number;
    scaleMultiplier: number; // e.g. 9.5 for CBSE to percentage
    formulaLabel?: string;
    creditWeighted: boolean;
  };

  // Grade Basis Configuration
  gradeConfig?: {
    gradeTiers: CustomGradeTier[];
  };
}

export default function GradingSystem() {
  const { user } = useAuth();
  const schoolId = user?.schoolId || 'global';
  const storageKey = `attendo_exam_grading_${schoolId}`;

  // Exams state - strictly dynamically loaded from storage with NO hardcoded default data
  const [exams, setExams] = useState<ExamGradingConfig[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse stored exam grading systems:', e);
    }
    return [];
  });

  // Available school classes fetched dynamically
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    api.get('/classes')
      .then(res => {
        if (!isMounted) return;
        if (Array.isArray(res.data)) {
          const names = res.data
            .map((c: any) => c.name || (c.class_number ? `Class ${c.class_number}` : ''))
            .filter(Boolean);
          setAvailableClasses(Array.from(new Set(names)));
        }
      })
      .catch(() => {
        // Fallback default list if API is unreachable
        if (isMounted) {
          setAvailableClasses([
            'All Classes',
            'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
            'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
            'Class 11', 'Class 12'
          ]);
        }
      });
    return () => { isMounted = false; };
  }, []);

  // Sync to local storage
  const saveExams = (updated: ExamGradingConfig[]) => {
    setExams(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save exam grading configurations:', e);
    }
  };

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [basisFilter, setBasisFilter] = useState<'ALL' | GradingBasisType>('ALL');

  const filteredExams = useMemo(() => {
    return exams.filter(ex => {
      const matchesSearch =
        ex.examTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.examCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.applicableClasses.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBasis = basisFilter === 'ALL' || ex.gradingType === basisFilter;
      return matchesSearch && matchesBasis;
    });
  }, [exams, searchQuery, basisFilter]);

  // Dynamic KPI counts
  const marksCount = useMemo(() => exams.filter(e => e.gradingType === 'MARKS').length, [exams]);
  const cgpaCount = useMemo(() => exams.filter(e => e.gradingType === 'CGPA').length, [exams]);
  const gradeCount = useMemo(() => exams.filter(e => e.gradingType === 'GRADE').length, [exams]);

  // Modal State for Create / Edit Exam
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  // Form Fields
  const [examTitle, setExamTitle] = useState('');
  const [examCode, setExamCode] = useState('');
  const [academicSession, setAcademicSession] = useState('2026-2027');
  const [applicableClasses, setApplicableClasses] = useState('All Classes');
  const [gradingType, setGradingType] = useState<GradingBasisType>('MARKS');
  const [examStatus, setExamStatus] = useState<'ACTIVE' | 'DRAFT'>('ACTIVE');
  const [examDescription, setExamDescription] = useState('');

  // Marks Basis Form Fields
  const [totalMarks, setTotalMarks] = useState<number>(100);
  const [passingMarks, setPassingMarks] = useState<number>(33);
  const [allowGraceMarks, setAllowGraceMarks] = useState<boolean>(false);
  const [maxGraceMarks, setMaxGraceMarks] = useState<number>(5);
  const [displayPercentage, setDisplayPercentage] = useState<boolean>(true);

  // CGPA Basis Form Fields
  const [maxCgpa, setMaxCgpa] = useState<number>(10.0);
  const [passingCgpa, setPassingCgpa] = useState<number>(4.0);
  const [scaleMultiplier, setScaleMultiplier] = useState<number>(9.5);
  const [creditWeighted, setCreditWeighted] = useState<boolean>(false);

  // Grade Basis Form Fields (Dynamic user-created tiers, starts clean)
  const [gradeTiers, setGradeTiers] = useState<CustomGradeTier[]>([]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingExamId(null);
    setExamTitle('');
    setExamCode(`EXAM-${Date.now().toString().slice(-4)}`);
    setAcademicSession('2026-2027');
    setApplicableClasses('All Classes');
    setGradingType('MARKS');
    setExamStatus('ACTIVE');
    setExamDescription('');

    // Reset marks
    setTotalMarks(100);
    setPassingMarks(33);
    setAllowGraceMarks(false);
    setMaxGraceMarks(5);
    setDisplayPercentage(true);

    // Reset CGPA
    setMaxCgpa(10.0);
    setPassingCgpa(4.0);
    setScaleMultiplier(9.5);
    setCreditWeighted(false);

    // Dynamic initial clean grade tiers if user switches to Grade
    setGradeTiers([
      { id: 'tier-1', grade: 'A', minScore: 80, maxScore: 100, gradePoint: 10, remark: 'Outstanding', isPassing: true, colorScheme: 'emerald' },
      { id: 'tier-2', grade: 'B', minScore: 60, maxScore: 79, gradePoint: 8, remark: 'Good', isPassing: true, colorScheme: 'blue' },
      { id: 'tier-3', grade: 'C', minScore: 40, maxScore: 59, gradePoint: 6, remark: 'Satisfactory', isPassing: true, colorScheme: 'indigo' },
      { id: 'tier-4', grade: 'D', minScore: 33, maxScore: 39, gradePoint: 4, remark: 'Marginal Pass', isPassing: true, colorScheme: 'amber' },
      { id: 'tier-5', grade: 'F', minScore: 0, maxScore: 32, gradePoint: 0, remark: 'Needs Improvement', isPassing: false, colorScheme: 'rose' }
    ]);

    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (exam: ExamGradingConfig) => {
    setEditingExamId(exam.id);
    setExamTitle(exam.examTitle);
    setExamCode(exam.examCode);
    setAcademicSession(exam.academicSession || '2026-2027');
    setApplicableClasses(exam.applicableClasses || 'All Classes');
    setGradingType(exam.gradingType);
    setExamStatus(exam.status);
    setExamDescription(exam.description || '');

    if (exam.marksConfig) {
      setTotalMarks(exam.marksConfig.totalMarks);
      setPassingMarks(exam.marksConfig.passingMarks);
      setAllowGraceMarks(exam.marksConfig.allowGraceMarks);
      setMaxGraceMarks(exam.marksConfig.maxGraceMarks || 5);
      setDisplayPercentage(exam.marksConfig.displayPercentage);
    }
    if (exam.cgpaConfig) {
      setMaxCgpa(exam.cgpaConfig.maxCgpa);
      setPassingCgpa(exam.cgpaConfig.passingCgpa);
      setScaleMultiplier(exam.cgpaConfig.scaleMultiplier);
      setCreditWeighted(exam.cgpaConfig.creditWeighted);
    }
    if (exam.gradeConfig) {
      setGradeTiers(exam.gradeConfig.gradeTiers || []);
    } else {
      setGradeTiers([]);
    }

    setIsModalOpen(true);
  };

  // Delete Exam
  const handleDeleteExam = (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete the grading system for "${title}"? This action cannot be undone.`)) {
      saveExams(exams.filter(e => e.id !== id));
    }
  };

  // Add a new tier in Grade Basis
  const handleAddTierRow = () => {
    const newTier: CustomGradeTier = {
      id: `tier-${Date.now()}`,
      grade: 'New Grade',
      minScore: 0,
      maxScore: 100,
      gradePoint: 0,
      remark: 'Satisfactory',
      isPassing: true,
      colorScheme: 'blue'
    };
    setGradeTiers([...gradeTiers, newTier]);
  };

  // Remove a tier row
  const handleRemoveTierRow = (id: string) => {
    setGradeTiers(gradeTiers.filter(t => t.id !== id));
  };

  // Update tier row field
  const handleUpdateTierRow = (id: string, field: keyof CustomGradeTier, val: any) => {
    setGradeTiers(gradeTiers.map(t => (t.id === id ? { ...t, [field]: val } : t)));
  };

  // Form Validation & Save
  const [formError, setFormError] = useState<string | null>(null);

  const handleSaveExam = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!examTitle.trim()) {
      setFormError('Please enter a valid Exam Title.');
      return;
    }

    if (gradingType === 'MARKS') {
      if (totalMarks <= 0) {
        setFormError('Total marks must be greater than zero.');
        return;
      }
      if (passingMarks > totalMarks || passingMarks < 0) {
        setFormError('Passing marks cannot exceed total maximum marks or be negative.');
        return;
      }
    } else if (gradingType === 'CGPA') {
      if (maxCgpa <= 0) {
        setFormError('Max CGPA scale must be greater than zero.');
        return;
      }
      if (passingCgpa > maxCgpa || passingCgpa < 0) {
        setFormError('Passing CGPA cannot exceed maximum CGPA.');
        return;
      }
    } else if (gradingType === 'GRADE') {
      if (gradeTiers.length === 0) {
        setFormError('Please add at least one Grade Tier for this exam.');
        return;
      }
      for (const t of gradeTiers) {
        if (!t.grade.trim()) {
          setFormError('All grade tiers must have a valid grade symbol or name.');
          return;
        }
        if (t.minScore < 0 || t.maxScore > 100 || t.minScore > t.maxScore) {
          setFormError(`Invalid score range for grade "${t.grade}". Ensure min <= max within 0-100.`);
          return;
        }
      }
    }

    const newConfig: ExamGradingConfig = {
      id: editingExamId || `exam-${Date.now()}`,
      examTitle: examTitle.trim(),
      examCode: examCode.trim() || `EXAM-${Date.now().toString().slice(-4)}`,
      academicSession,
      applicableClasses,
      gradingType,
      status: examStatus,
      description: examDescription.trim(),
      createdAt: editingExamId ? (exams.find(e => e.id === editingExamId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(gradingType === 'MARKS' ? {
        marksConfig: {
          totalMarks: Number(totalMarks),
          passingMarks: Number(passingMarks),
          allowGraceMarks,
          maxGraceMarks: allowGraceMarks ? Number(maxGraceMarks) : 0,
          displayPercentage
        }
      } : {}),
      ...(gradingType === 'CGPA' ? {
        cgpaConfig: {
          maxCgpa: Number(maxCgpa),
          passingCgpa: Number(passingCgpa),
          scaleMultiplier: Number(scaleMultiplier),
          creditWeighted
        }
      } : {}),
      ...(gradingType === 'GRADE' ? {
        gradeConfig: {
          gradeTiers: gradeTiers.slice().sort((a, b) => b.minScore - a.minScore)
        }
      } : {})
    };

    if (editingExamId) {
      saveExams(exams.map(e => e.id === editingExamId ? newConfig : e));
    } else {
      saveExams([newConfig, ...exams]);
    }

    setIsModalOpen(false);
  };

  // Interactive Live Tester Drawer / Modal
  const [testingExam, setTestingExam] = useState<ExamGradingConfig | null>(null);
  const [testScoreInput, setTestScoreInput] = useState<number>(75);

  const testEvaluationResult = useMemo(() => {
    if (!testingExam) return null;
    const score = Number(testScoreInput) || 0;

    if (testingExam.gradingType === 'MARKS' && testingExam.marksConfig) {
      const { totalMarks: maxM, passingMarks: passM, allowGraceMarks: gAllowed, maxGraceMarks: gMax } = testingExam.marksConfig;
      const pct = maxM > 0 ? ((score / maxM) * 100) : 0;
      const passed = score >= passM;
      const graceNeeded = (!passed && gAllowed && gMax && (passM - score) <= gMax && (passM - score) > 0) ? (passM - score) : 0;

      return {
        type: 'MARKS',
        score,
        total: maxM,
        percentage: pct.toFixed(1),
        passed: passed || graceNeeded > 0,
        eligibleWithGrace: graceNeeded > 0,
        graceMarksApplied: graceNeeded,
        verdict: passed ? 'PASSED' : (graceNeeded > 0 ? `PASSED WITH ${graceNeeded} GRACE MARKS` : 'FAILED'),
        remark: passed ? 'Candidate meets the minimum passing threshold.' : (graceNeeded > 0 ? 'Eligible for passing via allowable grace marks.' : 'Candidate scored below the passing threshold.')
      };
    }

    if (testingExam.gradingType === 'CGPA' && testingExam.cgpaConfig) {
      const { maxCgpa: maxC, passingCgpa: passC, scaleMultiplier: mult } = testingExam.cgpaConfig;
      const cgpa = Math.min(score, maxC);
      const passed = cgpa >= passC;
      const eqPercentage = (cgpa * (mult || 9.5)).toFixed(1);

      return {
        type: 'CGPA',
        cgpa: cgpa.toFixed(2),
        maxCgpa: maxC,
        passed,
        equivalentPercentage: eqPercentage,
        verdict: passed ? 'PASSED (SATISFACTORY CGPA)' : 'NEEDS IMPROVEMENT (BELOW PASS CGPA)',
        remark: cgpa >= 8.5 ? 'First Class with Distinction' : cgpa >= 6.5 ? 'First Division' : cgpa >= passC ? 'Pass Division' : 'Failed to attain minimum required CGPA.'
      };
    }

    if (testingExam.gradingType === 'GRADE' && testingExam.gradeConfig) {
      const tiers = testingExam.gradeConfig.gradeTiers || [];
      // Find matching tier
      const matched = tiers.find(t => score >= t.minScore && score <= t.maxScore) ||
        (score > 100 ? tiers[0] : tiers[tiers.length - 1]);

      return {
        type: 'GRADE',
        score,
        grade: matched?.grade || 'N/A',
        gradePoint: matched?.gradePoint ?? 'N/A',
        remark: matched?.remark || 'Evaluated',
        passed: matched?.isPassing ?? false,
        verdict: (matched?.isPassing ?? false) ? `PASSED (GRADE: ${matched?.grade})` : `FAILED / NEEDS IMPROVEMENT (GRADE: ${matched?.grade})`
      };
    }

    return null;
  }, [testingExam, testScoreInput]);

  return (
    <div style={{ padding: '24px 24px 60px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Breadcrumb & Header */}
      <Link
        to="/dashboard"
        style={{
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: '#e11d48',
          fontWeight: 600,
          fontSize: 13,
          marginBottom: 16
        }}
      >
        <ArrowLeft size={16} /> Dashboard
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: 'rgba(225, 29, 72, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e11d48'
              }}
            >
              <Award size={26} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                Grading System & Examination Evaluation
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
                Configure academic exams and choose their evaluation basis: Marks Basis, CGPA Basis, or Grade Basis.
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={handleOpenCreateModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#e11d48',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(225, 29, 72, 0.25)',
            transition: 'background-color 0.2s'
          }}
        >
          <Plus size={18} />
          Create Exam & Grading System
        </button>
      </div>

      {/* Dynamic Summary Cards (Computed strictly from configured exams) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}
      >
        <div style={{ backgroundColor: 'var(--bg-card, #ffffff)', padding: 18, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Exams Configured
            </span>
            <FileText size={18} color="#64748b" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>{exams.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>
            {exams.filter(e => e.status === 'ACTIVE').length} active evaluation schemes
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card, #ffffff)', padding: 18, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Marks-Based Exams
            </span>
            <Percent size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1e40af' }}>{marksCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>
            Evaluated using total marks & passing cutoffs
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card, #ffffff)', padding: 18, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              CGPA-Based Exams
            </span>
            <Scale size={18} color="#7c3aed" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#6d28d9' }}>{cgpaCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>
            Evaluated on 10.0 or 4.0 point scale with multipliers
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card, #ffffff)', padding: 18, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Grade-Based Exams
            </span>
            <Award size={18} color="#059669" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#047857' }}>{gradeCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>
            Evaluated via custom defined letter grade brackets
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          backgroundColor: 'var(--bg-card, #ffffff)',
          padding: '14px 18px',
          borderRadius: 12,
          border: '1px solid var(--border, #e2e8f0)',
          marginBottom: 20
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by exam title, code, or class..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              fontSize: 13,
              borderRadius: 8,
              border: '1px solid var(--border, #cbd5e1)',
              backgroundColor: 'var(--bg-input, #f8fafc)',
              color: 'var(--text-primary, #0f172a)',
              outline: 'none'
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Filter size={14} /> Filter System:
          </span>
          {(['ALL', 'MARKS', 'CGPA', 'GRADE'] as const).map(f => {
            const labelMap = {
              ALL: 'All Exams',
              MARKS: 'Marks Basis',
              CGPA: 'CGPA Basis',
              GRADE: 'Grade Basis'
            };
            const active = basisFilter === f;
            return (
              <button
                key={f}
                onClick={() => setBasisFilter(f)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  border: active ? '1px solid #e11d48' : '1px solid var(--border, #cbd5e1)',
                  backgroundColor: active ? 'rgba(225, 29, 72, 0.08)' : 'transparent',
                  color: active ? '#e11d48' : 'var(--text-secondary, #64748b)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {labelMap[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main List / Table of Exam Grading Systems */}
      {filteredExams.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: 12,
            border: '1px dashed var(--border, #cbd5e1)',
            padding: '60px 20px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: 'rgba(225, 29, 72, 0.08)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e11d48',
              marginBottom: 16
            }}
          >
            <Award size={30} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
            {exams.length === 0 ? 'No Exam Grading Systems Configured' : 'No matching exams found'}
          </h3>
          <p style={{ margin: '0 auto 20px', fontSize: 13, color: 'var(--text-secondary, #64748b)', maxWidth: 460 }}>
            {exams.length === 0
              ? 'Create your first exam to set up its evaluation system: Marks basis, CGPA basis, or custom Grade brackets.'
              : 'Try adjusting your search query or grading filter above.'}
          </p>
          {exams.length === 0 ? (
            <button
              onClick={handleOpenCreateModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#e11d48',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Plus size={16} /> Create Exam & Grading System
            </button>
          ) : (
            <button
              onClick={() => { setSearchQuery(''); setBasisFilter('ALL'); }}
              style={{
                padding: '8px 16px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--border, #cbd5e1)',
                backgroundColor: 'transparent',
                color: 'var(--text-primary, #0f172a)',
                cursor: 'pointer'
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          {filteredExams.map(exam => {
            const isMarks = exam.gradingType === 'MARKS';
            const isCgpa = exam.gradingType === 'CGPA';
            const isGrade = exam.gradingType === 'GRADE';

            return (
              <div
                key={exam.id}
                style={{
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  borderRadius: 12,
                  border: '1px solid var(--border, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  padding: 20,
                  transition: 'box-shadow 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isMarks ? 'rgba(37, 99, 235, 0.1)' : isCgpa ? 'rgba(124, 58, 237, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                        color: isMarks ? '#2563eb' : isCgpa ? '#7c3aed' : '#059669'
                      }}
                    >
                      {isMarks && <Percent size={20} />}
                      {isCgpa && <Scale size={20} />}
                      {isGrade && <Award size={20} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                          {exam.examTitle}
                        </h3>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, backgroundColor: '#f1f5f9', color: '#475569' }}>
                          {exam.examCode}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 4,
                            backgroundColor: exam.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.15)',
                            color: exam.status === 'ACTIVE' ? '#059669' : '#64748b'
                          }}
                        >
                          {exam.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>
                        Session: <strong>{exam.academicSession}</strong> · Target: <strong>{exam.applicableClasses}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this Exam */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => {
                        setTestingExam(exam);
                        setTestScoreInput(isMarks ? Math.round((exam.marksConfig?.totalMarks || 100) * 0.75) : isCgpa ? 7.8 : 78);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#f8fafc',
                        color: '#0f172a',
                        cursor: 'pointer'
                      }}
                      title="Test live marks evaluation"
                    >
                      <Calculator size={14} color="#e11d48" /> Test Evaluator
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(exam)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      <Edit2 size={14} /> Edit
                    </button>

                    <button
                      onClick={() => handleDeleteExam(exam.id, exam.examTitle)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #fecdd3',
                        backgroundColor: '#fff1f2',
                        color: '#e11d48',
                        cursor: 'pointer'
                      }}
                      title="Delete Exam Grading System"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Grading Configuration Breakdown Card */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-card-sub, #f8fafc)',
                    borderRadius: 8,
                    padding: 14,
                    border: '1px solid var(--border, #e2e8f0)',
                    fontSize: 13
                  }}
                >
                  {isMarks && exam.marksConfig && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>System Type</span>
                        <div style={{ fontWeight: 600, color: '#2563eb' }}>Marks-Based Evaluation</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Marks</span>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{exam.marksConfig.totalMarks} Marks</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Passing Cutoff</span>
                        <div style={{ fontWeight: 700, color: '#059669' }}>
                          {exam.marksConfig.passingMarks} Marks ({((exam.marksConfig.passingMarks / exam.marksConfig.totalMarks) * 100).toFixed(0)}%)
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Grace Marks</span>
                        <div style={{ color: '#475569' }}>
                          {exam.marksConfig.allowGraceMarks ? `Allowed (Up to ${exam.marksConfig.maxGraceMarks} marks)` : 'Not Allowed'}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Percentage Output</span>
                        <div style={{ color: '#475569' }}>{exam.marksConfig.displayPercentage ? 'Included on marksheets' : 'Marks only'}</div>
                      </div>
                    </div>
                  )}

                  {isCgpa && exam.cgpaConfig && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>System Type</span>
                        <div style={{ fontWeight: 600, color: '#7c3aed' }}>Cumulative Grade Point Average (CGPA)</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Maximum Scale</span>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{exam.cgpaConfig.maxCgpa.toFixed(1)} CGPA Scale</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Passing CGPA</span>
                        <div style={{ fontWeight: 700, color: '#059669' }}>Min. {exam.cgpaConfig.passingCgpa.toFixed(1)} CGPA</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Multiplier</span>
                        <div style={{ color: '#475569' }}>CGPA × {exam.cgpaConfig.scaleMultiplier} = Percentage %</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Credit Weighting</span>
                        <div style={{ color: '#475569' }}>{exam.cgpaConfig.creditWeighted ? 'Credit Hours Weighted' : 'Direct Subject Average'}</div>
                      </div>
                    </div>
                  )}

                  {isGrade && exam.gradeConfig && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>System Type: </span>
                          <span style={{ fontWeight: 600, color: '#059669' }}>
                            Grade-Based Evaluation ({exam.gradeConfig.gradeTiers?.length || 0} Defined Grade Tiers)
                          </span>
                        </div>
                      </div>

                      {/* Grade Tiers Mini Grid */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(exam.gradeConfig.gradeTiers || []).map(tier => (
                          <div
                            key={tier.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 12px',
                              borderRadius: 6,
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              fontSize: 12
                            }}
                          >
                            <span style={{ fontWeight: 700, color: tier.isPassing ? '#059669' : '#e11d48' }}>
                              {tier.grade}
                            </span>
                            <span style={{ color: '#64748b' }}>
                              ({tier.minScore}% - {tier.maxScore}%)
                            </span>
                            <span style={{ fontSize: 11, color: '#475569' }}>{tier.remark}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT EXAM MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              border: '1px solid var(--border, #e2e8f0)',
              padding: 24
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border, #e2e8f0)', paddingBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                  {editingExamId ? 'Edit Exam & Grading System' : 'Create Exam & Grading System'}
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary, #64748b)' }}>
                  Define the examination details and select its evaluation methodology.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  backgroundColor: '#fff1f2',
                  border: '1px solid #fecdd3',
                  color: '#e11d48',
                  fontSize: 13,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <AlertTriangle size={16} /> {formError}
              </div>
            )}

            <form onSubmit={handleSaveExam}>
              {/* Basic Exam Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #334155)', marginBottom: 6 }}>
                    Exam Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mid-Term Examination 2026-27"
                    value={examTitle}
                    onChange={e => setExamTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px solid var(--border, #cbd5e1)',
                      outline: 'none',
                      backgroundColor: 'var(--bg-input, #ffffff)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #334155)', marginBottom: 6 }}>
                    Exam Code / Short Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MID-2026"
                    value={examCode}
                    onChange={e => setExamCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px solid var(--border, #cbd5e1)',
                      outline: 'none',
                      backgroundColor: 'var(--bg-input, #ffffff)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #334155)', marginBottom: 6 }}>
                    Academic Session
                  </label>
                  <select
                    value={academicSession}
                    onChange={e => setAcademicSession(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px solid var(--border, #cbd5e1)',
                      outline: 'none',
                      backgroundColor: 'var(--bg-input, #ffffff)'
                    }}
                  >
                    <option value="2026-2027">2026 - 2027 Academic Session</option>
                    <option value="2025-2026">2025 - 2026 Academic Session</option>
                    <option value="2027-2028">2027 - 2028 Academic Session</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #334155)', marginBottom: 6 }}>
                    Applicable Classes
                  </label>
                  <select
                    value={applicableClasses}
                    onChange={e => setApplicableClasses(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px solid var(--border, #cbd5e1)',
                      outline: 'none',
                      backgroundColor: 'var(--bg-input, #ffffff)'
                    }}
                  >
                    <option value="All Classes">All Classes</option>
                    {availableClasses.filter(c => c !== 'All Classes').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* GRADING BASIS SELECTION (3 CARDS) */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: 8 }}>
                  Choose Grading System for this Exam:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {/* Option 1: Marks */}
                  <div
                    onClick={() => setGradingType('MARKS')}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: gradingType === 'MARKS' ? '2px solid #2563eb' : '1px solid var(--border, #cbd5e1)',
                      backgroundColor: gradingType === 'MARKS' ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-card, #ffffff)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Percent size={20} color="#2563eb" />
                      {gradingType === 'MARKS' && <CheckCircle2 size={18} color="#2563eb" />}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1e40af' }}>Marks Basis</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Scores evaluated directly on maximum marks and passing mark cutoff.
                    </div>
                  </div>

                  {/* Option 2: CGPA */}
                  <div
                    onClick={() => setGradingType('CGPA')}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: gradingType === 'CGPA' ? '2px solid #7c3aed' : '1px solid var(--border, #cbd5e1)',
                      backgroundColor: gradingType === 'CGPA' ? 'rgba(124, 58, 237, 0.05)' : 'var(--bg-card, #ffffff)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Scale size={20} color="#7c3aed" />
                      {gradingType === 'CGPA' && <CheckCircle2 size={18} color="#7c3aed" />}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#6d28d9' }}>CGPA Basis</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Evaluated on a 10.0 or 4.0 grade point average with percentage conversion multiplier.
                    </div>
                  </div>

                  {/* Option 3: Grade */}
                  <div
                    onClick={() => setGradingType('GRADE')}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: gradingType === 'GRADE' ? '2px solid #059669' : '1px solid var(--border, #cbd5e1)',
                      backgroundColor: gradingType === 'GRADE' ? 'rgba(5, 150, 105, 0.05)' : 'var(--bg-card, #ffffff)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Award size={20} color="#059669" />
                      {gradingType === 'GRADE' && <CheckCircle2 size={18} color="#059669" />}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#047857' }}>Grade Basis</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Award letter grades (A+, A, B, C...) based on customizable score percentage intervals.
                    </div>
                  </div>
                </div>
              </div>

              {/* SPECIFIC CONFIGURATION FIELDS ACCORDING TO SELECTED TYPE */}
              {gradingType === 'MARKS' && (
                <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.03)', padding: 16, borderRadius: 10, border: '1px solid #bfdbfe', marginBottom: 20 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
                    Marks Evaluation Settings
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Total Maximum Marks *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={totalMarks}
                        onChange={e => setTotalMarks(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Minimum Passing Marks *
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={totalMarks}
                        value={passingMarks}
                        onChange={e => setPassingMarks(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        Passing threshold: <strong>{totalMarks > 0 ? ((passingMarks / totalMarks) * 100).toFixed(1) : 0}%</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={allowGraceMarks}
                          onChange={e => setAllowGraceMarks(e.target.checked)}
                        />
                        Allow Grace Marks for Borderline Cases
                      </label>
                      {allowGraceMarks && (
                        <div style={{ marginTop: 6 }}>
                          <span style={{ fontSize: 11, color: '#64748b' }}>Max grace marks: </span>
                          <input
                            type="number"
                            min="1"
                            max="15"
                            value={maxGraceMarks}
                            onChange={e => setMaxGraceMarks(Number(e.target.value))}
                            style={{ width: 60, padding: '4px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e1' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {gradingType === 'CGPA' && (
                <div style={{ backgroundColor: 'rgba(124, 58, 237, 0.03)', padding: 16, borderRadius: 10, border: '1px solid #ddd6fe', marginBottom: 20 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#6d28d9' }}>
                    CGPA Evaluation Settings
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Max Scale (Points)
                      </label>
                      <select
                        value={maxCgpa}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setMaxCgpa(val);
                          if (val === 4.0) {
                            setPassingCgpa(2.0);
                            setScaleMultiplier(25);
                          } else {
                            setPassingCgpa(4.0);
                            setScaleMultiplier(9.5);
                          }
                        }}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                      >
                        <option value={10.0}>10.0 Point CGPA Scale</option>
                        <option value={4.0}>4.0 Point GPA Scale</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Minimum Passing CGPA
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max={maxCgpa}
                        value={passingCgpa}
                        onChange={e => setPassingCgpa(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Percentage Conversion Multiplier
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={scaleMultiplier}
                        onChange={e => setScaleMultiplier(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        e.g. CGPA × {scaleMultiplier} = Percentage %
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {gradingType === 'GRADE' && (
                <div style={{ backgroundColor: 'rgba(5, 150, 105, 0.03)', padding: 16, borderRadius: 10, border: '1px solid #a7f3d0', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#047857' }}>
                        Grade Brackets & Percentage Intervals
                      </h4>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        Configure custom grade symbols, percentage thresholds, and remarks for this exam.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTierRow}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: '#059669',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer'
                      }}
                    >
                      <Plus size={14} /> Add Grade Tier
                    </button>
                  </div>

                  {/* Tiers List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {gradeTiers.map((tier, idx) => (
                      <div
                        key={tier.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '80px 80px 80px 140px 90px 40px',
                          alignItems: 'center',
                          gap: 8,
                          backgroundColor: '#ffffff',
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1'
                        }}
                      >
                        <div>
                          <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Grade</span>
                          <input
                            type="text"
                            value={tier.grade}
                            onChange={e => handleUpdateTierRow(tier.id, 'grade', e.target.value)}
                            style={{ width: '100%', padding: '4px 6px', fontSize: 12, fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: 4 }}
                          />
                        </div>

                        <div>
                          <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Min %</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={tier.minScore}
                            onChange={e => handleUpdateTierRow(tier.id, 'minScore', Number(e.target.value))}
                            style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }}
                          />
                        </div>

                        <div>
                          <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Max %</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={tier.maxScore}
                            onChange={e => handleUpdateTierRow(tier.id, 'maxScore', Number(e.target.value))}
                            style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }}
                          />
                        </div>

                        <div>
                          <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Remark</span>
                          <input
                            type="text"
                            value={tier.remark}
                            onChange={e => handleUpdateTierRow(tier.id, 'remark', e.target.value)}
                            style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }}
                          />
                        </div>

                        <div>
                          <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Status</span>
                          <select
                            value={tier.isPassing ? 'pass' : 'fail'}
                            onChange={e => handleUpdateTierRow(tier.id, 'isPassing', e.target.value === 'pass')}
                            style={{ width: '100%', padding: '4px 4px', fontSize: 11, border: '1px solid #cbd5e1', borderRadius: 4 }}
                          >
                            <option value="pass">Pass</option>
                            <option value="fail">Fail</option>
                          </select>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveTierRow(tier.id)}
                            style={{ background: 'transparent', border: 'none', color: '#e11d48', cursor: 'pointer', padding: 2 }}
                            title="Remove tier"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status and Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, borderTop: '1px solid var(--border, #e2e8f0)', paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Status:</span>
                  <select
                    value={examStatus}
                    onChange={e => setExamStatus(e.target.value as any)}
                    style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      padding: '8px 16px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      backgroundColor: 'transparent',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 20px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: '#e11d48',
                      color: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    {editingExamId ? 'Save Changes' : 'Create Exam System'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIVE TESTER MODAL / DRAWER */}
      {testingExam && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 520,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              border: '1px solid var(--border, #e2e8f0)',
              padding: 24
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                  Interactive Grade Evaluator
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>
                  Testing: <strong>{testingExam.examTitle}</strong> ({testingExam.gradingType} Basis)
                </div>
              </div>
              <button
                onClick={() => setTestingExam(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                {testingExam.gradingType === 'MARKS'
                  ? `Enter Marks Obtained (Out of ${testingExam.marksConfig?.totalMarks}):`
                  : testingExam.gradingType === 'CGPA'
                  ? `Enter CGPA (Scale 0.0 - ${testingExam.cgpaConfig?.maxCgpa}):`
                  : 'Enter Candidate Score / Percentage (0 - 100%):'}
              </label>
              <input
                type="number"
                step={testingExam.gradingType === 'CGPA' ? '0.01' : '1'}
                value={testScoreInput}
                onChange={e => setTestScoreInput(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 16,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: '2px solid #e11d48',
                  outline: 'none',
                  backgroundColor: 'var(--bg-input, #ffffff)',
                  color: 'var(--text-primary, #0f172a)'
                }}
              />
            </div>

            {testEvaluationResult && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  backgroundColor: testEvaluationResult.passed ? 'rgba(5, 150, 105, 0.06)' : 'rgba(225, 29, 72, 0.06)',
                  border: `1px solid ${testEvaluationResult.passed ? '#a7f3d0' : '#fecdd3'}`,
                  marginBottom: 20
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {testEvaluationResult.passed ? (
                    <CheckCircle2 size={20} color="#059669" />
                  ) : (
                    <AlertTriangle size={20} color="#e11d48" />
                  )}
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: 14,
                      color: testEvaluationResult.passed ? '#047857' : '#be123c'
                    }}
                  >
                    {testEvaluationResult.verdict}
                  </span>
                </div>

                {testEvaluationResult.type === 'MARKS' && (
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                    <div>Calculated Percentage: <strong>{testEvaluationResult.percentage}%</strong></div>
                    <div>{testEvaluationResult.remark}</div>
                  </div>
                )}

                {testEvaluationResult.type === 'CGPA' && (
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                    <div>Equivalent Percentage: <strong>{testEvaluationResult.equivalentPercentage}%</strong></div>
                    <div>Classification: <strong>{testEvaluationResult.remark}</strong></div>
                  </div>
                )}

                {testEvaluationResult.type === 'GRADE' && (
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                    <div>Awarded Grade: <strong>{testEvaluationResult.grade}</strong> (GP: {testEvaluationResult.gradePoint})</div>
                    <div>Remark: <strong>{testEvaluationResult.remark}</strong></div>
                  </div>
                )}
              </div>
            )}

            <div style={{ textAlign: 'right' }}>
              <button
                onClick={() => setTestingExam(null)}
                style={{
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Close Evaluator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
