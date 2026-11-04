import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type PopupType = 'success' | 'error' | 'warning' | 'info';

export interface PopupOptions {
  title?: string;
  type?: PopupType;
  confirmText?: string;
  cancelText?: string;
  isConfirm?: boolean;
  danger?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface PopupState {
  isOpen: boolean;
  message: string;
  title: string;
  type: PopupType;
  isConfirm: boolean;
  confirmText: string;
  cancelText: string;
  danger: boolean;
  resolve?: (value: boolean) => void;
}

interface PopupContextType {
  showAlert: (message: string, options?: PopupOptions) => Promise<void>;
  showConfirm: (message: string, options?: PopupOptions) => Promise<boolean>;
  showSuccess: (message: string, title?: string) => Promise<void>;
  showError: (message: string, title?: string) => Promise<void>;
  showWarning: (message: string, title?: string) => Promise<void>;
  showInfo: (message: string, title?: string) => Promise<void>;
  closePopup: () => void;
}

const PopupContext = createContext<PopupContextType | null>(null);

// Global event bus for non-React invocation (e.g. from axios interceptors or window.alert)
type PopupEventDetail = {
  message: string;
  options?: PopupOptions;
  resolve?: (val: boolean) => void;
};

const POPUP_OPEN_EVENT = 'attendoschool_popup_open';

function inferTypeAndTitle(message: string, customOptions?: PopupOptions): { type: PopupType; title: string } {
  if (customOptions?.type && customOptions?.title) {
    return { type: customOptions.type, title: customOptions.title };
  }

  const lower = message.toLowerCase();

  let inferredType: PopupType = customOptions?.type || 'info';
  let inferredTitle = customOptions?.title || '';

  if (!customOptions?.type) {
    if (
      lower.includes('fail') ||
      lower.includes('error') ||
      lower.includes('could not') ||
      lower.includes('invalid') ||
      lower.includes('expired') ||
      lower.includes('rejected') ||
      lower.includes('cannot') ||
      lower.includes('denied')
    ) {
      inferredType = 'error';
    } else if (
      lower.includes('success') ||
      lower.includes('completed') ||
      lower.includes('saved') ||
      lower.includes('created') ||
      lower.includes('imported') ||
      lower.includes('registered') ||
      lower.includes('updated')
    ) {
      inferredType = 'success';
    } else if (
      lower.includes('please') ||
      lower.includes('select') ||
      lower.includes('warning') ||
      lower.includes('caution') ||
      lower.includes('required') ||
      lower.includes('confirm')
    ) {
      inferredType = 'warning';
    }
  }

  if (!inferredTitle) {
    switch (inferredType) {
      case 'success':
        inferredTitle = 'Action Successful';
        break;
      case 'error':
        inferredTitle = 'Action Failed';
        break;
      case 'warning':
        inferredTitle = 'Notice';
        break;
      case 'info':
      default:
        inferredTitle = 'Information';
        break;
    }
  }

  return { type: inferredType, title: inferredTitle };
}

/**
 * Global popup utility that can be called from anywhere, including outside React components.
 */
export const popup = {
  alert: (message: string, options?: PopupOptions): Promise<void> => {
    return new Promise(resolve => {
      if (typeof window !== 'undefined') {
        const detail: PopupEventDetail = {
          message,
          options: { ...options, isConfirm: false },
          resolve: () => resolve()
        };
        window.dispatchEvent(new CustomEvent(POPUP_OPEN_EVENT, { detail }));
      } else {
        resolve();
      }
    });
  },

  confirm: (message: string, options?: PopupOptions): Promise<boolean> => {
    return new Promise(resolve => {
      if (typeof window !== 'undefined') {
        const detail: PopupEventDetail = {
          message,
          options: { ...options, isConfirm: true },
          resolve
        };
        window.dispatchEvent(new CustomEvent(POPUP_OPEN_EVENT, { detail }));
      } else {
        resolve(false);
      }
    });
  },

  success: (message: string, title?: string): Promise<void> => {
    return popup.alert(message, { type: 'success', title: title || 'Action Successful' });
  },

  error: (message: string, title?: string): Promise<void> => {
    return popup.alert(message, { type: 'error', title: title || 'Action Failed' });
  },

  warning: (message: string, title?: string): Promise<void> => {
    return popup.alert(message, { type: 'warning', title: title || 'Attention Required' });
  },

  info: (message: string, title?: string): Promise<void> => {
    return popup.alert(message, { type: 'info', title: title || 'Information' });
  }
};

/**
 * Global interceptor that replaces native window.alert and window.confirm
 * with institutional branded modal popups.
 */
export function initializeGlobalPopups() {
  if (typeof window === 'undefined') return;

  const originalAlert = window.alert;
  const originalConfirm = window.confirm;

  // Intercept window.alert
  window.alert = (message?: any) => {
    try {
      popup.alert(String(message ?? ''));
    } catch {
      originalAlert(message);
    }
  };

  // Intercept window.confirm (async fallback: returns true after triggering dialog if synchronous caller)
  window.confirm = (message?: string) => {
    try {
      popup.confirm(String(message ?? ''));
      return true;
    } catch {
      return originalConfirm(message);
    }
  };
}

export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PopupState>({
    isOpen: false,
    message: '',
    title: '',
    type: 'info',
    isConfirm: false,
    confirmText: 'OK',
    cancelText: 'Cancel',
    danger: false
  });

  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const closePopup = useCallback((confirmed: boolean) => {
    setState(prev => {
      if (prev.resolve) {
        prev.resolve(confirmed);
      }
      return { ...prev, isOpen: false, resolve: undefined };
    });
  }, []);

