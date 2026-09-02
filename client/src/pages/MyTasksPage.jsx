import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTaskModal } from '../hooks/useTaskModal.js';
import { StatusBadge, PriorityBadge } from '../components/common/Badge.jsx';
import { TaskDetailModal } from '../components/tasks/TaskDetailModal.jsx';
import { Calendar, ShieldAlert } from 'lucide-react';

export const MyTasksPage = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { taskId: selectedTaskId, isTaskOpen, openTask, closeTask } = useTaskModal();

  const loadMyTasks = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.getTasks({
        assignee_id: user.id,
        limit: 100,
        sort_by: 'due_date',
        sort_order: 'asc'
      });
      setTasks(res.tasks);
    } catch (err) {
      console.error('Failed to load my tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyTasks();
  }, [user]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Assigned Tasks</h1>
        <p className="text-sm text-slate-500 mt-1">
          Requirement 5: One consolidated list of everything assigned to you across all projects.
        </p>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[54rem] text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-bold uppercase tracking-wider text-xs">
              <th className="py-3.5 px-4">Task</th>
              <th className="py-3.5 px-4">Project</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Priority</th>
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
                  <span className="font-medium text-slate-600">{task.project_name}</span>
                </td>
                <td className="py-3.5 px-4">
                  <StatusBadge status={task.status} />
                </td>
                <td className="py-3.5 px-4">
                  <PriorityBadge priority={task.priority} />
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
                <td colSpan={6} className="py-16 text-center text-slate-400 italic">
                  {loading ? 'Loading your assigned tasks...' : 'No tasks assigned to you right now.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={isTaskOpen}
        onClose={closeTask}
        onTaskUpdated={loadMyTasks}
      />
    </div>
  );
};
