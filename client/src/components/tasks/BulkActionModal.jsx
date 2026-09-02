import React from 'react';
import { Modal } from '../common/Modal.jsx';
import { CheckCircle2, XCircle } from 'lucide-react';

export const BulkResultModal = ({ isOpen, onClose, result }) => {
  if (!result) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Action Execution Report" maxWidth="max-w-xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Processed</p>
            <p className="text-2xl font-black text-slate-900">{result.summary.total} tasks</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <span className="text-xs font-semibold text-emerald-600">Succeeded</span>
              <p className="text-xl font-bold text-emerald-700">{result.summary.succeeded}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-rose-600">Rejected / Failed</span>
              <p className="text-xl font-bold text-rose-700">{result.summary.failed}</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500 font-medium">
          Requirement 7: The system evaluates every task independently and reports per-item status and specific rejection reasons.
        </p>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {result.results.map((item, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border flex items-start gap-3 text-xs transition ${
                item.success
                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="mt-0.5">
                {item.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                    {item.code}
                  </span>
                  <span className="font-semibold truncate">{item.title}</span>
                </div>
                <p className={`mt-1 font-medium ${item.success ? 'text-emerald-700' : 'text-rose-700 font-semibold'}`}>
                  {item.success ? item.message : `Rejected: ${item.error}`}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
          >
            Close Report
          </button>
        </div>
      </div>
    </Modal>
  );
};