  // Listen for global custom event
  useEffect(() => {
    const handlePopupEvent = (e: Event) => {
      const customEvent = e as CustomEvent<PopupEventDetail>;
      const { message, options, resolve } = customEvent.detail;

      const { type, title } = inferTypeAndTitle(message, options);

      setState({
        isOpen: true,
        message,
        title,
        type,
        isConfirm: Boolean(options?.isConfirm),
        confirmText: options?.confirmText || (options?.isConfirm ? 'Confirm' : 'OK'),
        cancelText: options?.cancelText || 'Cancel',
        danger: Boolean(options?.danger),
        resolve: (val: boolean) => {
          if (val && options?.onConfirm) options.onConfirm();
          if (!val && options?.onCancel) options.onCancel();
          if (resolve) resolve(val);
        }
      });
    };

    window.addEventListener(POPUP_OPEN_EVENT, handlePopupEvent);
    return () => {
      window.removeEventListener(POPUP_OPEN_EVENT, handlePopupEvent);
    };
  }, []);

  // Initialize global alert/confirm interceptors once on mount
  useEffect(() => {
    initializeGlobalPopups();
  }, []);

  // Focus confirm button when dialog opens & listen for Escape key
  useEffect(() => {
    if (state.isOpen) {
      setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.isOpen) return;
      if (e.key === 'Escape') {
        closePopup(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isOpen, closePopup]);

  const showAlert = useCallback((message: string, options?: PopupOptions) => popup.alert(message, options), []);
  const showConfirm = useCallback((message: string, options?: PopupOptions) => popup.confirm(message, options), []);
  const showSuccess = useCallback((message: string, title?: string) => popup.success(message, title), []);
  const showError = useCallback((message: string, title?: string) => popup.error(message, title), []);
  const showWarning = useCallback((message: string, title?: string) => popup.warning(message, title), []);
  const showInfo = useCallback((message: string, title?: string) => popup.info(message, title), []);

  return (
    <PopupContext.Provider
      value={{
        showAlert,
        showConfirm,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        closePopup: () => closePopup(false)
      }}
    >
      {children}

      {/* Modern Centered Modal Dialog Popup */}
      {state.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-md animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget && !state.isConfirm) {
              closePopup(false);
            }
          }}
        >
          <div className="relative w-full max-w-[440px] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:px-7 sm:py-6 overflow-hidden animate-scaleIn transition-colors">
            {/* Top Close Button */}
            {!state.isConfirm && (
              <button
                type="button"
                onClick={() => closePopup(false)}
                aria-label="Close"
                className="absolute top-3.5 right-3.5 w-8 h-8 flex items-center justify-center rounded-full border-0 bg-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            )}

            {/* Header Icon + Title */}
            <div className="flex items-start gap-3.5 mb-3.5">
              <div
                className={`w-11 h-11 min-w-[44px] rounded-xl flex items-center justify-center shrink-0 ${
                  state.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : state.type === 'error'
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    : state.type === 'warning'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                }`}
              >
                {state.type === 'success' && <CheckCircle2 size={24} />}
                {state.type === 'error' && <XCircle size={24} />}
                {state.type === 'warning' && <AlertTriangle size={24} />}
                {state.type === 'info' && <Info size={24} />}
              </div>

              <div className="flex-1 pt-0.5">
                <h3 className="m-0 text-[17px] font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                  {state.title}
                </h3>
                <div className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
                  {state.message}
                </div>
              </div>
            </div>

            {/* Actions / Buttons */}
            <div className="mt-5 flex items-center justify-end gap-2.5">
              {state.isConfirm && (
                <button
                  type="button"
                  onClick={() => closePopup(false)}
                  className="px-4.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-[13.5px] font-semibold cursor-pointer transition-colors shadow-xs"
                >
                  {state.cancelText}
                </button>
              )}

              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => closePopup(true)}
                className={`px-5.5 py-2 rounded-xl border-0 text-white text-[13.5px] font-semibold cursor-pointer transition-all shadow-md active:scale-98 ${
                  state.danger || state.type === 'error'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                    : state.type === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                }`}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </PopupContext.Provider>
  );
}

export function usePopup() {
  const ctx = useContext(PopupContext);
  if (!ctx) {
    // Fallback to global popup methods if used outside provider
    return {
      showAlert: popup.alert,
      showConfirm: popup.confirm,
      showSuccess: popup.success,
      showError: popup.error,
      showWarning: popup.warning,
      showInfo: popup.info,
      closePopup: () => {}
    };
  }
  return ctx;
}
