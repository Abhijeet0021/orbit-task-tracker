import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Layers, ArrowRight } from 'lucide-react';
import { RoleBadge } from '../components/common/Badge.jsx';

export const LoginPage = () => {
  const { login, switchPersona } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async (personaEmail) => {
    setError('');
    setSubmitting(true);
    try {
      await switchPersona(personaEmail);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const demoAccounts = [
    {
      name: 'Sarah Connor',
      role: 'MANAGER',
      email: 'manager@acme.com',
      desc: 'Can create/archive projects, manage members, delete tasks, full portfolio access.'
    },
    {
      name: 'Alex Rivera',
      role: 'MEMBER',
      email: 'member1@acme.com',
      desc: 'Member of Alpha Cloud, Billing Engine, Legacy Migration. Cannot delete tasks or archive projects.'
    },
    {
      name: 'Devon Vance',
      role: 'MEMBER',
      email: 'member2@acme.com',
      desc: 'Member of Alpha Cloud & Mobile App.'
    },
    {
      name: 'Elena Rostova',
      role: 'MEMBER',
      email: 'member3@acme.com',
      desc: 'Member of Billing Engine & Mobile App.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100">
        <div className="bg-slate-50/80 p-8 border-r border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/30">
                <Layers className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Orbit (Task Tracker)</h1>
            </div>

            <h2 className="text-lg font-bold text-slate-900 mb-1">Instant Demo Personas</h2>
            <p className="text-sm text-slate-500 mb-5">
              Click any role to test server-side access control, lifecycle rules, and assignment scoping.
            </p>

            <div className="space-y-2.5">
              {demoAccounts.map(account => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleQuickLogin(account.email)}
                  disabled={submitting}
                  className="w-full text-left p-3 rounded-2xl bg-white border border-slate-200 hover:border-blue-500 hover:shadow-md hover:bg-blue-50/40 transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 group-hover:text-blue-600">
                      {account.name}
                    </span>
                    <RoleBadge role={account.role} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {account.desc}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition">
                    <span>Log in as {account.name.split(' ')[0]}</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-6 border-t border-slate-200/80 text-xs text-slate-400">
            Password for demo accounts is <code className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono font-bold">Manager123!</code> / <code className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono font-bold">Member123!</code>
          </div>
        </div>

        <div className="p-8 md:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h3 className="text-xl font-black text-slate-900">Sign In to Your Workspace</h3>
            <p className="text-sm text-slate-500 mt-1">Enter your credentials below to access your projects.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="manager@acme.com"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden bg-slate-50/50"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow-md shadow-blue-500/20"
            >
              {submitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
