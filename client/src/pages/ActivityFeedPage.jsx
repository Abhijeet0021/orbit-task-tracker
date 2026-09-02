import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useTaskModal } from '../hooks/useTaskModal.js';
import { 
  Activity, 
  Filter, 
  MessageSquare, 
  UserPlus, 
  UserMinus, 
  ArrowRight, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  PlusCircle,
  FileEdit,
  FolderKanban
} from 'lucide-react';
import { StatusBadge } from '../components/common/Badge.jsx';
import { TaskDetailModal } from '../components/tasks/TaskDetailModal.jsx';

export const ActivityFeedPage = () => {
  const [activities, setActivities] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedType, setSelectedType] = useState('');

  const { taskId: selectedTaskId, isTaskOpen, openTask, closeTask } = useTaskModal();

  const loadFilters = async () => {
    try {
      const [projRes, usersRes] = await Promise.all([
        api.getProjects(true),
        api.getUsers()
      ]);
      setProjects(projRes.projects || []);
      setUsers(usersRes.users || []);
    } catch (err) {
      console.error('Failed to load filter options', err);
    }
  };

  const loadFeed = async () => {
    try {
      setLoading(true);
      const res = await api.getActivityFeed({
        project_id: selectedProjectId || undefined,
        user_id: selectedUserId || undefined,
        activity_type: selectedType || undefined,
        limit: 50
      });
      setActivities(res.activities || []);
    } catch (err) {
      console.error('Failed to load activity feed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadFeed();
  }, [selectedProjectId, selectedUserId, selectedType]);

  const renderIcon = (type) => {
    switch (type) {
      case 'CREATED':
        return <PlusCircle className="w-4 h-4 text-blue-500" />;
      case 'STATUS_CHANGED':
        return <ArrowRight className="w-4 h-4 text-emerald-500" />;
      case 'ASSIGNED':
        return <UserPlus className="w-4 h-4 text-indigo-500" />;
      case 'UNASSIGNED':
        return <UserMinus className="w-4 h-4 text-rose-400" />;
      case 'COMMENT_ADDED':
        return <MessageSquare className="w-4 h-4 text-amber-500" />;
      case 'BLOCKER_ADDED':
        return <ShieldAlert className="w-4 h-4 text-purple-500" />;
      case 'BLOCKER_REMOVED':
        return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
      default:
        return <FileEdit className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-blue-600" />
            Global Cross-Project Activity Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Append-only, immutable audit trail of all organizational changes, assignments, blockers, and comments.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-400 mr-2 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        <select
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 outline-hidden"
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.key} - {p.name}</option>
          ))}
        </select>

        <select
          value={selectedUserId}
          onChange={e => setSelectedUserId(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 outline-hidden"
        >
          <option value="">All Team Members</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 outline-hidden"
        >
          <option value="">All Event Types</option>
          <option value="STATUS_CHANGED">Status Changes</option>
          <option value="COMMENT_ADDED">Comments</option>
          <option value="ASSIGNED">Assignments</option>
          <option value="BLOCKER_ADDED">Blockers Added</option>
          <option value="CREATED">Created Tasks</option>
          <option value="FIELD_UPDATED">Field Updates</option>
        </select>

        {(selectedProjectId || selectedUserId || selectedType) && (
          <button
            onClick={() => {
              setSelectedProjectId('');
              setSelectedUserId('');
              setSelectedType('');
            }}
            className="px-3 py-1.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Activity Timeline Stream */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
        {loading && (
          <div className="py-20 text-center text-slate-400 text-sm font-medium">
            Loading activity stream...
          </div>
        )}

        {!loading && activities.length === 0 && (
          <div className="py-20 text-center text-slate-400 text-sm italic">
            No activity records found matching the filter criteria.
          </div>
        )}

        {!loading && activities.length > 0 && (
          <div className="relative border-l-2 border-slate-100 ml-4 space-y-6">
            {activities.map(item => (
              <div key={item.id} className="relative pl-6 group">
                {/* Timeline Node */}
                <div className="absolute -left-3 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white border-2 border-slate-200 shadow-2xs group-hover:scale-110 transition-transform">
                  {renderIcon(item.activity_type)}
                </div>

                <div 
                  onClick={() => {
                    openTask(item.task_id);
                  }}
                  className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-blue-50/40 hover:border-blue-300 transition cursor-pointer"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                        style={{ backgroundColor: item.avatar_color || '#3b82f6' }}
                      >
                        {item.user_name ? item.user_name[0] : 'S'}
                      </div>
                      <span className="text-sm font-bold text-slate-900">
                        {item.user_name || 'System / Initializer'}
                      </span>
                      <span className="text-xs text-slate-400">
                        in <span className="font-semibold text-slate-700">{item.project_name}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{item.created_at}</span>
                    </div>
                  </div>

                  {/* Task Context Link */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                      {item.project_key}-{item.task_number}
                    </span>
                    <span className="text-sm font-bold text-slate-800 hover:text-blue-600 transition">
                      {item.task_title}
                    </span>
                  </div>

                  {/* Content Specifics */}
                  {item.activity_type === 'STATUS_CHANGED' && (
                    <div className="flex items-center gap-2 text-sm pt-1">
                      <StatusBadge status={item.old_value} />
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <StatusBadge status={item.new_value} />
                    </div>
                  )}

                  {item.activity_type === 'COMMENT_ADDED' && (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 italic mt-1 leading-relaxed">
                      "{item.comment_text}"
                    </div>
                  )}

                  {item.activity_type === 'ASSIGNED' && (
                    <p className="text-sm text-slate-600">
                      Assigned to <span className="font-bold text-slate-900">{item.new_value}</span>
                    </p>
                  )}

                  {item.activity_type === 'UNASSIGNED' && (
                    <p className="text-sm text-slate-600">
                      Unassigned <span className="font-bold text-slate-900">{item.old_value}</span>
                    </p>
                  )}

                  {item.activity_type === 'BLOCKER_ADDED' && (
                    <p className="text-sm font-semibold text-purple-700">
                      {item.new_value}
                    </p>
                  )}

                  {item.activity_type === 'BLOCKER_REMOVED' && (
                    <p className="text-sm font-semibold text-emerald-700">
                      Removed dependency blocker: {item.old_value}
                    </p>
                  )}

                  {item.activity_type === 'FIELD_UPDATED' && (
                    <p className="text-sm text-slate-600">
                      Updated <span className="font-semibold text-slate-800">{item.field_name}</span> from{' '}
                      <span className="font-mono text-slate-500">{item.old_value}</span> to{' '}
                      <span className="font-mono font-bold text-slate-900">{item.new_value}</span>
                    </p>
                  )}

                  {item.activity_type === 'CREATED' && (
                    <p className="text-sm text-slate-600 font-medium">
                      {item.new_value}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={isTaskOpen}
        onClose={closeTask}
        onTaskUpdated={loadFeed}
      />
    </div>
  );
};
