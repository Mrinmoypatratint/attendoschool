import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Plus,
  RotateCcw,
  Download,
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
  Scale
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export interface GradeTier {
  id: string;
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  gradePoint: number;
  remark: string;
  isPassing: boolean;
  colorScheme: 'emerald' | 'blue' | 'indigo' | 'cyan' | 'amber' | 'orange' | 'rose';
  description?: string;
}

const DEFAULT_CBSE_TIERS: GradeTier[] = [
  {
    id: 'grade-a1',
    grade: 'A1',
    minPercentage: 91,
    maxPercentage: 100,
    gradePoint: 10.0,
    remark: 'Outstanding Performance',
    isPassing: true,
    colorScheme: 'emerald',
    description: 'Top 1/8th of passed candidates'
  },
  {
    id: 'grade-a2',
    grade: 'A2',
    minPercentage: 81,
    maxPercentage: 90,
    gradePoint: 9.0,
    remark: 'Excellent Performance',
    isPassing: true,
    colorScheme: 'emerald',
    description: 'Next 1/8th of passed candidates'
  },
  {
    id: 'grade-b1',
    grade: 'B1',
    minPercentage: 71,
    maxPercentage: 80,
    gradePoint: 8.0,
    remark: 'Very Good Performance',
    isPassing: true,
    colorScheme: 'blue',
    description: 'Next 1/8th of passed candidates'
  },
  {
    id: 'grade-b2',
    grade: 'B2',
    minPercentage: 61,
    maxPercentage: 70,
    gradePoint: 7.0,
    remark: 'Good Performance',
    isPassing: true,
    colorScheme: 'cyan',
    description: 'Next 1/8th of passed candidates'
  },
  {
    id: 'grade-c1',
    grade: 'C1',
    minPercentage: 51,
    maxPercentage: 60,
    gradePoint: 6.0,
    remark: 'Above Average',
    isPassing: true,
    colorScheme: 'indigo',
    description: 'Next 1/8th of passed candidates'
  },
  {
    id: 'grade-c2',
    grade: 'C2',
    minPercentage: 41,
    maxPercentage: 50,
    gradePoint: 5.0,
    remark: 'Average Performance',
    isPassing: true,
    colorScheme: 'amber',
    description: 'Next 1/8th of passed candidates'
  },
  {
    id: 'grade-d',
    grade: 'D',
    minPercentage: 33,
    maxPercentage: 40,
    gradePoint: 4.0,
    remark: 'Marginal / Minimum Pass',
    isPassing: true,
    colorScheme: 'orange',
    description: 'Next 1/8th of passed candidates (Qualifying)'
  },
  {
    id: 'grade-e',
    grade: 'E',
    minPercentage: 21,
    maxPercentage: 32,
    gradePoint: 0.0,
    remark: 'Needs Improvement / Re-test',
    isPassing: false,
    colorScheme: 'rose',
    description: 'Essential repeat / compartment candidate'
  },
  {
    id: 'grade-f',
    grade: 'F',
    minPercentage: 0,
    maxPercentage: 20,
    gradePoint: 0.0,
    remark: 'Unsatisfactory / Failed',
    isPassing: false,
    colorScheme: 'rose',
    description: 'Candidate must repeat subject'
  }
];

const DEFAULT_GPA4_TIERS: GradeTier[] = [
  { id: 'gpa-ap', grade: 'A+', minPercentage: 95, maxPercentage: 100, gradePoint: 4.0, remark: 'Exceptional', isPassing: true, colorScheme: 'emerald' },
  { id: 'gpa-a', grade: 'A', minPercentage: 90, maxPercentage: 94, gradePoint: 3.8, remark: 'Excellent', isPassing: true, colorScheme: 'emerald' },
  { id: 'gpa-bp', grade: 'B+', minPercentage: 85, maxPercentage: 89, gradePoint: 3.5, remark: 'Very Good', isPassing: true, colorScheme: 'blue' },
  { id: 'gpa-b', grade: 'B', minPercentage: 80, maxPercentage: 84, gradePoint: 3.0, remark: 'Good', isPassing: true, colorScheme: 'cyan' },
  { id: 'gpa-cp', grade: 'C+', minPercentage: 75, maxPercentage: 79, gradePoint: 2.5, remark: 'Competent', isPassing: true, colorScheme: 'indigo' },
  { id: 'gpa-c', grade: 'C', minPercentage: 70, maxPercentage: 74, gradePoint: 2.0, remark: 'Satisfactory', isPassing: true, colorScheme: 'amber' },
  { id: 'gpa-dp', grade: 'D+', minPercentage: 65, maxPercentage: 69, gradePoint: 1.5, remark: 'Passing', isPassing: true, colorScheme: 'orange' },
  { id: 'gpa-d', grade: 'D', minPercentage: 60, maxPercentage: 64, gradePoint: 1.0, remark: 'Conditional Pass', isPassing: true, colorScheme: 'orange' },
  { id: 'gpa-f', grade: 'F', minPercentage: 0, maxPercentage: 59, gradePoint: 0.0, remark: 'Fail / No Credit', isPassing: false, colorScheme: 'rose' }
];

