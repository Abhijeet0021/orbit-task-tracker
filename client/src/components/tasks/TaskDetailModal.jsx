import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../common/ConfirmDialog.jsx';
import { Modal } from '../common/Modal.jsx';
import { StatusBadge, PriorityBadge } from '../common/Badge.jsx';
import { TaskTimeline } from './TaskTimeline.jsx';
import { 
  Calendar, 
  Trash2, 
  ShieldAlert, 
  X, 
  AlertCircle, 
  Clock,
  Check,
  ArrowRight,
  Copy,
  CheckCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles
} from 'lucide-react';

const LIFECYCLE_STEPS = [
  { id: 'BACKLOG', label: 'Backlog', num: 1 },
  { id: 'IN_PROGRESS', label: 'In Progress', num: 2 },
  { id: 'IN_REVIEW', label: 'In Review', num: 3 },
  { id: 'DONE', label: 'Done', num: 4 },
];

export const TaskDetailModal = ({ taskId, isOpen, onClose, onTaskUpdated }) => {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [task, setTask] = useState(null);
  const [legalTransitions, setLegalTransitions] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [selectedBlockerId, setSelectedBlockerId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const loadTask = async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.getTask(taskId);
      setTask(res.task);
      setLegalTransitions(res.legalTransitions);
      setTimeline(res.timeline);

      setTitle(res.task.title);
      setDescription(res.task.description || '');
      setPriority(res.task.priority);
      setDueDate(res.task.due_date || '');

      const projRes = await api.getProject(res.task.project_id);
      setProjectMembers(projRes.project.members || []);

      const tasksRes = await api.getTasks({ project_id: res.task.project_id, limit: 100 });
      setProjectTasks(tasksRes.tasks.filter(t => t.id !== res.task.id));
    } catch (err) {
      setError(err.message || 'Failed to load task.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      loadTask();
    }
  }, [isOpen, taskId]);

  const handleCopyCode = () => {
    if (!task) return;
    navigator.clipboard.writeText(task.code);
    setCopied(true);
    toast.info(`Copied ${task.code} to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateField = async () => {
    if (!task) return;
    setSaving(true);
    setError('');
    try {
      await api.updateTask(task.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        due_date: dueDate || null,
      });
      await loadTask();
      toast.success('Task details saved');
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      setError(err.message || 'Failed to update task.');
      toast.error(err.message || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleTransitionStatus = async (targetStatus) => {
    if (!task) return;
    setSaving(true);
    setError('');
    try {
      await api.updateTask(task.id, { status: targetStatus });
      await loadTask();
      toast.success(`Task moved to ${targetStatus.replace('_', ' ')}`);
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      setError(err.message || 'Transition rejected.');
      toast.error(err.message || 'Transition rejected by server rules');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAssignee = async (userId) => {
    if (!task) return;
    try {
      await api.addTaskAssignee(task.id, userId);
      setSelectedMemberId('');
      await loadTask();
      toast.success('Assignee added');
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      setError(err.message || 'Failed to add assignee.');
      toast.error(err.message || 'Failed to add assignee');
    }
  };

  const handleRemoveAssignee = async (userId) => {
    if (!task) return;
    try {
      await api.removeTaskAssignee(task.id, userId);
      await loadTask();
      toast.info('Assignee removed');
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      setError(err.message || 'Failed to remove assignee.');
      toast.error(err.message || 'Failed to remove assignee');
    }
  };

  const handleAddBlocker = async () => {
    if (!task || !selectedBlockerId) return;
    const bId = selectedBlockerId;
    try {
      await api.addTaskBlocker(task.id, bId);
      setSelectedBlockerId('');
      await loadTask();
      toast.warning('Blocking dependency registered');
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      setError(err.message || 'Failed to add blocker.');
      toast.error(err.message || 'Failed to add blocker');
    }
  };

  const handleRemoveBlocker = async (blockerId) => {
    if (!task) return;
    try {
      await api.removeTaskBlocker(task.id, blockerId);
      await loadTask();
      toast.success('Blocker resolved and removed');
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      setError(err.message || 'Failed to remove blocker.');
      toast.error(err.message || 'Failed to remove blocker');
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    const ok = await confirm({
      title: `Delete ${task.code}?`,
      body: `"${task.title}" will be removed permanently, along with its place in any blocking chains. This cannot be undone.`,
      confirmLabel: 'Delete task',
    });
    if (!ok) return;
    try {
      await api.deleteTask(task.id);
      toast.success(`Task ${task.code} deleted`);
      onClose();
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      setError(err.message || 'Failed to delete task.');
      toast.error(err.message || 'Failed to delete task');
    }
  };

  if (!isOpen) return null;

  // Determine active step index for linear stepper
  const currentStepIndex = LIFECYCLE_STEPS.findIndex(s => s.id === task?.status);
  const isBlocked = task?.status === 'BLOCKED';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task ? `${task.code} — ${task.title}` : 'Task Details'} maxWidth="max-w-4xl">
      {loading ? (
        <div className="py-16 space-y-4">
          <div className="h-6 bg-slate-100 rounded-lg animate-pulse w-1/3"></div>
          <div className="h-24 bg-slate-100 rounded-2xl animate-pulse"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 h-48 bg-slate-100 rounded-2xl animate-pulse"></div>
            <div className="h-48 bg-slate-100 rounded-2xl animate-pulse"></div>
          </div>
        </div>
      ) : task ? (
        <div className="space-y-6">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Interactive Visual Stepper Bar */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-50 via-blue-50/30 to-indigo-50/40 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-900 shadow-xs flex items-center gap-1.5">
                  {task.code}
                  <button 
                    onClick={handleCopyCode}
                    className="text-slate-400 hover:text-blue-600 transition"
                    title="Copy task code"
                  >
                    {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </span>
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                {task.is_overdue && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Overdue
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {legalTransitions.map(t => (
                  <div key={t.status} className="relative group">
                    <button
                      onClick={() => handleTransitionStatus(t.status)}
                      disabled={saving || !t.allowed}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        t.allowed
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs active:scale-95'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      }`}
                      title={t.blockReason || t.description}
                    >
                      <span>{t.label}</span>
                    </button>
                    {!t.allowed && t.blockReason && (
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 p-2.5 rounded-xl bg-slate-900 text-white text-[11px] font-medium shadow-xl">
                        ⚠️ {t.blockReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Stepper Pipeline */}
            <div className="pt-2">
              <div className="relative flex items-center justify-between">
                {/* Connecting Line */}
                <div className="absolute left-6 right-6 top-4 h-0.5 bg-slate-200 -z-0">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ 
                      width: isBlocked 
                        ? '50%' 
                        : currentStepIndex >= 0 
                          ? `${(currentStepIndex / (LIFECYCLE_STEPS.length - 1)) * 100}%` 
                          : '0%' 
                    }}
                  />
                </div>

                {LIFECYCLE_STEPS.map((step, idx) => {
                  const isCurrent = task.status === step.id;
                  const isPast = currentStepIndex > idx && !isBlocked;
                  const isLegalTarget = legalTransitions.some(t => t.status === step.id && t.allowed);

                  return (
                    <button
                      key={step.id}
                      onClick={() => {
                        if (isLegalTarget) handleTransitionStatus(step.id);
                      }}
                      disabled={!isLegalTarget}
                      className={`relative z-10 flex flex-col items-center group transition text-center ${
                        isLegalTarget ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all shadow-xs ${
                          isCurrent
                            ? 'bg-blue-600 text-white ring-4 ring-blue-100 scale-110'
                            : isPast
                              ? 'bg-emerald-500 text-white'
                              : isLegalTarget
                                ? 'bg-white border-2 border-blue-400 text-blue-700 hover:bg-blue-50'
                                : 'bg-white border-2 border-slate-300 text-slate-400'
                        }`}
                      >
                        {isPast ? <Check className="w-4 h-4" /> : step.num}
                      </div>
                      <span className={`text-[11px] mt-1.5 font-bold tracking-tight ${
                        isCurrent ? 'text-blue-700' : isPast ? 'text-emerald-700' : 'text-slate-400'
                      }`}>
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Blocked State Notice */}
              {isBlocked && (
                <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Task is currently <strong className="font-bold">BLOCKED</strong>. Unblocking will restore previous status (<code className="font-mono">{task.previous_status || 'IN_PROGRESS'}</code>).
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={handleUpdateField}
                  className="w-full text-base font-bold text-slate-900 rounded-xl border border-slate-200 px-3.5 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden bg-white shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  onBlur={handleUpdateField}
                  placeholder="Task details and acceptance criteria..."
                  className="w-full text-xs text-slate-800 rounded-xl border border-slate-200 p-3.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden bg-white shadow-2xs leading-relaxed"
                />
              </div>

              {/* Blocking Dependencies */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-purple-600" />
                    Blocking Dependencies ({task.blockers.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Must be DONE before this task completes
                  </span>
                </div>

                {task.blockers.length > 0 ? (
                  <div className="space-y-2">
                    {task.blockers.map(b => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                            {b.blocker_code}
                          </span>
                          <span className="font-semibold text-slate-800 line-clamp-1">
                            {b.blocker_title}
                          </span>
                          <StatusBadge status={b.blocker_status} />
                        </div>
                        <button
                          onClick={() => handleRemoveBlocker(b.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Remove blocker"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-1">
                    No blocking tasks. Clear path to completion.
                  </p>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <select
                    value={selectedBlockerId}
                    onChange={e => setSelectedBlockerId(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 bg-slate-50 outline-hidden"
                  >
                    <option value="">Add blocking task from {task.project_key}...</option>
                    {projectTasks.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.code} - {t.title} ({t.status})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddBlocker}
                    disabled={!selectedBlockerId}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 disabled:opacity-40 transition shadow-xs"
                  >
                    Add Blocker
                  </button>
                </div>
              </div>

              {/* Append-Only Timeline & Comments */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                <TaskTimeline
                  taskId={task.id}
                  timeline={timeline}
                  onRefresh={loadTask}
                />
              </div>
            </div>

            {/* Sidebar Meta Info */}
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Project
                  </label>
                  <p className="text-xs font-bold text-slate-800">
                    {task.project_name} ({task.project_key})
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={e => {
                      setPriority(e.target.value);
                      setTimeout(handleUpdateField, 100);
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-50 outline-hidden"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => {
                      setDueDate(e.target.value);
                      setTimeout(handleUpdateField, 100);
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-800 bg-slate-50 outline-hidden font-mono"
                  />
                </div>

                {/* Assignees */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Assigned Team Members ({task.assignees.length})
                  </label>

                  <div className="space-y-1.5">
                    {task.assignees.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-1.5 rounded-xl border border-slate-100 bg-slate-50 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-2xs"
                            style={{ backgroundColor: a.avatar_color || '#3b82f6' }}
                          >
                            {a.name[0]}
                          </div>
                          <span className="font-semibold text-slate-800">{a.name}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveAssignee(a.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                          title="Unassign"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {task.assignees.length === 0 && (
                      <p className="text-xs text-slate-400 italic">No members assigned.</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <select
                      value={selectedMemberId}
                      onChange={e => setSelectedMemberId(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 px-2 py-1.5 text-xs text-slate-700 bg-slate-50 outline-hidden"
                    >
                      <option value="">Assign member...</option>
                      {projectMembers
                        .filter(m => !task.assignees.some(a => a.id === m.id))
                        .map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                    <button
                      onClick={() => handleAddAssignee(selectedMemberId)}
                      disabled={!selectedMemberId}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-40 transition shadow-2xs"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Manager Only Actions */}
                {user?.role === 'MANAGER' && (
                  <div className="pt-4 border-t border-slate-100">
                    <button
                      onClick={handleDeleteTask}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 hover:border-rose-300 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete Task (Manager Only)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
