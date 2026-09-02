import React, { useState } from 'react';
import { useAlerts } from '../context/AlertContext.jsx';
import { TaskDetailModal } from '../components/tasks/TaskDetailModal.jsx';
import { StatusBadge, PriorityBadge } from '../components/common/Badge.jsx';
import { AlertTriangle, CheckCircle2, Calendar, EyeOff, Info } from 'lucide-react';

export const AlertsPage = () => {
  const { alerts, alertCount, loading, dismissAlert, refreshAlerts } = useAlerts();
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [dismissingId, setDismissingId] = useState(null);

  const handleDismiss = async (taskId, e) => {
    e.stopPropagation();
    setDismissingId(taskId);
    try {
      await dismissAlert(taskId);
    } catch (err) {
      alert(err.message || 'Failed to dismiss alert.');
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
            Overdue Work Alerts
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Requirement 10: Tasks past due date assigned to you. Dismissing hides the alert until the due date changes.
          </p>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
          {alertCount} Active Alert{alertCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="font-bold">Overdue Alert Resurfacing Rule:</span> When you dismiss an alert for a task assigned to you, it disappears from this view and from the navigation notification badge. If someone later updates that task's due date to a new date, the alert automatically resurfaces!
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Checking overdue alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 shadow-xs">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">All caught up!</h3>
          <p className="text-xs text-slate-400 mt-1">No overdue tasks assigned to you right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div
              key={alert.task_id}
              onClick={() => {
                setSelectedTaskId(alert.task_id);
                setIsTaskModalOpen(true);
              }}
              className="p-5 rounded-2xl bg-white border border-rose-200 shadow-xs hover:shadow-md hover:border-rose-300 transition cursor-pointer flex flex-wrap items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    {alert.task_code}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {alert.project_name}
                  </span>
                  <PriorityBadge priority={alert.priority} />
                  <StatusBadge status={alert.status} />
                </div>

                <h3 className="text-sm font-bold text-slate-900">
                  {alert.task_title}
                </h3>

                <div className="flex items-center gap-3 text-xs text-rose-600 font-semibold">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Due: {alert.due_date}
                  </span>
                  <span>•</span>
                  <span>{alert.days_overdue} day{alert.days_overdue !== 1 ? 's' : ''} overdue</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={e => handleDismiss(alert.task_id, e)}
                  disabled={dismissingId === alert.task_id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-100 hover:text-slate-900 transition"
                  title="Dismiss alert until due date changes"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Dismiss Alert</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTaskId(null);
        }}
        onTaskUpdated={refreshAlerts}
      />
    </div>
  );
};
