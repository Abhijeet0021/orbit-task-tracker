import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar.jsx';
import { Sidebar } from './Sidebar.jsx';
import { Modal } from '../common/Modal.jsx';
import { CommandPalette } from '../common/CommandPalette.jsx';
import { TaskDetailModal } from '../tasks/TaskDetailModal.jsx';
import { api } from '../../api/client.js';

export const AppLayout = () => {
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteTaskId, setPaletteTaskId] = useState(null);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen(open => !open);
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
      await api.createProject({ key, name, description });
      setIsCreateProjectOpen(false);
      setKey('');
      setName('');
      setDescription('');
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar onOpenCreateProject={() => setIsCreateProjectOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onOpenTaskDetail={(taskId) => {
          setIsPaletteOpen(false);
          setPaletteTaskId(taskId);
        }}
      />

      <TaskDetailModal
        taskId={paletteTaskId}
        isOpen={Boolean(paletteTaskId)}
        onClose={() => setPaletteTaskId(null)}
      />

      <Modal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        title="Create New Project"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
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
            <p className="text-[11px] text-slate-500 mt-1">Short unique prefix for project task IDs.</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
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
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
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
