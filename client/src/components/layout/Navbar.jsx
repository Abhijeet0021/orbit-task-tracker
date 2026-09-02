import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAlerts } from '../../context/AlertContext.jsx';
import { Bell, LogOut, Layers, UserCheck, ChevronDown, Menu } from 'lucide-react';
import { RoleBadge } from '../common/Badge.jsx';

export const Navbar = ({ onToggleSidebar }) => {
  const { user, logout, switchPersona } = useAuth();
  const { alertCount } = useAlerts();
  const navigate = useNavigate();
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  const personas = [
    { name: 'Sarah Connor', email: 'manager@acme.com', role: 'MANAGER', desc: 'Full portfolio access, project & member management, task deletion' },
    { name: 'Alex Rivera', email: 'member1@acme.com', role: 'MEMBER', desc: 'Member of Alpha, Billing, Legacy' },
    { name: 'Devon Vance', email: 'member2@acme.com', role: 'MEMBER', desc: 'Member of Alpha, Mobile' },
    { name: 'Elena Rostova', email: 'member3@acme.com', role: 'MEMBER', desc: 'Member of Billing, Mobile' },
  ];

  const handleSwitch = async (email) => {
    await switchPersona(email);
    setShowPersonaMenu(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="-ml-2 rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Layers className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
            Orbit
          </span>
        </Link>
        <span className="hidden md:inline-block text-sm font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
          Portfolio Tracker (JS)
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Quick Persona Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition shadow-xs"
            title="Switch demo user account"
          >
            <UserCheck className="h-3.5 w-3.5 text-blue-600" />
            <span className="hidden font-semibold sm:inline">{user?.name}</span>
            <RoleBadge role={user?.role || 'MEMBER'} />
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {showPersonaMenu && (
            <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-sm font-bold uppercase tracking-wider text-slate-400">Switch Demo Persona</p>
                <p className="text-xs text-slate-500">Test role enforcement & scoping instantly</p>
              </div>
              <div className="space-y-1 pt-1">
                {personas.map(p => (
                  <button
                    key={p.email}
                    onClick={() => handleSwitch(p.email)}
                    className={`w-full text-left p-2.5 rounded-lg flex items-start gap-2.5 transition text-sm ${
                      user?.email === p.email ? 'bg-blue-50/80 border border-blue-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white font-bold text-[11px]" style={{ backgroundColor: p.role === 'MANAGER' ? '#ef4444' : '#3b82f6' }}>
                      {p.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 truncate">{p.name}</span>
                        <RoleBadge role={p.role} />
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{p.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Overdue Alerts Bell Badge */}
        <Link
          to="/alerts"
          className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
          title="Overdue Tasks"
        >
          <Bell className="h-5 w-5" />
          {alertCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-extrabold text-white shadow-xs animate-pulse">
              {alertCount}
            </span>
          )}
        </Link>

        {/* Logout */}
        <button
          onClick={logout}
          className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
          title="Log out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};
