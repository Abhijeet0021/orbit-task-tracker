import React, { useState } from 'react';
import { api } from '../../api/client.js';
import { MessageSquare, Clock, ArrowRight, UserPlus, UserMinus, ShieldAlert, Sparkles, Send } from 'lucide-react';
import { StatusBadge } from '../common/Badge.jsx';

export const TaskTimeline = ({ taskId, timeline, onRefresh }) => {
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.addTaskComment(taskId, commentText.trim());
      setCommentText('');
      onRefresh();
    } catch (err) {
      setError(err.message || 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderIcon = (type) => {
    switch (type) {
      case 'CREATED':
        return <Sparkles className="w-3.5 h-3.5 text-blue-600" />;
      case 'STATUS_CHANGED':
        return <ArrowRight className="w-3.5 h-3.5 text-amber-600" />;
      case 'ASSIGNED':
        return <UserPlus className="w-3.5 h-3.5 text-emerald-600" />;
      case 'UNASSIGNED':
        return <UserMinus className="w-3.5 h-3.5 text-rose-600" />;
      case 'BLOCKER_ADDED':
      case 'BLOCKER_REMOVED':
        return <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />;
      case 'COMMENT_ADDED':
        return <MessageSquare className="w-3.5 h-3.5 text-slate-700" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Immutable Activity History & Comments ({timeline.length})
        </h4>
        <span className="text-xs text-slate-400 font-medium italic">
          Audit trail cannot be edited or deleted
        </span>
      </div>

      <form onSubmit={handleAddComment} className="space-y-2">
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="relative">
          <textarea
            rows={2}
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="Add an update or comment to this task timeline..."
            className="w-full rounded-xl border border-slate-200 p-3 pr-12 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden bg-slate-50/50"
          />
          <button
            type="submit"
            disabled={submitting || !commentText.trim()}
            className="absolute right-2.5 bottom-3.5 p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition shadow-xs"
            title="Post comment"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      <div className="relative border-l-2 border-slate-100 ml-3 space-y-4">
        {timeline.map((act) => (
          <div key={act.id} className="relative pl-6">
            <div className="absolute -left-[17px] top-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 shadow-xs">
              {renderIcon(act.activity_type)}
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 text-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900">
                    {act.user_name || 'System'}
                  </span>
                  {act.user_role && (
                    <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-medium">
                      {act.user_role}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {new Date(act.created_at).toLocaleString()}
                </span>
              </div>

              {act.activity_type === 'COMMENT_ADDED' && (
                <p className="text-slate-700 whitespace-pre-wrap mt-1 text-[13px] bg-white p-2.5 rounded-lg border border-slate-100 font-normal">
                  {act.comment_text}
                </p>
              )}

              {act.activity_type === 'STATUS_CHANGED' && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-500">Changed status from</span>
                  <StatusBadge status={act.old_value} />
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <StatusBadge status={act.new_value} />
                </div>
              )}

              {act.activity_type === 'FIELD_UPDATED' && (
                <div className="text-slate-600 mt-1">
                  Updated <span className="font-semibold text-slate-800">{act.field_name}</span> from{' '}
                  <span className="line-through text-slate-400">{act.old_value || 'none'}</span> to{' '}
                  <span className="font-semibold text-slate-900">{act.new_value || 'none'}</span>
                </div>
              )}

              {act.activity_type === 'ASSIGNED' && (
                <p className="text-slate-600 mt-1">
                  Assigned <span className="font-semibold text-slate-900">{act.new_value}</span>
                </p>
              )}

              {act.activity_type === 'UNASSIGNED' && (
                <p className="text-slate-600 mt-1">
                  Unassigned <span className="font-semibold text-slate-900">{act.old_value}</span>
                  {act.comment_text && <span className="text-slate-400 italic ml-1">({act.comment_text})</span>}
                </p>
              )}

              {act.activity_type === 'BLOCKER_ADDED' && (
                <p className="text-purple-700 mt-1 font-medium">
                  {act.new_value}
                </p>
              )}

              {act.activity_type === 'BLOCKER_REMOVED' && (
                <p className="text-slate-500 mt-1">
                  Removed blocker: <span className="line-through">{act.old_value}</span>
                </p>
              )}

              {act.activity_type === 'CREATED' && (
                <p className="text-slate-600 mt-1">{act.new_value || 'Task created.'}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
