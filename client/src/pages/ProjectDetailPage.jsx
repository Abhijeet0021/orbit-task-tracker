import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTaskModal } from '../hooks/useTaskModal.js';
import { useToast } from '../context/ToastContext.jsx';
import { useConfirm } from '../components/common/ConfirmDialog.jsx';
import { 
  Users, 
  ListTodo, 
  Kanban, 
  Plus, 
  UserPlus, 
  UserMinus, 
  Archive, 
  RotateCcw, 
  ShieldAlert,
  ArrowLeft,
  Calendar
} from 'lucide-react';
import { StatusBadge, PriorityBadge } from '../components/common/Badge.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { TaskDetailModal } from '../components/tasks/TaskDetailModal.jsx';
import { KanbanBoard } from '../components/kanban/KanbanBoard.jsx';

export const ProjectDetailPage = () => {
  const { id } = useParams();
  const projectId = id || '';
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [loading, setLoading] = useState(true);

  const { taskId: selectedTaskId, isTaskOpen, openTask, closeTask } = useTaskModal();
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('MEDIUM');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState([]);
  const [newTaskBlockers, setNewTaskBlockers] = useState([]);
  const [createTaskError, setCreateTaskError] = useState('');

  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editOwnerId, setEditOwnerId] = useState('');
  const [memberToAdd, setMemberToAdd] = useState('');

  const loadData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [projRes, tasksRes, usersRes] = await Promise.all([
        api.getProject(projectId),
        api.getTasks({ project_id: projectId, limit: 100 }),
        api.getUsers()
      ]);
      setProject(projRes.project);
      setTasks(tasksRes.tasks);
      setAllUsers(usersRes.users);

      setEditName(projRes.project.name);
      setEditDesc(projRes.project.description || '');
      setEditOwnerId(projRes.project.owner?.id || '');
    } catch (err) {
      console.error('Failed to load project details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setCreateTaskError('');
    try {
      await api.createTask({
        project_id: projectId,
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim(),
        priority: newTaskPriority,
        due_date: newTaskDueDate || null,
        assignee_ids: newTaskAssignees,
        blocker_ids: newTaskBlockers,
      });
      setIsCreateTaskOpen(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskPriority('MEDIUM');
      setNewTaskDueDate('');
      setNewTaskAssignees([]);
      setNewTaskBlockers([]);
      loadData();
    } catch (err) {
      setCreateTaskError(err.message || 'Failed to create task.');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberToAdd) return;
    try {
      await api.addProjectMember(projectId, memberToAdd);
      setIsAddMemberOpen(false);
      setMemberToAdd('');
      toast.success('Member added to the project');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Could not add the member.');
    }
  };

  const handleRemoveMember = async (userId, userName) => {
    const ok = await confirm({
      title: `Remove ${userName} from this project?`,
      body: `${userName} will also be unassigned from every task in this project. Their past activity stays in the timeline.`,
      confirmLabel: 'Remove from project',
    });
    if (!ok) return;
    try {
      await api.removeProjectMember(projectId, userId);
      toast.success(`${userName} removed from the project`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Could not remove the member.');
    }
  };

  const handleEditProject = async (e) => {
    e.preventDefault();
    try {
      await api.updateProject(projectId, { name: editName, description: editDesc, owner_id: editOwnerId || undefined });
      setIsEditProjectOpen(false);
      toast.success('Project updated');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Could not update the project.');
    }
  };

  const handleArchiveProject = async () => {
    const ok = await confirm({
      title: 'Archive this project?',
      body: 'It will be hidden from the active lists. Its tasks and history are kept, and you can restore it at any time.',
      confirmLabel: 'Archive project',
    });
    if (!ok) return;
    try {
      await api.archiveProject(projectId);
      toast.success('Project archived');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Could not archive the project.');
    }
  };

  const handleRestoreProject = async () => {
    try {
      await api.restoreProject(projectId);
      toast.success('Project restored');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Could not restore the project.');
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-400">Loading project workspace...</div>;
  }

  if (!project) {
    return (
      <div className="p-12 text-center rounded-3xl bg-white border border-slate-200">
        <p className="text-sm font-bold text-rose-600">Project not found or access denied.</p>
        <Link to="/projects" className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline">
          &larr; Back to projects
        </Link>
      </div>
    );
  }

  const existingMemberIds = new Set(project.members?.map(m => m.id) || []);
  const nonMembers = allUsers.filter(u => !existingMemberIds.has(u.id));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-600 transition mb-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Projects</span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-black px-3 py-1 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                {project.key}
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{project.name}</h1>
              {project.is_archived && (
                <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-slate-200 text-slate-700">
                  Archived
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 max-w-3xl leading-relaxed">{project.description || 'No description provided.'}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsCreateTaskOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition shadow-sm shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>

            {user?.role === 'MANAGER' && (
              <>
                <button
                  onClick={() => setIsEditProjectOpen(true)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
                >
                  Edit Details
                </button>
                {project.is_archived ? (
                  <button
                    onClick={handleRestoreProject}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-semibold hover:bg-emerald-100 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restore
                  </button>
                ) : (
                  <button
                    onClick={handleArchiveProject}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm font-semibold hover:bg-rose-100 transition"
                  >
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Team Members:</span>
            <div className="flex flex-wrap items-center gap-2">
              {project.members?.map(m => (
                <div
                  key={m.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-sm group"
                >
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ backgroundColor: m.avatar_color || '#3b82f6' }}
                  >
                    {m.name[0]}
                  </div>
                  <span className="font-semibold text-slate-800">{m.name}</span>
                  {m.id === project.owner_id && (
                    <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-1 rounded">Owner</span>
                  )}
                  {user?.role === 'MANAGER' && m.id !== project.owner_id && (
                    <button
                      onClick={() => handleRemoveMember(m.id, m.name)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition"
                      title="Remove from project (unassigns from tasks)"
                    >
                      <UserMinus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {user?.role === 'MANAGER' && nonMembers.length > 0 && (
            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold transition ${
              viewMode === 'list' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>List View ({tasks.length})</span>
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold transition ${
              viewMode === 'kanban' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Kanban Board</span>
          </button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <KanbanBoard
          tasks={tasks}
          onTaskClick={(taskId) => {
            openTask(taskId);
          }}
          onRefresh={loadData}
        />
      ) : (
        <div className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-bold uppercase tracking-wider text-xs">
                <th className="py-3.5 px-4">Task</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Assignees</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4">Blockers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map(task => (
                <tr
                  key={task.id}
                  onClick={() => {
                    openTask(task.id);
                  }}
                  className="hover:bg-blue-50/40 cursor-pointer transition"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {task.code}
                      </span>
                      <span className="font-bold text-slate-900 hover:text-blue-600 transition">
                        {task.title}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="py-3.5 px-4">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {task.assignees.map(a => (
                        <div
                          key={a.id}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white ring-2 ring-white"
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
                  <td className="py-3.5 px-4">
                    {task.due_date ? (
                      <span className={`flex items-center gap-1 font-medium ${task.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                        <Calendar className="w-3.5 h-3.5" />
                        {task.due_date}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
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
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                    No tasks in this project yet. Click "+ New Task" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={isTaskOpen}
        onClose={closeTask}
        onTaskUpdated={loadData}
      />

      <Modal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        title={`Create Task in ${project.name}`}
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          {createTaskError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">
              {createTaskError}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              placeholder="e.g. Integrate Redis session cache"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden bg-slate-50/50 font-semibold"
            />
          </div>

          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={newTaskDesc}
              onChange={e => setNewTaskDesc(e.target.value)}
              placeholder="Requirements and implementation details..."
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden bg-slate-50/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
                Priority
              </label>
              <select
                value={newTaskPriority}
                onChange={e => setNewTaskPriority(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-50/50 outline-hidden font-semibold"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={newTaskDueDate}
                onChange={e => setNewTaskDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-50/50 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
              Assign Team Members (Project members only)
            </label>
            <div className="flex flex-wrap gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 max-h-32 overflow-y-auto">
              {project.members?.map(m => {
                const isSelected = newTaskAssignees.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setNewTaskAssignees(newTaskAssignees.filter(id => id !== m.id));
                      } else {
                        setNewTaskAssignees([...newTaskAssignees, m.id]);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {tasks.length > 0 && (
            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
                Blocked By (Optional tasks in this project)
              </label>
              <div className="flex flex-wrap gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 max-h-32 overflow-y-auto">
                {tasks.map(t => {
                  const isSelected = newTaskBlockers.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setNewTaskBlockers(newTaskBlockers.filter(id => id !== t.id));
                        } else {
                          setNewTaskBlockers([...newTaskBlockers, t.id]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-mono text-[11px]">{t.code}</span>
                      <span className="truncate max-w-[120px]">{t.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateTaskOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition shadow-sm shadow-blue-500/20"
            >
              Create Task
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        title="Add Team Member to Project"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
              Select User
            </label>
            <select
              value={memberToAdd}
              onChange={e => setMemberToAdd(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-hidden bg-slate-50/50 font-semibold"
            >
              <option value="">Select a user...</option>
              {nonMembers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role}) — {u.email}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAddMemberOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!memberToAdd}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              Add Member
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditProjectOpen}
        onClose={() => setIsEditProjectOpen(false)}
        title="Edit Project Details"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleEditProject} className="space-y-4">
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden bg-slate-50/50 font-semibold"
            />
          </div>

          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
              Owner
            </label>
            <select
              value={editOwnerId}
              onChange={e => setEditOwnerId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm bg-slate-50/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden font-semibold"
            >
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">Changing the owner adds them to the project if they are not already a member.</p>
          </div>

          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden bg-slate-50/50"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditProjectOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
