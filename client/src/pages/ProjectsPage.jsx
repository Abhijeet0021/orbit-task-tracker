import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useConfirm } from '../components/common/ConfirmDialog.jsx';
import { 
  FolderKanban, 
  Users, 
  ListTodo, 
  Archive, 
  RotateCcw, 
  Search
} from 'lucide-react';

export const ProjectsPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [projects, setProjects] = useState([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await api.getProjects(includeArchived);
      setProjects(res.projects);
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [includeArchived, user]);

  const handleArchive = async (id, e) => {
    e.preventDefault();
    const ok = await confirm({
      title: 'Archive this project?',
      body: 'It will be hidden from the default views. Its tasks and history are kept, and you can restore it at any time.',
      confirmLabel: 'Archive project',
    });
    if (!ok) return;
    try {
      await api.archiveProject(id);
      toast.success('Project archived');
      loadProjects();
    } catch (err) {
      toast.error(err.message || 'Could not archive the project.');
    }
  };

  const handleRestore = async (id, e) => {
    e.preventDefault();
    try {
      await api.restoreProject(id);
      toast.success('Project restored');
      loadProjects();
    } catch (err) {
      toast.error(err.message || 'Could not restore the project.');
    }
  };

  const filtered = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.key.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Client Projects</h1>
          <p className="text-xs text-slate-500 mt-1">
            {user?.role === 'MANAGER' 
              ? 'Manage client engagements, project memberships, and active scopes.' 
              : 'Client projects you are assigned to as an active team member.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={e => setIncludeArchived(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Show Archived Projects</span>
          </label>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter projects by key or name..."
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden shadow-xs"
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading projects...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 shadow-xs">
          <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No projects found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {includeArchived ? 'Try adjusting your search criteria.' : 'No active projects matching criteria or assigned to you.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(project => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className={`p-6 rounded-3xl bg-white border transition shadow-xs hover:shadow-md flex flex-col justify-between group ${
                project.is_archived
                  ? 'border-dashed border-slate-300 bg-slate-50/70 opacity-75'
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-mono text-xs font-black px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                    {project.key}
                  </span>
                  {project.is_archived ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                      Archived
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400">
                      Owner: {project.owner_name}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition mb-1">
                  {project.name}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {project.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                  <span className="flex items-center gap-1">
                    <ListTodo className="w-3.5 h-3.5 text-slate-400" />
                    {project.tasks_count || 0} tasks
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {project.members_count || project.members?.length || 0} members
                  </span>
                </div>

                {user?.role === 'MANAGER' && (
                  <div className="flex items-center gap-1">
                    {project.is_archived ? (
                      <button
                        onClick={e => handleRestore(project.id, e)}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                        title="Restore Project"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={e => handleArchive(project.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Archive Project"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
