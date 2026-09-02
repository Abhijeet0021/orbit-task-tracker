import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban, 
  ListTodo, 
  CheckSquare, 
  AlertTriangle,
  Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAlerts } from '../../context/AlertContext.jsx';
import { api } from '../../api/client.js';

export const Sidebar = ({ onOpenCreateProject }) => {
  const { user } = useAuth();
  const { alertCount } = useAlerts();
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await api.getProjects(false);
        setProjects(res.projects);
      } catch (err) {
        console.error('Failed to load projects in sidebar', err);
      }
    }
    loadProjects();
  }, [user]);

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Projects', path: '/projects', icon: FolderKanban },
    { label: 'All Tasks', path: '/tasks', icon: ListTodo },
    { label: 'My Tasks', path: '/my-tasks', icon: CheckSquare },
    { label: 'Overdue Alerts', path: '/alerts', icon: AlertTriangle, badge: alertCount },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-4 h-4 text-slate-500" />
              <span>{item.label}</span>
            </div>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      <div className="border-t border-slate-100 p-4 flex-1">
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Projects ({projects.length})
          </span>
          {user?.role === 'MANAGER' && onOpenCreateProject && (
            <button
              onClick={onOpenCreateProject}
              className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
              title="Create Project"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="space-y-1">
          {projects.map(p => (
            <NavLink
              key={p.id}
              to={`/projects/${p.id}`}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <div className="flex items-center gap-2 truncate">
                <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {p.key}
                </span>
                <span className="truncate">{p.name}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium ml-2">
                {p.tasks_count || 0}
              </span>
            </NavLink>
          ))}
          {projects.length === 0 && (
            <p className="text-xs text-slate-400 px-3 py-2">No active projects.</p>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: user?.avatar_color || '#3b82f6' }}>
            {user?.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900 truncate">{user?.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
