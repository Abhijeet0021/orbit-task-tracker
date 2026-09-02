import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal.jsx';

const ConfirmContext = createContext(null);

const TONES = {
  danger: {
    icon: 'text-rose-600',
    iconBg: 'bg-rose-50 border-rose-100',
    action: 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20',
  },
  primary: {
    icon: 'text-blue-600',
    iconBg: 'bg-blue-50 border-blue-100',
    action: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',
  },
};

/**
 * Replaces window.confirm, which blocks the page, cannot be styled, and looks
 * like a browser warning rather than part of the product.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Archive project?', body: '…' }))) return;
 */
export const ConfirmProvider = ({ children }) => {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRequest({
        title: 'Are you sure?',
        body: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        tone: 'danger',
        ...options,
      });
    });
  }, []);

  const settle = useCallback((answer) => {
    setRequest(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (resolve) resolve(answer);
  }, []);

  const tone = TONES[request?.tone] || TONES.danger;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <Modal
        isOpen={Boolean(request)}
        onClose={() => settle(false)}
        title={request?.title || ''}
        maxWidth="max-w-md"
      >
        <div className="space-y-5">
          <div className="flex gap-3.5">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tone.iconBg}`}>
              <AlertTriangle className={`h-4.5 w-4.5 ${tone.icon}`} />
            </div>
            <p className="text-sm leading-relaxed text-slate-600 pt-1.5">
              {request?.body}
            </p>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => settle(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {request?.cancelLabel}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => settle(true)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-95 ${tone.action}`}
            >
              {request?.confirmLabel}
            </button>
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};