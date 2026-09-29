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
        window.dispatchEvent(
          new CustomEvent<PopupEventDetail>(POPUP_OPEN_EVENT, {
            detail: {
              message,
              options: { ...options, isConfirm: false },
              resolve: () => resolve()
            }
          })
        );
      } else {
        resolve();
      }
    });
  },

  confirm: (message: string, options?: PopupOptions): Promise<boolean> => {
    return new Promise(resolve => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<PopupEventDetail>(POPUP_OPEN_EVENT, {
            detail: {
              message,
              options: { ...options, isConfirm: true },
              resolve
            }
          })
        );
      } else {
        resolve(true);
      }
    });
  },

  success: (message: string, title?: string) => popup.alert(message, { type: 'success', title }),
  error: (message: string, title?: string) => popup.alert(message, { type: 'error', title }),
  warning: (message: string, title?: string) => popup.alert(message, { type: 'warning', title }),
  info: (message: string, title?: string) => popup.alert(message, { type: 'info', title })
};

export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PopupState>({
    isOpen: false,
    message: '',
    title: 'Notice',
    type: 'info',
    isConfirm: false,
    confirmText: 'OK',
    cancelText: 'Cancel',
    danger: false
  });

  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const openPopupInternal = useCallback((detail: PopupEventDetail) => {
    const { message, options, resolve } = detail;
    const { type, title } = inferTypeAndTitle(message, options);

    setState({
      isOpen: true,
      message,
      title,
      type,
      isConfirm: !!options?.isConfirm,
      confirmText: options?.confirmText || (options?.isConfirm ? 'Confirm' : 'OK'),
      cancelText: options?.cancelText || 'Cancel',
      danger: !!options?.danger,
      resolve
    });
  }, []);

  const closePopup = useCallback((confirmed: boolean = false) => {
    setState(prev => {
      if (prev.resolve) {
        prev.resolve(confirmed);
      }
      return { ...prev, isOpen: false, resolve: undefined };
    });
  }, []);

  // Listen for global popup events and intercept native window.alert/confirm
  useEffect(() => {
    const handlePopupEvent = (e: Event) => {
      const customEvent = e as CustomEvent<PopupEventDetail>;
      if (customEvent.detail) {
        openPopupInternal(customEvent.detail);
      }
    };

    window.addEventListener(POPUP_OPEN_EVENT, handlePopupEvent);

    // Monkey-patch window.alert to route directly into the modern popup UI
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      popup.alert(String(msg ?? ''));
    };

    return () => {
      window.removeEventListener(POPUP_OPEN_EVENT, handlePopupEvent);
      window.alert = originalAlert;
    };
  }, [openPopupInternal]);

  // Handle keyboard events (Enter to confirm, Escape to dismiss)
  useEffect(() => {
    if (!state.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePopup(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        closePopup(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    confirmBtnRef.current?.focus();

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
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            animation: 'attendoFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !state.isConfirm) {
              closePopup(false);
            }
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 440,
              background: 'var(--bg-card, #ffffff)',
              color: 'var(--text, #1e293b)',
              borderRadius: 18,
              border: '1px solid var(--border, #e2e8f0)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              overflow: 'hidden',
              animation: 'attendoScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              padding: '24px 26px 20px'
            }}
          >
            {/* Top Close Button */}
            {!state.isConfirm && (
              <button
                type="button"
                onClick={() => closePopup(false)}
                aria-label="Close"
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted, #64748b)',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bg-subtle, #f1f5f9)';
                  e.currentTarget.style.color = 'var(--text, #0f172a)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted, #64748b)';
                }}
              >
                <X size={18} />
              </button>
            )}

            {/* Header Icon + Title */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  minWidth: 44,
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    state.type === 'success'
                      ? 'rgba(16, 185, 129, 0.14)'
                      : state.type === 'error'
                      ? 'rgba(239, 68, 68, 0.14)'
                      : state.type === 'warning'
                      ? 'rgba(245, 158, 11, 0.14)'
                      : 'rgba(59, 130, 246, 0.14)',
                  color:
                    state.type === 'success'
                      ? '#059669'
                      : state.type === 'error'
                      ? '#dc2626'
                      : state.type === 'warning'
                      ? '#d97706'
                      : '#2563eb'
                }}
              >
                {state.type === 'success' && <CheckCircle2 size={24} />}
                {state.type === 'error' && <XCircle size={24} />}
                {state.type === 'warning' && <AlertTriangle size={24} />}
                {state.type === 'info' && <Info size={24} />}
              </div>

              <div style={{ flex: 1, paddingTop: 2 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 700,
                    color: 'var(--text, #0f172a)',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.3
                  }}
                >
                  {state.title}
                </h3>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    color: 'var(--text-muted, #475569)',
                    lineHeight: 1.55,
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {state.message}
                </div>
              </div>
            </div>

            {/* Actions / Buttons */}
            <div
              style={{
                marginTop: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 10
              }}
            >
              {state.isConfirm && (
                <button
                  type="button"
                  onClick={() => closePopup(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    border: '1px solid var(--border, #cbd5e1)',
                    background: 'var(--bg-card, #ffffff)',
                    color: 'var(--text, #334155)',
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--bg-subtle, #f1f5f9)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--bg-card, #ffffff)';
                  }}
                >
                  {state.cancelText}
                </button>
              )}

              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => closePopup(true)}
                style={{
                  padding: '9px 22px',
                  borderRadius: 10,
                  border: 'none',
                  background: state.danger
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : state.type === 'error'
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : state.type === 'success'
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#ffffff',
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: state.danger || state.type === 'error'
                    ? '0 4px 14px rgba(220, 38, 38, 0.35)'
                    : state.type === 'success'
                    ? '0 4px 14px rgba(16, 185, 129, 0.35)'
                    : '0 4px 14px rgba(37, 99, 235, 0.35)',
                  transition: 'all 0.15s ease',
                  outline: 'none'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.filter = 'brightness(1.06)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.filter = 'brightness(1)';
                }}
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
