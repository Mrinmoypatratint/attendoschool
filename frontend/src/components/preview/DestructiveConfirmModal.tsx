import React from 'react';
import { AlertTriangle, Trash2, X, Loader2, Send } from 'lucide-react';
import { DestructiveConfirmProps } from './types';

export const DestructiveConfirmModal: React.FC<DestructiveConfirmProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  entityName,
  entityType,
  details = [],
  warningMessage,
  confirmText = 'Confirm & Delete',
  loading = false,
  error = null
}) => {
  if (!isOpen) return null;

  const isPublish = confirmText.toLowerCase().includes('publish') || confirmText.toLowerCase().includes('broadcast');

  return (
    <div className="overlay fixed inset-0 z-[10060] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className={`modal w-[min(500px,95vw)] bg-white dark:bg-slate-900 rounded-2xl overflow-hidden p-0 border transition-all ${
          isPublish
            ? 'border-emerald-500/35 shadow-2xl shadow-emerald-500/20'
            : 'border-rose-200 dark:border-rose-900/40 shadow-2xl shadow-rose-600/20'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-5 pb-4 border-b flex items-center justify-between ${
            isPublish
              ? 'border-emerald-500/25 bg-emerald-50 dark:bg-emerald-950/40'
              : 'border-rose-500/25 bg-rose-50 dark:bg-rose-950/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${
                isPublish
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
              }`}
            >
              {isPublish ? <Send size={20} /> : <AlertTriangle size={22} />}
            </div>
            <div>
              <h3
                className={`m-0 text-[17px] font-extrabold ${
                  isPublish ? 'text-slate-900 dark:text-slate-100' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {title || (isPublish ? `Publish ${entityType}` : `Delete ${entityType}`)}
              </h3>
              <p
                className={`m-0 mt-0.5 text-[12.5px] ${
                  isPublish ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                }`}
              >
                {isPublish ? 'Broadcast & delivery confirmation' : 'Destructive operation confirmation'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={`p-1 bg-transparent border-0 cursor-pointer disabled:cursor-not-allowed transition-colors hover:opacity-75 ${
              isPublish ? 'text-slate-500 dark:text-slate-400' : 'text-rose-500'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="p-2.5 px-3.5 rounded-lg bg-rose-500/15 border border-rose-500/35 text-rose-600 dark:text-rose-300 text-[13px] mb-3.5">
              {error}
            </div>
          )}

          <div className="p-3 px-4 rounded-[10px] bg-rose-500/10 border border-rose-500/25 text-slate-800 dark:text-rose-200 text-[13.5px] mb-4 leading-relaxed">
            {warningMessage || (
              <span>
                Are you sure you want to permanently remove <strong>{entityName}</strong> from active institutional records? This operation will revoke portal access.
              </span>
            )}
          </div>

          {/* Affected Entity Details Card */}
          {details.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-[10px] p-3 px-3.5">
              <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-2">
                Target Record Details
              </span>
              <div className="grid grid-cols-2 gap-2">
                {details.map((d, i) => (
                  <div key={i}>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      {d.label}
                    </span>
                    <strong className="text-[13px] text-slate-900 dark:text-slate-100">
                      {String(d.value)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer disabled:cursor-not-allowed border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-bold text-white border-0 cursor-pointer disabled:cursor-not-allowed transition-all shadow-sm ${
              isPublish
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="spinning" />
                <span>{isPublish ? 'Publishing…' : 'Deleting…'}</span>
              </>
            ) : (
              <>
                {isPublish ? <Send size={15} /> : <Trash2 size={15} />}
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
