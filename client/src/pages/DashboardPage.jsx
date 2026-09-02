import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Layers, 
  TrendingUp, 
  UserCheck, 
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { StatusBadge } from '../components/common/Badge.jsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';

export const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.getDashboardStats();
      setStats(res);
    } catch (err) {
      console.error('Failed to load dashboard stats', err);
      setError(err.message || 'The dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // A skeleton in the shape of the real page, rather than a line of centred
  // text on an empty screen — the layout does not jump when the data lands.
  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
        <div className="space-y-2">
          <div className="h-7 w-72 animate-pulse rounded-lg bg-slate-200/70" />
          <div className="h-4 w-96 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-2" />
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
        </div>
        <h2 className="text-base font-bold text-slate-900">The dashboard didn't load</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          {error || 'No analytics came back from the server.'}
        </p>
        <button
          type="button"
          onClick={loadStats}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }

  const kpis = [
    { label: 'Open Tasks', count: stats.headline.openTasks, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50/80', border: 'border-blue-200' },
    { label: 'Overdue Tasks', count: stats.headline.overdueTasks, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50/80', border: 'border-rose-200', highlight: stats.headline.overdueTasks > 0 },
    { label: 'Due This Week', count: stats.headline.dueThisWeek, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50/80', border: 'border-amber-200' },
    { label: 'Completed This Week', count: stats.headline.completedThisWeek, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50/80', border: 'border-emerald-200' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Executive Portfolio Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Cross-project health, team workload, and delivery trends at a glance.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/tasks"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition shadow-sm"
          >
            <span>View All Tasks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className={`p-5 rounded-2xl bg-white border ${kpi.border} shadow-xs flex items-center justify-between ${
              kpi.highlight ? 'ring-2 ring-rose-500/20' : ''
            }`}
          >
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-slate-400">{kpi.label}</p>
              <p className={`text-3xl font-black mt-1 ${kpi.color}`}>{kpi.count}</p>
            </div>
            <div className={`p-3.5 rounded-2xl ${kpi.bg}`}>
              <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Completed Tasks Over Last 8 Weeks
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">Historical delivery velocity by week</p>
            </div>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.eightWeeksCompletions} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="weekLabel" 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  axisLine={{ stroke: '#e2e8f0' }} 
                  tickLine={false} 
                />
                <YAxis 
                  allowDecimals={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  axisLine={{ stroke: '#e2e8f0' }} 
                  tickLine={false} 
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value) => [`${value} tasks completed`, 'Completions']}
                />
                <Bar 
                  dataKey="completedCount" 
                  fill="#3b82f6" 
                  radius={[6, 6, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Portfolio Status Breakdown
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">Distribution across lifecycle stages</p>

            <div className="space-y-3 mt-6">
              {stats.statusBreakdown.map(item => {
                const total = stats.statusBreakdown.reduce((acc, s) => acc + s.count, 0) || 1;
                const pct = Math.round((item.count / total) * 100);

                return (
                  <div key={item.status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <StatusBadge status={item.status} />
                      <span className="font-bold text-slate-700">{item.count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          item.status === 'DONE' ? 'bg-emerald-500' :
                          item.status === 'BLOCKED' ? 'bg-rose-500' :
                          item.status === 'IN_REVIEW' ? 'bg-amber-500' :
                          item.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 flex items-center gap-2 mt-4">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Strict server-side validation guarantees valid state transitions.</span>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              Team Workload & Overdue Allocation
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">Spot overloaded team members and overdue bottlenecks immediately</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {stats.assigneeBreakdown.map(person => (
            <div
              key={person.user_id}
              className={`p-4 rounded-2xl border transition ${
                person.overdue_tasks_count > 0 
                  ? 'bg-rose-50/40 border-rose-200' 
                  : 'bg-slate-50/70 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs"
                  style={{ backgroundColor: person.avatar_color || '#3b82f6' }}
                >
                  {person.user_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{person.user_name}</p>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">{person.user_role}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-center">
                <div className="p-2 rounded-xl bg-white border border-slate-100">
                  <p className="text-[11px] uppercase font-bold text-slate-400">Active</p>
                  <p className="text-base font-black text-slate-800">{person.active_tasks_count}</p>
                </div>
                <div className={`p-2 rounded-xl border ${person.overdue_tasks_count > 0 ? 'bg-rose-100/50 border-rose-200' : 'bg-white border-slate-100'}`}>
                  <p className={`text-[11px] uppercase font-bold ${person.overdue_tasks_count > 0 ? 'text-rose-600' : 'text-slate-400'}`}>Overdue</p>
                  <p className={`text-base font-black ${person.overdue_tasks_count > 0 ? 'text-rose-700' : 'text-slate-800'}`}>{person.overdue_tasks_count}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
