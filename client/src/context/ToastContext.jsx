import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message, duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message, duration }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast('success', msg, dur),
    error: (msg, dur) => addToast('error', msg, dur),
    warning: (msg, dur) => addToast('warning', msg, dur),
    info: (msg, dur) => addToast('info', msg, dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Floating Toast Notification Dock */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map(t => {
          const config = {
            success: {
              bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
              icon: CheckCircle2,
              iconColor: 'text-emerald-600',
              barColor: 'bg-emerald-500'
            },
            error: {
              bg: 'bg-rose-50 border-rose-200 text-rose-900',
              icon: XCircle,
              iconColor: 'text-rose-600',
              barColor: 'bg-rose-500'
            },
            warning: {
              bg: 'bg-amber-50 border-amber-200 text-amber-900',
              icon: AlertTriangle,
              iconColor: 'text-amber-600',
              barColor: 'bg-amber-500'
            },
            info: {
              bg: 'bg-blue-50 border-blue-200 text-blue-900',
              icon: Info,
              iconColor: 'text-blue-600',
              barColor: 'bg-blue-500'
            }
          }[t.type] || {
            bg: 'bg-slate-50 border-slate-200 text-slate-900',
            icon: Info,
            iconColor: 'text-slate-600',
            barColor: 'bg-slate-500'
          };

          const IconComponent = config.icon;

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-lg backdrop-blur-md transition-all duration-200 animate-in slide-in-from-top-3 fade-in ${config.bg}`}
            >
              <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-relaxed">{t.message}</p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 transition shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