export default function GradingSystem() {
  const { user } = useAuth();
  const schoolId = user?.schoolId || 'default-school';
  const storageKey = `attendo_grading_tiers_${schoolId}`;
  const configStorageKey = `attendo_grading_rules_${schoolId}`;

  // Tabs
  const [activeTab, setActiveTab] = useState<'cbse' | 'gpa' | 'rules' | 'calculator'>('cbse');

  // Tiers State
  const [tiers, setTiers] = useState<GradeTier[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CBSE_TIERS;
  });

  const [gpaTiers, setGpaTiers] = useState<GradeTier[]>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}_gpa`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_GPA4_TIERS;
  });

  // Evaluation Rules State
  const [rules, setRules] = useState(() => {
    try {
      const saved = localStorage.getItem(configStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      minSubjectPassPercentage: 33,
      minOverallPassPercentage: 35,
      theoryWeightage: 80,
      internalWeightage: 20,
      graceMarksLimit: 5,
      practicalPassMandatory: true,
      displayGradePointsOnReportCard: true,
      roundPercentageUp: false
    };
  });

  // Modal State for Add / Edit Grade Tier
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<GradeTier | null>(null);
  const [tierForm, setTierForm] = useState<Partial<GradeTier>>({
    grade: '',
    minPercentage: 0,
    maxPercentage: 100,
    gradePoint: 10,
    remark: '',
    isPassing: true,
    colorScheme: 'emerald',
    description: ''
  });
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Calculator State
  const [calcMaxMarks, setCalcMaxMarks] = useState<number>(100);
  const [calcObtainedMarks, setCalcObtainedMarks] = useState<number>(85);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const saveTiersToStorage = (updated: GradeTier[]) => {
    setTiers(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
  };

  const saveGpaTiersToStorage = (updated: GradeTier[]) => {
    setGpaTiers(updated);
    try {
      localStorage.setItem(`${storageKey}_gpa`, JSON.stringify(updated));
    } catch {}
  };

  const handleSaveRules = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(configStorageKey, JSON.stringify(rules));
      showToast('Evaluation & passing rules updated successfully!');
    } catch {
      showToast('Failed to save settings.');
    }
  };

  const handleResetCBSE = () => {
    if (window.confirm('Reset grading scale back to official CBSE 9-point standard scale?')) {
      saveTiersToStorage(DEFAULT_CBSE_TIERS);
      showToast('Restored standard CBSE 9-point scale.');
    }
  };

  const handleOpenAddModal = () => {
    setEditingTier(null);
    setTierForm({
      grade: '',
      minPercentage: 0,
      maxPercentage: 100,
      gradePoint: 5,
      remark: 'Satisfactory',
      isPassing: true,
      colorScheme: 'blue',
      description: ''
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (tier: GradeTier) => {
    setEditingTier(tier);
    setTierForm({ ...tier });
    setFormError('');
    setModalOpen(true);
  };

  const handleDeleteTier = (id: string) => {
    if (activeTab === 'gpa') {
      if (gpaTiers.length <= 1) {
        alert('You must have at least one grade tier.');
        return;
      }
      if (window.confirm('Are you sure you want to remove this grade tier?')) {
        saveGpaTiersToStorage(gpaTiers.filter(t => t.id !== id));
        showToast('Grade tier removed.');
      }
    } else {
      if (tiers.length <= 1) {
        alert('You must have at least one grade tier.');
        return;
      }
      if (window.confirm('Are you sure you want to remove this grade tier?')) {
        saveTiersToStorage(tiers.filter(t => t.id !== id));
        showToast('Grade tier removed.');
      }
    }
  };

  const handleSaveTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierForm.grade?.trim()) {
      setFormError('Grade designation (e.g. A1, A+) is required.');
      return;
    }
    const minP = Number(tierForm.minPercentage);
    const maxP = Number(tierForm.maxPercentage);
    const gp = Number(tierForm.gradePoint);

    if (isNaN(minP) || isNaN(maxP) || minP < 0 || maxP > 100 || minP > maxP) {
      setFormError('Valid percentage range between 0 and 100 is required (Min ≤ Max).');
      return;
    }

    if (isNaN(gp) || gp < 0) {
      setFormError('Grade point must be a valid non-negative number.');
      return;
    }

    const currentList = activeTab === 'gpa' ? gpaTiers : tiers;
    if (editingTier) {
      const updated = currentList.map(t => (t.id === editingTier.id ? { ...t, ...tierForm } as GradeTier : t));
      if (activeTab === 'gpa') saveGpaTiersToStorage(updated);
      else saveTiersToStorage(updated);
      showToast(`Grade tier ${tierForm.grade} updated.`);
    } else {
      const newTier: GradeTier = {
        id: `grade-${Date.now()}`,
        grade: tierForm.grade.trim().toUpperCase(),
        minPercentage: minP,
        maxPercentage: maxP,
        gradePoint: gp,
        remark: tierForm.remark || 'Standard',
        isPassing: Boolean(tierForm.isPassing),
        colorScheme: tierForm.colorScheme || 'blue',
        description: tierForm.description || ''
      };
      const updated = [newTier, ...currentList].sort((a, b) => b.minPercentage - a.minPercentage);
      if (activeTab === 'gpa') saveGpaTiersToStorage(updated);
      else saveTiersToStorage(updated);
      showToast(`Added grade tier ${newTier.grade}.`);
    }
    setModalOpen(false);
  };

  const handleExportJSON = () => {
    const exportData = {
      schoolId,
      exportedAt: new Date().toISOString(),
      activeTab,
      cbseScale: tiers,
      gpaScale: gpaTiers,
      evaluationRules: rules
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grading-system-${activeTab}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Grading configuration exported.');
  };

  // Calculator Result
  const calcResult = useMemo(() => {
    const max = Number(calcMaxMarks) || 100;
    const obt = Number(calcObtainedMarks) || 0;
    const pct = Math.min(100, Math.max(0, Math.round((obt / max) * 100 * 10) / 10));

    const activeList = tiers;
    const matched = activeList.find(t => pct >= t.minPercentage && pct <= t.maxPercentage) ||
      (pct > 100 ? activeList[0] : activeList[activeList.length - 1]);

    const passed = pct >= rules.minSubjectPassPercentage;

    return {
      percentage: pct,
      grade: matched?.grade || '—',
      gradePoint: matched?.gradePoint ?? 0,
      remark: matched?.remark || '—',
      isPassing: passed
    };
  }, [calcMaxMarks, calcObtainedMarks, tiers, rules]);

  // Chip Badge Renderer
  const renderBadge = (tier: GradeTier) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      emerald: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
      blue: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
      cyan: { bg: '#ecfeff', text: '#0891b2', border: '#a5f3fc' },
      indigo: { bg: '#eef2ff', text: '#4f46e5', border: '#c7d2fe' },
      amber: { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
      orange: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
      rose: { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3' }
    };
    const c = colors[tier.colorScheme] || colors.blue;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 13,
          minWidth: 42,
          padding: '3px 10px',
          borderRadius: 6,
          background: c.bg,
          color: c.text,
          border: `1px solid ${c.border}`
        }}
      >
        {tier.grade}
      </span>
    );
  };

  return (
    <div className="w-full max-w-none m-0 pb-10" style={{ width: '100%', maxWidth: 'none', margin: 0, padding: '24px 24px 40px', boxSizing: 'border-box' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            background: '#1c1f2e',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <CheckCircle2 size={16} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb / Dashboard Return Link */}
      <Link
        to="/dashboard"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          color: '#e11d48',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 12
        }}
      >
        <ArrowLeft size={16} /> <span>Dashboard</span>
      </Link>

      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 10px -1px rgba(99, 102, 241, 0.3)'
            }}
          >
            <Award size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text, #1c1f2e)', letterSpacing: '-0.02em' }}>
              Grading System &amp; Evaluation Scales
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
              Configure academic grade scales, percentage intervals, grade point mappings, and passing evaluation rules across grade levels.
            </p>
          </div>
        </div>

        {/* Global Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportJSON}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border, #e2e8f0)',
              background: 'var(--card, #ffffff)',
              color: 'var(--text, #334155)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Download size={15} />
            <span>Export Configuration</span>
          </button>

          <button
            type="button"
            onClick={handleResetCBSE}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border, #e2e8f0)',
              background: 'var(--card, #ffffff)',
              color: 'var(--text, #334155)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Reset to default CBSE 9-point scale"
          >
            <RotateCcw size={15} />
            <span>Reset to CBSE Scale</span>
          </button>

          {(activeTab === 'cbse' || activeTab === 'gpa') && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#e11d48',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(225, 29, 72, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <Plus size={16} />
              <span>Add Grade Tier</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--card, #ffffff)', border: '1px solid var(--border, #e2e8f0)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Scheme
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text, #1c1f2e)', marginTop: 4 }}>
            {activeTab === 'gpa' ? 'Higher Secondary GPA (4.0)' : 'CBSE 9-Point Scale'}
          </div>
          <div style={{ fontSize: 12, color: '#059669', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={13} />
            <span>Standard School Board Compliant</span>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--card, #ffffff)', border: '1px solid var(--border, #e2e8f0)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Grade Tiers
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text, #1c1f2e)', marginTop: 4 }}>
            {(activeTab === 'gpa' ? gpaTiers : tiers).length} Defined Intervals
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>
            Highest: {(activeTab === 'gpa' ? gpaTiers : tiers)[0]?.grade} | Lowest: {(activeTab === 'gpa' ? gpaTiers : tiers).slice(-1)[0]?.grade}
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--card, #ffffff)', border: '1px solid var(--border, #e2e8f0)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Passing Threshold
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#059669', marginTop: 4 }}>
            {rules.minSubjectPassPercentage}% (Grade D)
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>
            Below {rules.minSubjectPassPercentage}% marked as Needs Improvement
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--card, #ffffff)', border: '1px solid var(--border, #e2e8f0)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Max Grade Point
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text, #1c1f2e)', marginTop: 4 }}>
            {activeTab === 'gpa' ? '4.0 GPA' : '10.0 GP'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>
            Mapped across cumulative evaluations
          </div>
        </div>
      </div>

      {/* Main Container Card with Harmonized Tabs */}
      <div style={{ background: 'var(--card, #ffffff)', borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', overflow: 'hidden' }}>
        {/* Harmonized Tab Navigation Bar (Underline with borderBottom) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            padding: '0 24px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            background: 'var(--card, #ffffff)',
            overflowX: 'auto'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('cbse')}
            style={{
              padding: '16px 4px',
              fontSize: 14,
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: activeTab === 'cbse' ? '#e11d48' : 'var(--text-secondary, #64748b)',
              borderBottom: activeTab === 'cbse' ? '3px solid #e11d48' : '3px solid transparent',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <Scale size={16} />
            <span>CBSE 9-Point Scale (Standard)</span>
            <span style={{ fontSize: 11, background: activeTab === 'cbse' ? 'rgba(225, 29, 72, 0.1)' : 'var(--border, #e2e8f0)', color: activeTab === 'cbse' ? '#e11d48' : 'var(--text-secondary, #64748b)', padding: '2px 7px', borderRadius: 999 }}>
              {tiers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gpa')}
            style={{
              padding: '16px 4px',
              fontSize: 14,
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: activeTab === 'gpa' ? '#e11d48' : 'var(--text-secondary, #64748b)',
              borderBottom: activeTab === 'gpa' ? '3px solid #e11d48' : '3px solid transparent',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <Percent size={16} />
            <span>Higher Secondary 4.0 GPA Scale</span>
            <span style={{ fontSize: 11, background: activeTab === 'gpa' ? 'rgba(225, 29, 72, 0.1)' : 'var(--border, #e2e8f0)', color: activeTab === 'gpa' ? '#e11d48' : 'var(--text-secondary, #64748b)', padding: '2px 7px', borderRadius: 999 }}>
              {gpaTiers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            style={{
              padding: '16px 4px',
              fontSize: 14,
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: activeTab === 'rules' ? '#e11d48' : 'var(--text-secondary, #64748b)',
              borderBottom: activeTab === 'rules' ? '3px solid #e11d48' : '3px solid transparent',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <Sliders size={16} />
            <span>Passing &amp; Evaluation Rules</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calculator')}
            style={{
              padding: '16px 4px',
              fontSize: 14,
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: activeTab === 'calculator' ? '#e11d48' : 'var(--text-secondary, #64748b)',
              borderBottom: activeTab === 'calculator' ? '3px solid #e11d48' : '3px solid transparent',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <Calculator size={16} />
            <span>Interactive Grade Tester</span>
          </button>
        </div>

        {/* Tab 1 & 2: Grade Tiers Table */}
        {(activeTab === 'cbse' || activeTab === 'gpa') && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text, #1c1f2e)' }}>
                  {activeTab === 'cbse' ? 'CBSE K-12 Standard 9-Point Grading Scale' : 'Senior Secondary 4.0 Point GPA Scale'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
                  {activeTab === 'cbse'
                    ? 'Official 9-interval academic performance scale used for report cards, academic transcripts, and marks-to-grade conversions.'
                    : 'College preparatory GPA scale mapping continuous assessment marks to 4.0 cumulative grade point average.'}
                </p>
              </div>
            </div>

            {/* Scrollable Table Area with Horizontal Scrollbar Support */}
            <div
              className="directory-box-body"
              style={{
                overflowX: 'auto',
                overflowY: 'auto',
                borderRadius: 8,
                border: '1px solid var(--border, #e2e8f0)',
                background: 'var(--card, #ffffff)'
              }}
            >
              <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ background: 'var(--card-subtle, #f8fafc)' }}>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary, #64748b)', borderBottom: '1px solid var(--border, #e2e8f0)', width: 100 }}>
                      Grade
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary, #64748b)', borderBottom: '1px solid var(--border, #e2e8f0)', minWidth: 160 }}>
                      Marks Percentage
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary, #64748b)', borderBottom: '1px solid var(--border, #e2e8f0)', width: 130 }}>
                      Grade Point
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary, #64748b)', borderBottom: '1px solid var(--border, #e2e8f0)', minWidth: 220 }}>
                      Qualitative Remark
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary, #64748b)', borderBottom: '1px solid var(--border, #e2e8f0)', minWidth: 220 }}>
                      Description &amp; Criterion
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary, #64748b)', borderBottom: '1px solid var(--border, #e2e8f0)', width: 120 }}>
                      Status
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary, #64748b)', borderBottom: '1px solid var(--border, #e2e8f0)', width: 110, textAlign: 'right' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === 'gpa' ? gpaTiers : tiers).map(tier => (
                    <tr key={tier.id} style={{ borderBottom: '1px solid var(--border, #f1f5f9)', transition: 'background 0.12s ease' }}>
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        {renderBadge(tier)}
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', fontSize: 13, fontWeight: 600, color: 'var(--text, #1c1f2e)' }}>
                        <code>{tier.minPercentage}% – {tier.maxPercentage}%</code>
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', fontSize: 14, fontWeight: 700, color: '#4f46e5' }}>
                        {tier.gradePoint.toFixed(1)}
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', fontSize: 13, fontWeight: 600, color: 'var(--text, #334155)' }}>
                        {tier.remark}
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', fontSize: 12.5, color: 'var(--text-secondary, #64748b)' }}>
                        {tier.description || '—'}
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: tier.isPassing ? '#ecfdf5' : '#fff1f2',
                            color: tier.isPassing ? '#059669' : '#e11d48',
                            border: `1px solid ${tier.isPassing ? '#a7f3d0' : '#fecdd3'}`
                          }}
                        >
                          {tier.isPassing ? <Check size={11} /> : <X size={11} />}
                          <span>{tier.isPassing ? 'PASS' : 'RE-TEST'}</span>
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(tier)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#2563eb',
                            cursor: 'pointer',
                            padding: 4,
                            marginRight: 6
                          }}
                          title="Edit Grade Tier"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTier(tier.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#e11d48',
                            cursor: 'pointer',
                            padding: 4
                          }}
                          title="Delete Grade Tier"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Evaluation & Passing Rules */}
        {activeTab === 'rules' && (
          <form onSubmit={handleSaveRules} style={{ padding: '24px' }}>
            <div style={{ maxWidth: 760 }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text, #1c1f2e)' }}>
                Academic Evaluation &amp; Promotion Criteria
              </h3>
              <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
                Define passing thresholds, assessment weight distributions, and grace marks policies applicable across report cards.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 6 }}>
                    Minimum Subject Passing Percentage (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rules.minSubjectPassPercentage}
                    onChange={e => setRules({ ...rules, minSubjectPassPercentage: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #e2e8f0)',
                      fontSize: 14,
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 4, display: 'block' }}>
                    Standard CBSE requirement is 33% per individual subject.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 6 }}>
                    Minimum Overall Aggregate Percentage (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rules.minOverallPassPercentage}
                    onChange={e => setRules({ ...rules, minOverallPassPercentage: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #e2e8f0)',
                      fontSize: 14,
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 4, display: 'block' }}>
                    Aggregate score needed across all subjects to qualify for annual promotion.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 6 }}>
                    Theory Exam Weightage (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rules.theoryWeightage}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setRules({ ...rules, theoryWeightage: v, internalWeightage: 100 - v });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #e2e8f0)',
                      fontSize: 14,
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 4, display: 'block' }}>
                    Final / Summative Written Exam proportion.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 6 }}>
                    Internal Assessment Weightage (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rules.internalWeightage}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setRules({ ...rules, internalWeightage: v, theoryWeightage: 100 - v });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #e2e8f0)',
                      fontSize: 14,
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 4, display: 'block' }}>
                    Continuous Comprehensive Evaluation / Projects / Periodic Tests.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 6 }}>
                    Maximum Grace Marks Allowance
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={rules.graceMarksLimit}
                    onChange={e => setRules({ ...rules, graceMarksLimit: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #e2e8f0)',
                      fontSize: 14,
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 4, display: 'block' }}>
                    Max marks teachers can grant to elevate marginal candidates to 33% pass.
                  </span>
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text, #1c1f2e)' }}>
                  <input
                    type="checkbox"
                    checked={rules.practicalPassMandatory}
                    onChange={e => setRules({ ...rules, practicalPassMandatory: e.target.checked })}
                    style={{ width: 16, height: 16 }}
                  />
                  <span><b>Mandatory Practical/Lab Exam Passing</b> (Students must score ≥ 33% separately in science/computer practicals)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text, #1c1f2e)' }}>
                  <input
                    type="checkbox"
                    checked={rules.displayGradePointsOnReportCard}
                    onChange={e => setRules({ ...rules, displayGradePointsOnReportCard: e.target.checked })}
                    style={{ width: 16, height: 16 }}
                  />
                  <span><b>Display Grade Point (GP) on Final Report Cards</b> (e.g. 10.0, 9.0 next to letter grade)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text, #1c1f2e)' }}>
                  <input
                    type="checkbox"
                    checked={rules.roundPercentageUp}
                    onChange={e => setRules({ ...rules, roundPercentageUp: e.target.checked })}
                    style={{ width: 16, height: 16 }}
                  />
                  <span><b>Round Percentage Up</b> (e.g. 90.5% automatically becomes 91% for A1 qualification)</span>
                </label>
              </div>

              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#e11d48',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(225, 29, 72, 0.25)'
                }}
              >
                Save Evaluation Rules
              </button>
            </div>
          </form>
        )}

        {/* Tab 4: Interactive Grade Calculator */}
        {activeTab === 'calculator' && (
          <div style={{ padding: '24px' }}>
            <div style={{ maxWidth: 680 }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text, #1c1f2e)' }}>
                Interactive Grade &amp; GPA Tester
              </h3>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
                Simulate candidate scores and verify how the configured grade boundaries and evaluation rules resolve marks in real time.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 6 }}>
                    Total Maximum Marks
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={calcMaxMarks}
                    onChange={e => setCalcMaxMarks(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #e2e8f0)',
                      fontSize: 14,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 6 }}>
                    Marks Obtained by Candidate
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={calcMaxMarks}
                    value={calcObtainedMarks}
                    onChange={e => setCalcObtainedMarks(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #e2e8f0)',
                      fontSize: 14,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Calculator Output Display Card */}
              <div
                style={{
                  padding: '24px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.04) 0%, rgba(99, 102, 241, 0.04) 100%)',
                  border: '1px solid var(--border, #e2e8f0)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 16,
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>
                    Calculated Score
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #1c1f2e)', marginTop: 4 }}>
                    {calcResult.percentage}%
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>
                    Assigned Grade
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#e11d48', marginTop: 4 }}>
                    {calcResult.grade}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>
                    Grade Point (GP)
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#4f46e5', marginTop: 4 }}>
                    {calcResult.gradePoint.toFixed(1)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>
                    Qualifying Result
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        background: calcResult.isPassing ? '#ecfdf5' : '#fff1f2',
                        color: calcResult.isPassing ? '#059669' : '#e11d48',
                        border: `1px solid ${calcResult.isPassing ? '#a7f3d0' : '#fecdd3'}`
                      }}
                    >
                      {calcResult.isPassing ? <Check size={14} /> : <X size={14} />}
                      <span>{calcResult.isPassing ? 'PASSED' : 'NEEDS IMPROVEMENT'}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
                <b>Performance Descriptor:</b> {calcResult.remark}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Grade Tier Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <div
            style={{
              background: 'var(--card, #ffffff)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 520,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid var(--border, #e2e8f0)',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--card-subtle, #f8fafc)'
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text, #1c1f2e)' }}>
                {editingTier ? `Edit Grade Tier (${editingTier.grade})` : 'Add New Grade Tier'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary, #64748b)', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTier} style={{ padding: '20px' }}>
              {formError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 6,
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    color: '#e11d48',
                    fontSize: 13,
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <AlertTriangle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 4 }}>
                    Grade Symbol / Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A1, A+"
                    value={tierForm.grade || ''}
                    onChange={e => setTierForm({ ...tierForm, grade: e.target.value.toUpperCase() })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 4 }}>
                    Grade Point (GP) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    required
                    value={tierForm.gradePoint ?? 0}
                    onChange={e => setTierForm({ ...tierForm, gradePoint: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 4 }}>
                    Minimum Marks % *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={tierForm.minPercentage ?? 0}
                    onChange={e => setTierForm({ ...tierForm, minPercentage: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 4 }}>
                    Maximum Marks % *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={tierForm.maxPercentage ?? 100}
                    onChange={e => setTierForm({ ...tierForm, maxPercentage: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 4 }}>
                  Performance Descriptor / Remark
                </label>
                <input
                  type="text"
                  placeholder="e.g. Outstanding, Excellent, Very Good"
                  value={tierForm.remark || ''}
                  onChange={e => setTierForm({ ...tierForm, remark: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 4 }}>
                  Description / Board Criterion (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Top 1/8th of passed candidates"
                  value={tierForm.description || ''}
                  onChange={e => setTierForm({ ...tierForm, description: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text, #1c1f2e)', marginBottom: 4 }}>
                    Badge Color Theme
                  </label>
                  <select
                    value={tierForm.colorScheme || 'emerald'}
                    onChange={e => setTierForm({ ...tierForm, colorScheme: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)', fontSize: 13 }}
                  >
                    <option value="emerald">Emerald Green (Top Grades)</option>
                    <option value="blue">Blue (Very Good)</option>
                    <option value="cyan">Cyan (Good)</option>
                    <option value="indigo">Indigo (Above Average)</option>
                    <option value="amber">Amber (Average)</option>
                    <option value="orange">Orange (Marginal Pass)</option>
                    <option value="rose">Rose Red (Needs Improvement)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', marginTop: 20 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={tierForm.isPassing}
                      onChange={e => setTierForm({ ...tierForm, isPassing: e.target.checked })}
                      style={{ width: 16, height: 16 }}
                    />
                    <span>Qualifying / Passing Grade</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--border, #e2e8f0)',
                    background: 'transparent',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#e11d48',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {editingTier ? 'Update Grade Tier' : 'Save Grade Tier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

