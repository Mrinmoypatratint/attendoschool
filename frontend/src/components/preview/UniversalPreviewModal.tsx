import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  X,
  FileCheck,
  ShieldCheck,
  RotateCcw,
  Maximize2,
  Minimize2,
  FileText
} from 'lucide-react';
import { UniversalPreviewProps } from './types';
import { PreviewSection } from './PreviewSection';
import { PreviewChanges } from './PreviewChanges';

export const UniversalPreviewModal: React.FC<UniversalPreviewProps> = ({
  isOpen,
  onClose,
  onEdit,
  onConfirm,
  title,
  subtitle = 'Please carefully review the entered details before permanently committing to the database.',
  entityName,
  operationType = 'create',
  confirmText,
  confirmIcon,
  editText = 'Back to Edit',
  loading = false,
  error = null,
  sections = [],
  changes = [],
  summaryCards = [],
  tableData,
  isDestructive = false,
  destructiveWarning,
  children,
  width = 'min(700px, 95vw)',
  onSecondary,
  secondaryText = 'Save as Draft',
  secondaryLoading = false,
  secondaryIcon,
  cancelText = 'Cancel',
  showCancel = false
}) => {
  if (!isOpen) return null;

  const [isMaximized, setIsMaximized] = useState(false);

  const defaultConfirmText =
    confirmText ||
    (isDestructive
      ? 'Confirm & Delete'
      : operationType === 'update'
      ? 'Confirm & Save Changes'
      : operationType === 'submit'
      ? 'Confirm & Submit'
      : operationType === 'import'
      ? 'Confirm & Import Data'
      : 'Confirm & Save');

  return (
    <div
      className={`overlay fixed inset-0 z-[10050] bg-slate-900/60 backdrop-blur-md flex items-center justify-center transition-all ${
        isMaximized ? 'p-2' : 'p-4'
      }`}
    >
      <div
        className={`modal flex flex-col bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 shadow-2xl overflow-hidden p-0 transition-all ${
          isMaximized
            ? 'w-[97vw] h-[97vh] max-h-[97vh] rounded-xl'
            : 'max-h-[92vh] rounded-2xl'
        }`}
        style={{ width: isMaximized ? '97vw' : width }}
      >
        {/* ─── Modal Header ─── */}
        <div
          className={`px-6 py-5 pb-4 border-b flex items-center justify-between transition-colors ${
            isDestructive
              ? 'border-rose-500/25 bg-rose-50 dark:bg-rose-950/40'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10.5 h-10.5 rounded-xl flex items-center justify-center shrink-0 ${
                isDestructive
                  ? 'bg-rose-500/20 text-rose-500'
                  : 'bg-blue-600/15 text-blue-600 dark:text-blue-400'
              }`}
            >
              {isDestructive ? <AlertTriangle size={22} /> : <FileCheck size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className={`m-0 text-lg font-extrabold tracking-tight ${
                    isDestructive ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {title}
                </h3>
                <span
                  className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    isDestructive
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      : operationType === 'update'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  }`}
                >
                  {isDestructive ? 'Destructive Action' : operationType === 'update' ? 'Update Preview' : 'Preview Step'}
                </span>
              </div>
              <p className="m-0 mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsMaximized(m => !m)}
              disabled={loading}
              className={`p-1.5 rounded-lg border-0 cursor-pointer disabled:cursor-not-allowed transition-all ${
                isMaximized
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                  : 'bg-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title={isMaximized ? 'Restore standard size' : 'Maximize window'}
            >
              {isMaximized ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-1.5 rounded-lg bg-transparent border-0 cursor-pointer disabled:cursor-not-allowed text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
              title="Cancel and return"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─── Scrollable Modal Body ─── */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Review Banner */}
          {!isDestructive && (
            <div className="flex items-center gap-2.5 p-3 px-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-300 text-[13px] mb-4">
              <ShieldCheck size={18} className="shrink-0" />
              <span>
                <strong>Verification Mode:</strong> This record has not been saved yet. Please review all fields. If anything needs correction, click <strong>{editText}</strong>.
              </span>
            </div>
          )}

          {/* Destructive Warning */}
          {isDestructive && (
            <div className="flex items-center gap-2.5 p-3 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-[13px] mb-4 font-semibold">
              <AlertTriangle size={20} className="shrink-0" />
              <span>
                {destructiveWarning ||
                  `Warning: This destructive operation will delete or deactivate ${entityName || 'this record'}. This cannot be undone.`}
              </span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-300 text-[13px] mb-4 flex items-center justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={onEdit}
                className="bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer"
              >
                Back to Form
              </button>
            </div>
          )}

          {/* KPI Summary Cards */}
          {summaryCards.length > 0 && (
            <div
              className="grid gap-3 mb-4"
              style={{
                gridTemplateColumns: `repeat(auto-fit, minmax(${Math.min(180, Math.floor(100 / summaryCards.length))}px, 1fr))`
              }}
            >
              {summaryCards.map((c, i) => (
                <div
                  key={c.label || i}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 px-3.5"
                >
                  <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                    {c.label}
                  </span>
                  <div className="text-[22px] font-extrabold text-slate-900 dark:text-slate-100 my-0.5">
                    {c.value}
                  </div>
                  {c.sub && <span className="text-[11px] text-slate-500 dark:text-slate-400">{c.sub}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Change Detection Diff (for Edit/Update) */}
          {changes.length > 0 && <PreviewChanges changes={changes} />}

          {/* Detailed Field Sections */}
          {sections.map((s, i) => (
            <PreviewSection key={s.title || i} {...s} />
          ))}

          {/* Table Data Preview */}
          {tableData && tableData.rows.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-4 shadow-xs">
              <table className="w-full border-collapse text-[12.5px] text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                    {tableData.headers.map((h, i) => (
                      <th
                        key={i}
                        className="p-2.5 px-3.5 text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2.5 px-3.5 text-slate-800 dark:text-slate-200">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Custom Children */}
          {children}
        </div>

        {/* ─── Modal Footer Actions ─── */}
        <div className="p-4 sm:px-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90 gap-3 flex-wrap">
          {/* Left: Back to Edit Button */}
          <button
            type="button"
            onClick={onEdit}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer disabled:cursor-not-allowed border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all shadow-xs"
          >
            <ArrowLeft size={16} />
            <span>{editText}</span>
          </button>

          {/* Right: Cancel / Draft & Final Confirm Buttons */}
          <div className="flex items-center gap-2.5">
            {showCancel && onSecondary && (
              <button
                type="button"
                onClick={onClose}
                disabled={loading || secondaryLoading}
                className="px-3.5 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer disabled:cursor-not-allowed border-0 bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                {cancelText}
              </button>
            )}

            {onSecondary ? (
              <button
                type="button"
                onClick={onSecondary}
                disabled={loading || secondaryLoading}
                className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer disabled:cursor-not-allowed border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-xs"
              >
                {secondaryLoading ? (
                  <>
                    <Loader2 size={16} className="spinning" />
                    <span>Saving Draft…</span>
                  </>
                ) : (
                  <>
                    {secondaryIcon || <FileText size={16} />}
                    <span>{secondaryText}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer disabled:cursor-not-allowed border-0 bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                {cancelText}
              </button>
            )}

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading || secondaryLoading}
              className={`inline-flex items-center gap-2 px-5.5 py-2.5 rounded-xl text-[13px] font-bold text-white border-0 cursor-pointer disabled:cursor-not-allowed transition-all shadow-sm ${
                isDestructive
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spinning" />
                  <span>Submitting…</span>
                </>
              ) : (
                <>
                  {confirmIcon || <CheckCircle2 size={16} />}
                  <span>{defaultConfirmText}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
