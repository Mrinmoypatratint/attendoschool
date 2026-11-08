import { useState, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type Toast = {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
};

type ToastContextType = {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container fixed bottom-6 right-6 z-[10000] flex flex-col gap-2.5 pointer-events-auto">
        {toasts.map(toast => {
          const typeBorder =
            toast.type === 'success'
              ? 'border-l-4 border-l-emerald-600'
              : toast.type === 'error'
              ? 'border-l-4 border-l-rose-600'
              : toast.type === 'warning'
              ? 'border-l-4 border-l-amber-500'
              : 'border-l-4 border-l-blue-600';

          const iconColor =
            toast.type === 'success'
              ? 'text-emerald-600 dark:text-emerald-400'
              : toast.type === 'error'
              ? 'text-rose-600 dark:text-rose-400'
              : toast.type === 'warning'
              ? 'text-amber-500 dark:text-amber-400'
              : 'text-blue-600 dark:text-blue-400';

          return (
            <div
              key={toast.id}
              className={`toast toast-${toast.type} relative flex items-center gap-3 py-3 px-4.5 rounded-[4px] bg-white dark:bg-[#1c1c1c] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-lg text-[13.5px] font-medium cursor-pointer overflow-hidden transition-all hover:opacity-90 ${typeBorder}`}
              onClick={() => removeToast(toast.id)}
            >
              <span className={`toast-icon flex items-center justify-center font-bold text-sm ${iconColor}`}>
                {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : toast.type === 'warning' ? '⚠' : 'ℹ'}
              </span>
              <span className="toast-message flex-1 leading-snug">{toast.message}</span>
              <div
                className="toast-progress absolute bottom-0 left-0 h-[2px] bg-slate-300 dark:bg-slate-700 opacity-60"
                style={{ animationDuration: `${toast.duration}ms` }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
