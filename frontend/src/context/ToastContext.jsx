import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '../components/ui/utils';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const TOAST_DURATION = 4000;

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });

  const show = useCallback((message, type = 'info') => {
    setToast({ message: String(message), type, visible: true });
  }, []);

  const hide = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const toastApi = useMemo(
    () => ({
      success: (msg) => show(msg, 'success'),
      error: (msg) => show(msg, 'error'),
      info: (msg) => show(msg, 'info'),
    }),
    [show]
  );

  useEffect(() => {
    if (!toast.visible) return;
    const t = setTimeout(hide, TOAST_DURATION);
    return () => clearTimeout(t);
  }, [toast.visible, hide]);

  return (
    <ToastContext.Provider value={toastApi}>
      {children}
      {toast.visible && toast.message && (
        <div
          role="alert"
          className={cn(
            'fixed top-4 right-4 z-[100] max-w-sm rounded-lg border px-4 py-3 shadow-lg flex items-start gap-3',
            toast.type === 'success' && 'bg-green-50 border-green-200 text-green-800',
            toast.type === 'error' && 'bg-destructive/10 border-destructive/30 text-destructive',
            toast.type === 'info' && 'bg-slate-50 border-slate-200 text-slate-800'
          )}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />}
          {toast.type === 'error' && <XCircle className="w-5 h-5 shrink-0 text-destructive" />}
          {toast.type === 'info' && <Info className="w-5 h-5 shrink-0 text-slate-600" />}
          <p className="text-sm font-medium flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={hide}
            className="shrink-0 p-1 rounded hover:bg-black/5 text-current"
            aria-label="Đóng"
          >
            <span className="sr-only">Đóng</span>
            <span aria-hidden>×</span>
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
};
