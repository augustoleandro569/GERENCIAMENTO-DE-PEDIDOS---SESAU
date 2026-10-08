import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

export function showToast(type: 'success' | 'error' | 'info', title: string, message?: string) {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, title, message } }));
}

export const ToastContainer: React.FC<{
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let bg = 'bg-slate-900 text-white border-slate-700';
        let icon = <Info className="w-4 h-4 text-blue-400" />;

        if (toast.type === 'success') {
          bg = 'bg-emerald-950 text-emerald-100 border-emerald-800';
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
        } else if (toast.type === 'error') {
          bg = 'bg-rose-950 text-rose-100 border-rose-800';
          icon = <AlertCircle className="w-4 h-4 text-rose-400" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3 rounded-xl border shadow-xl flex items-start justify-between gap-3 text-xs animate-in slide-in-from-bottom-3 duration-200 ${bg}`}
          >
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 mt-0.5">{icon}</span>
              <div>
                <div className="font-bold">{toast.title}</div>
                {toast.message && (
                  <div className="text-[11px] opacity-80 mt-0.5 leading-snug">{toast.message}</div>
                )}
              </div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
