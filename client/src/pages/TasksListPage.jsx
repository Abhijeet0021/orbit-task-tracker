import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { StatusBadge, PriorityBadge } from '../components/common/Badge.jsx';
import { TaskDetailModal } from '../components/tasks/TaskDetailModal.jsx';
import { BulkResultModal } from '../components/tasks/BulkActionModal.jsx';
import { 
  Search, 
  Download, 
  Calendar, 
  ShieldAlert, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  Sparkles,
  CheckCheck,
  Copy,
  RotateCcw
} from 'lucide-react';

export const TasksListPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [copiedId, setCopiedId] = useState(null);

  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkStatus, setBulkStatus] = useState('IN_PROGRESS');
  const [bulkUserId, setBulkUserId] = useState('');
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [bulkPriority, setBulkPriority] = useState('HIGH');
  const [bulkResult, setBulkResult] = useState(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isExecutingBulk, setIsExecutingBulk] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activePreset, setActivePreset] = useState('ALL');

  const loadFilterData = async () => {
    try {
      const [projRes, usersRes] = await Promise.all([
        api.getProjects(true),
        api.getUsers()
      ]);
      setProjects(projRes.projects || []);
      setUsers(usersRes.users || []);
    } catch (err) {
      console.error('Failed to load filter metadata', err);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const res = await api.getTasks({
        q: search || undefined,
        project_id: selectedProjectId || undefined,
        status: selectedStatus || undefined,
        priority: selectedPriority || undefined,
        assignee_id: selectedAssigneeId || undefined,
        overdue: isOverdueOnly || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        limit: 15
      });
      setTasks(res.tasks || []);
      setPagination(res.pagination || { total: 0, page: 1, limit: 15, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load tasks', err);
      toast.error('Failed to retrieve task data from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilterData();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [search, selectedProjectId, selectedStatus, selectedPriority, selectedAssigneeId, isOverdueOnly, sortBy, sortOrder, page]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedTaskIds(tasks.map(t => t.id));
    } else {
      setSelectedTaskIds([]);
    }
  };

  const handleToggleSelect = (taskId) => {
    if (selectedTaskIds.includes(taskId)) {
      setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
    } else {
      setSelectedTaskIds([...selectedTaskIds, taskId]);
    }
  };

  const handleCopyCode = (e, code, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.info(`Copied ${code}`);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExecuteBulk = async () => {
    if (selectedTaskIds.length === 0 || !bulkAction) return;
    setIsExecutingBulk(true);
    try {
      let payload = {};
      if (bulkAction === 'UPDATE_STATUS') payload = { status: bulkStatus };
      if (bulkAction === 'ASSIGN_USER') payload = { userId: bulkUserId };
      if (bulkAction === 'SET_DUE_DATE') payload = { due_date: bulkDueDate || null };
      if (bulkAction === 'SET_PRIORITY') payload = { priority: bulkPriority };

      const result = await api.executeBulk({
        task_ids: selectedTaskIds,
        action: bulkAction,
        payload
      });

      setBulkResult(result);
      setIsBulkModalOpen(true);
      setSelectedTaskIds([]);
      setBulkAction('');
      toast.success(`Batch processed: ${result.summary.success} succeeded, ${result.summary.failed} failed`);
      loadTasks();
    } catch (err) {
      toast.error(err.message || 'Bulk operation failed.');
    } finally {
      setIsExecutingBulk(false);
    }
  };

  const handleExportCsv = async () => {
    toast.info('Preparing CSV export...');
    try {
      await api.downloadTasksCsv({
        q: search || undefined,
        project_id: selectedProjectId || undefined,
        status: selectedStatus || undefined,
        priority: selectedPriority || undefined,
        assignee_id: selectedAssigneeId || undefined,
        overdue: isOverdueOnly || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
    } catch (err) {
      toast.error(err.message || 'Could not export the current view.');
    }
  };

  const applyPreset = (presetKey) => {
    setActivePreset(presetKey);
    setPage(1);
    setSearch('');
    setSelectedProjectId('');

    switch (presetKey) {
      case 'MY_ACTIVE':
        setSelectedAssigneeId(user?.id ? String(user.id) : '');
        setSelectedStatus('IN_PROGRESS');
        setSelectedPriority('');
        setIsOverdueOnly(false);
        break;
      case 'CRITICAL_OVERDUE':
        setSelectedAssigneeId('');
        setSelectedStatus('');
        setSelectedPriority('URGENT');
        setIsOverdueOnly(true);
        break;
      case 'BLOCKED':
        setSelectedAssigneeId('');
        setSelectedStatus('BLOCKED');
        setSelectedPriority('');
        setIsOverdueOnly(false);
        break;
      case 'IN_REVIEW':
        setSelectedAssigneeId('');
        setSelectedStatus('IN_REVIEW');
        setSelectedPriority('');
        setIsOverdueOnly(false);
        break;
      case 'BACKLOG':
        setSelectedAssigneeId('');
        setSelectedStatus('BACKLOG');
        setSelectedPriority('');
        setIsOverdueOnly(false);
        break;
      case 'ALL':
      default:
        setSelectedAssigneeId('');
        setSelectedStatus('');
        setSelectedPriority('');
        setIsOverdueOnly(false);
        break;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cross-Project Task Tracker</h1>
          <p className="text-xs text-slate-500 mt-1">
            Server-side search, filtering, multi-sort, pagination, and atomic bulk operations.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition shadow-xs"
          title="Export current filtered view to CSV"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export Filtered CSV</span>
        </button>
      </div>

      {/* Smart Filter Presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          Quick Views:
        </span>
        {[
          { key: 'ALL', label: 'All Tasks' },
          { key: 'MY_ACTIVE', label: '⚡️ My Active Work' },
          { key: 'CRITICAL_OVERDUE', label: '🚨 Critical & Overdue' },
          { key: 'BLOCKED', label: '🚫 Blocked Bottlenecks' },
          { key: 'IN_REVIEW', label: '⏳ In Review' },
          { key: 'BACKLOG', label: '📋 Sprint Backlog' },
        ].map(p => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition shadow-2xs ${
              activePreset === p.key
                ? 'bg-blue-600 text-white shadow-xs scale-102'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search title, description, or code..."
              className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <select
              value={selectedProjectId}
              onChange={e => {
                setSelectedProjectId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-hidden font-medium"
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.key} - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={e => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-hidden font-medium"
            >
              <option value="">All Statuses</option>
              <option value="BACKLOG">Backlog</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="BLOCKED">Blocked</option>
              <option value="DONE">Done</option>
            </select>
          </div>

          <div>
            <select
              value={selectedAssigneeId}
              onChange={e => {
                setSelectedAssigneeId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-hidden font-medium"
            >
              <option value="">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedPriority}
              onChange={e => {
                setSelectedPriority(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-hidden font-medium"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={isOverdueOnly}
              onChange={e => {
                setIsOverdueOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <span className="text-rose-600 flex items-center gap-1 font-bold">
              <Clock className="w-3.5 h-3.5" /> Show Overdue Only
            </span>
          </label>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs outline-hidden"
            >
              <option value="updated_at">Last Updated</option>
              <option value="due_date">Due Date</option>
              <option value="priority">Priority</option>
              <option value="created_at">Created Date</option>
              <option value="title">Title</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition"
              title="Toggle Asc/Desc"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedTaskIds.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xl flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-black">
              {selectedTaskIds.length}
            </span>
            <span className="text-xs font-bold">tasks selected for batch operation</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkAction}
              onChange={e => setBulkAction(e.target.value)}
              className="rounded-xl bg-slate-800 border border-slate-700 text-white px-3 py-1.5 text-xs outline-hidden font-semibold"
            >
              <option value="">Select Action...</option>
              <option value="UPDATE_STATUS">Move Status</option>
              <option value="ASSIGN_USER">Assign Team Member</option>
              <option value="SET_DUE_DATE">Set Due Date</option>
              <option value="SET_PRIORITY">Set Priority</option>
            </select>

            {bulkAction === 'UPDATE_STATUS' && (
              <select
                value={bulkStatus}
                onChange={e => setBulkStatus(e.target.value)}
                className="rounded-xl bg-slate-800 border border-slate-700 text-white px-3 py-1.5 text-xs outline-hidden"
              >
                <option value="BACKLOG">Backlog</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="BLOCKED">Blocked</option>
                <option value="DONE">Done</option>
              </select>
            )}

            {bulkAction === 'ASSIGN_USER' && (
              <select
                value={bulkUserId}
                onChange={e => setBulkUserId(e.target.value)}
                className="rounded-xl bg-slate-800 border border-slate-700 text-white px-3 py-1.5 text-xs outline-hidden"
              >
                <option value="">Choose User...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            )}

            {bulkAction === 'SET_DUE_DATE' && (
              <input
                type="date"
                value={bulkDueDate}
                onChange={e => setBulkDueDate(e.target.value)}
                className="rounded-xl bg-slate-800 border border-slate-700 text-white px-3 py-1.5 text-xs outline-hidden"
              />
            )}

            {bulkAction === 'SET_PRIORITY' && (
              <select
                value={bulkPriority}
                onChange={e => setBulkPriority(e.target.value)}
                className="rounded-xl bg-slate-800 border border-slate-700 text-white px-3 py-1.5 text-xs outline-hidden"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            )}

            <button
              onClick={handleExecuteBulk}
              disabled={isExecutingBulk || !bulkAction}
              className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 disabled:opacity-40 transition shadow-xs"
            >
              {isExecutingBulk ? 'Applying...' : 'Apply to Selected'}
            </button>

            <button
              onClick={() => setSelectedTaskIds([])}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Task Table */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3.5 px-4 w-10">
                <input
                  type="checkbox"
                  checked={tasks.length > 0 && selectedTaskIds.length === tasks.length}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="py-3.5 px-4">Task</th>
              <th className="py-3.5 px-4">Project</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Priority</th>
              <th className="py-3.5 px-4">Assignees</th>
              <th className="py-3.5 px-4">Due Date</th>
              <th className="py-3.5 px-4">Blockers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-4 px-4"><div className="w-4 h-4 bg-slate-200 rounded"></div></td>
                  <td className="py-4 px-4"><div className="w-48 h-4 bg-slate-200 rounded"></div></td>
                  <td className="py-4 px-4"><div className="w-24 h-4 bg-slate-200 rounded"></div></td>
                  <td className="py-4 px-4"><div className="w-20 h-4 bg-slate-200 rounded"></div></td>
                  <td className="py-4 px-4"><div className="w-16 h-4 bg-slate-200 rounded"></div></td>
                  <td className="py-4 px-4"><div className="w-12 h-4 bg-slate-200 rounded"></div></td>
                  <td className="py-4 px-4"><div className="w-20 h-4 bg-slate-200 rounded"></div></td>
                  <td className="py-4 px-4"><div className="w-10 h-4 bg-slate-200 rounded"></div></td>
                </tr>
              ))
            ) : tasks.map(task => {
              const isSelected = selectedTaskIds.includes(task.id);
              const isCopied = copiedId === task.id;

              return (
                <tr
                  key={task.id}
                  className={`hover:bg-blue-50/40 transition cursor-pointer ${
                    isSelected ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <td className="py-3.5 px-4" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(task.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td
                    className="py-3.5 px-4"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setIsTaskModalOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span 
                        onClick={(e) => handleCopyCode(e, task.code, task.id)}
                        className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 hover:bg-blue-100 hover:text-blue-800 transition flex items-center gap-1"
                        title="Click to copy code"
                      >
                        {task.code}
                        {isCopied ? <CheckCheck className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400 opacity-60" />}
                      </span>
                      <span className="font-bold text-slate-900 hover:text-blue-600 transition line-clamp-1">
                        {task.title}
                      </span>
                    </div>
                  </td>
                  <td
                    className="py-3.5 px-4"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setIsTaskModalOpen(true);
                    }}
                  >
                    <span className="font-medium text-slate-600">{task.project_name}</span>
                  </td>
                  <td
                    className="py-3.5 px-4"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setIsTaskModalOpen(true);
                    }}
                  >
                    <StatusBadge status={task.status} />
                  </td>
                  <td
                    className="py-3.5 px-4"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setIsTaskModalOpen(true);
                    }}
                  >
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td
                    className="py-3.5 px-4"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setIsTaskModalOpen(true);
                    }}
                  >
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {task.assignees.map(a => (
                        <div
                          key={a.id}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-white"
                          style={{ backgroundColor: a.avatar_color || '#3b82f6' }}
                          title={a.name}
                        >
                          {a.name[0]}
                        </div>
                      ))}
                      {task.assignees.length === 0 && (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </div>
                  </td>
                  <td
                    className="py-3.5 px-4"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setIsTaskModalOpen(true);
                    }}
                  >
                    {task.due_date ? (
                      <span className={`flex items-center gap-1 font-medium ${task.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                        <Calendar className="w-3.5 h-3.5" />
                        {task.due_date}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td
                    className="py-3.5 px-4"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setIsTaskModalOpen(true);
                    }}
                  >
                    {task.blockers.length > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                        <ShieldAlert className="w-3 h-3" />
                        {task.blockers.length}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {!loading && tasks.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center text-slate-400 italic">
                  No tasks matching the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 text-xs">
          <span className="text-slate-500 font-medium">
            Showing matching <span className="font-bold text-slate-900">{tasks.length}</span> of{' '}
            <span className="font-bold text-slate-900">{pagination.total}</span> total tasks
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-bold text-slate-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTaskId(null);
        }}
        onTaskUpdated={loadTasks}
      />

      <BulkResultModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        result={bulkResult}
      />
    </div>
  );
};
