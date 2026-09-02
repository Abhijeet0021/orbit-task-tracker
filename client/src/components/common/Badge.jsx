import React from 'react';

export const StatusBadge = ({ status, className = '' }) => {
  const styles = {
    BACKLOG: { bg: 'bg-slate-100', text: 'text-slate-700 border-slate-200', label: 'Backlog', dot: 'bg-slate-400' },
    IN_PROGRESS: { bg: 'bg-blue-50', text: 'text-blue-700 border-blue-200', label: 'In Progress', dot: 'bg-blue-500' },
    IN_REVIEW: { bg: 'bg-amber-50', text: 'text-amber-700 border-amber-200', label: 'In Review', dot: 'bg-amber-500' },
    DONE: { bg: 'bg-emerald-50', text: 'text-emerald-700 border-emerald-200', label: 'Done', dot: 'bg-emerald-500' },
    BLOCKED: { bg: 'bg-rose-50', text: 'text-rose-700 border-rose-200', label: 'Blocked', dot: 'bg-rose-500' },
  };

  const current = styles[status] || styles.BACKLOG;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${current.bg} ${current.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`}></span>
      {current.label}
    </span>
  );
};

export const PriorityBadge = ({ priority, className = '' }) => {
  const styles = {
    LOW: { bg: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Low' },
    MEDIUM: { bg: 'bg-blue-50 text-blue-600 border-blue-200', label: 'Medium' },
    HIGH: { bg: 'bg-orange-50 text-orange-600 border-orange-200', label: 'High' },
    URGENT: { bg: 'bg-rose-50 text-rose-700 border-rose-200 font-bold', label: 'Urgent' },
  };

  const current = styles[priority] || styles.MEDIUM;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${current.bg} ${className}`}>
      {current.label}
    </span>
  );
};

export const RoleBadge = ({ role }) => {
  if (role === 'MANAGER') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
        Manager
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
      Member
    </span>
  );
};
