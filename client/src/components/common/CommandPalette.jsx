import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import { 
  Search, 
  Layers, 
  FolderKanban, 
  ListTodo, 
  CheckSquare, 
  AlertTriangle, 
  Activity, 
  UserCheck, 
  Download, 
  ArrowRight,
  Sparkles,
  Command,
  CornerDownLeft,
  X
} from 'lucide-react';
import { StatusBadge, PriorityBadge } from './Badge.jsx';

export const CommandPalette = ({ isOpen, onClose, onOpenTaskDetail }) => {
  const { user, switchPersona } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [projRes, tasksRes] = await Promise.all([
        api.getProjects(false),
        api.getTasks({ limit: 8 })
      ]);
      setProjects(projRes.projects || []);
      setTasks(tasksRes.tasks || []);
    } catch (err) {
      console.error('Failed to load command palette data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!query.trim()) return;
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        const tasksRes = await api.getTasks({ q: query.trim(), limit: 8 });
        setTasks(tasksRes.tasks || []);
      } catch (err) {
        console.error('Search failed in command palette', err);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timeout);
  }, [query]);

  const staticActions = [
    { id: 'nav-dash', title: 'Executive Dashboard', subtitle: 'Cross-project KPIs and velocity', icon: Layers, action: () => { navigate('/'); onClose(); } },
    { id: 'nav-proj', title: 'Projects Workspace', subtitle: 'View client projects & members', icon: FolderKanban, action: () => { navigate('/projects'); onClose(); } },
    { id: 'nav-tasks', title: 'All Tasks Tracker', subtitle: 'Server search, filters, and batch updates', icon: ListTodo, action: () => { navigate('/tasks'); onClose(); } },
    { id: 'nav-mytasks', title: 'My Assigned Tasks', subtitle: 'Work assigned across all projects', icon: CheckSquare, action: () => { navigate('/my-tasks'); onClose(); } },
    { id: 'nav-alerts', title: 'Overdue Alerts', subtitle: 'Urgent overdue task alerts', icon: AlertTriangle, action: () => { navigate('/alerts'); onClose(); } },
    { id: 'nav-activity', title: 'Global Activity Feed', subtitle: 'Real-time immutable audit trail', icon: Activity, action: () => { navigate('/activity'); onClose(); } },
    { id: 'action-export', title: 'Export Filtered CSV', subtitle: 'Stream current tasks to spreadsheet', icon: Download, action: () => { api.downloadTasksCsv().catch(err => console.error('CSV export failed', err)); onClose(); } },
    { id: 'switch-manager', title: 'Switch to Sarah Connor (Manager)', subtitle: 'Full portfolio & member admin access', icon: UserCheck, action: async () => { await switchPersona('manager@acme.com'); onClose(); navigate('/'); } },
    { id: 'switch-m1', title: 'Switch to Alex Rivera (Member)', subtitle: 'Assigned to Alpha, Billing, Legacy', icon: UserCheck, action: async () => { await switchPersona('member1@acme.com'); onClose(); navigate('/'); } },
    { id: 'switch-m2', title: 'Switch to Devon Vance (Member)', subtitle: 'Assigned to Alpha, Mobile', icon: UserCheck, action: async () => { await switchPersona('member2@acme.com'); onClose(); navigate('/'); } },
    { id: 'switch-m3', title: 'Switch to Elena Rostova (Member)', subtitle: 'Assigned to Billing, Mobile', icon: UserCheck, action: async () => { await switchPersona('member3@acme.com'); onClose(); navigate('/'); } },
  ];

  const filteredActions = staticActions.filter(a =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.key.toLowerCase().includes(query.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-slate-100 bg-slate-50/60">
          <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command, search tasks, projects, or switch personas..."
            className="w-full bg-transparent px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-hidden font-medium"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 mr-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-200/80 text-xs font-bold text-slate-600">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="overflow-y-auto p-3 space-y-4 flex-1">
          {/* Tasks Section */}
          {tasks.length > 0 && (
            <div className="space-y-1">
              <p className="px-2 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ListTodo className="w-3.5 h-3.5 text-blue-500" />
                Matching Tasks ({tasks.length})
              </p>
              <div className="space-y-0.5">
                {tasks.map(task => (
                  <button
                    key={task.id}
                    onClick={() => {
                      if (onOpenTaskDetail) onOpenTaskDetail(task.id);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-blue-50/70 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 group-hover:bg-blue-100 group-hover:text-blue-800 transition shrink-0">
                        {task.code}
                      </span>
                      <span className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-700">
                        {task.title}
                      </span>
                      <span className="text-xs text-slate-400 hidden sm:inline truncate">
                        • {task.project_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <StatusBadge status={task.status} />
                      <PriorityBadge priority={task.priority} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Projects Section */}
          {filteredProjects.length > 0 && (
            <div className="space-y-1">
              <p className="px-2 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-indigo-500" />
                Projects ({filteredProjects.length})
              </p>
              <div className="space-y-0.5">
                {filteredProjects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      navigate(`/projects/${p.id}`);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-indigo-50/70 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                        {p.key}
                      </span>
                      <span className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-700">
                        {p.name}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-400 group-hover:text-indigo-600 flex items-center gap-1">
                      Open Project &rarr;
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {filteredActions.length > 0 && (
            <div className="space-y-1">
              <p className="px-2 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Quick Actions & Navigation
              </p>
              <div className="space-y-0.5">
                {filteredActions.map(action => (
                  <button
                    key={action.id}
                    onClick={action.action}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100/80 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition shrink-0">
                        <action.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700 truncate">
                          {action.title}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {action.subtitle}
                        </p>
                      </div>
                    </div>
                    <CornerDownLeft className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600 transition shrink-0 mr-1" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="text-slate-400">Press <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-bold">Cmd</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-bold">K</kbd> anywhere</span>
          <span>Click outside or press ESC to exit</span>
        </div>
      </div>
    </div>
  );
};
