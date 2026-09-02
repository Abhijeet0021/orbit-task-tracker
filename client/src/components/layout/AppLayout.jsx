import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Navbar } from './Navbar.jsx';
import { Sidebar } from './Sidebar.jsx';
import { Modal } from '../common/Modal.jsx';
import { CommandPalette } from '../common/CommandPalette.jsx';
import { api } from '../../api/client.js';

export const AppLayout = () => {
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isCreateProjectOpen || users.length > 0) return;
    api.getUsers()
      .then(res => setUsers(res.users || []))
      .catch(err => console.error('Failed to load users for owner picker', err));
  }, [isCreateProjectOpen, users.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen(open => !open);
      }
      if (e.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.createProject({ key, name, description, owner_id: ownerId || undefined });
      setIsCreateProjectOpen(false);
      setKey('');
      setName('');
      setDescription('');
      setOwnerId('');
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar onToggleSidebar={() => setIsSidebarOpen(true)} />
      <div className="flex flex-1">
        {/* Below lg the sidebar would eat most of the screen, so it becomes a
            dismissible overlay instead of a permanent column. */}
        <div className="hidden lg:flex">
          <Sidebar onOpenCreateProject={() => setIsCreateProjectOpen(true)} />
        </div>

        {isSidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-slate-900/50 animate-in fade-in duration-150"
              onClick={() => setIsSidebarOpen(false)}
            />
            <div className="relative z-50 h-full w-64 shadow-xl animate-in fade-in duration-150">
              <Sidebar
                onOpenCreateProject={() => {
                  setIsSidebarOpen(false);
                  setIsCreateProjectOpen(true);
                }}
                onNavigate={() => setIsSidebarOpen(false)}
              />
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onOpenTaskDetail={(taskId) => {
          setIsPaletteOpen(false);
          // The task list owns the modal; ?task= is what opens it there.
          navigate(`/tasks?task=${encodeURIComponent(taskId)}`);
        }}
      />

      <Modal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        title="Create New Project"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
              Project Key (e.g. ENG, DES, BIL) *
            </label>
            <input
              type="text"
              required
              maxLength={8}
              value={key}
              onChange={e => setKey(e.target.value.toUpperCase())}
              placeholder="e.g. ALP"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase font-mono font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
            />
            <p className="text-xs text-slate-500 mt-1">Short unique prefix for project task IDs.</p>
          </div>

          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Cloud Infrastructure Platform"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
              Owner
            </label>
            <select
              value={ownerId}
              onChange={e => setOwnerId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
            >
              <option value="">Me (project creator)</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">The owner is accountable for the project and is always a member of it.</p>
          </div>

          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Project goals, scope and client details..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateProjectOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition shadow-sm shadow-blue-500/20"
            >
              {submitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
