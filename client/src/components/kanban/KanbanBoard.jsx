import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PriorityBadge } from '../common/Badge.jsx';
import { Clock, ShieldAlert, AlertCircle, Copy, CheckCheck } from 'lucide-react';

const COLUMNS = [
  { id: 'BACKLOG', title: 'Backlog', color: 'bg-slate-100/80', border: 'border-slate-200' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'bg-blue-50/70', border: 'border-blue-200' },
  { id: 'IN_REVIEW', title: 'In Review', color: 'bg-amber-50/70', border: 'border-amber-200' },
  { id: 'BLOCKED', title: 'Blocked', color: 'bg-rose-50/70', border: 'border-rose-200' },
  { id: 'DONE', title: 'Done', color: 'bg-emerald-50/70', border: 'border-emerald-200' },
];

export const KanbanBoard = ({ tasks, onTaskClick, onRefresh }) => {
  const toast = useToast();
  const [errorToast, setErrorToast] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const taskId = draggableId;
    const targetStatus = destination.droppableId;

    setErrorToast(null);

    try {
      await api.updateTask(taskId, { status: targetStatus });
      toast.success(`Task moved to ${targetStatus.replace('_', ' ')}`);
      onRefresh();
    } catch (err) {
      const msg = err.message || 'Illegal status transition.';
      setErrorToast(msg);
      toast.error(msg);
      setTimeout(() => setErrorToast(null), 6000);
      onRefresh();
    }
  };

  const handleCopyCode = (e, code, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.info(`Copied ${code}`);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-4">
      {errorToast && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center justify-between shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorToast}</span>
          </div>
          <button onClick={() => setErrorToast(null)} className="text-rose-500 hover:text-rose-800 text-sm font-bold">
            Dismiss
          </button>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id);
            return (
              <div
                key={col.id}
                className={`flex flex-col rounded-2xl ${col.color} border ${col.border} p-3.5 min-h-[500px] shadow-xs`}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
                    {col.title}
                  </h3>
                  <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-600 shadow-xs border border-slate-200">
                    {colTasks.length}
                  </span>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 space-y-2.5 min-h-[420px] rounded-xl p-1 transition ${
                        snapshot.isDraggingOver ? 'bg-white/60' : ''
                      }`}
                    >
                      {colTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              onClick={() => onTaskClick(task.id)}
                              className={`p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400 transition cursor-pointer group ${
                                dragSnapshot.isDragging ? 'shadow-xl ring-2 ring-blue-500 scale-102' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span 
                                  onClick={(e) => handleCopyCode(e, task.code, task.id)}
                                  className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-700 flex items-center gap-1"
                                  title="Click to copy code"
                                >
                                  {task.code}
                                  {copiedId === task.id ? (
                                    <CheckCheck className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition" />
                                  )}
                                </span>
                                <PriorityBadge priority={task.priority} />
                              </div>

                              <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-relaxed mb-2">
                                {task.title}
                              </p>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                                {task.due_date ? (
                                  <span className={`flex items-center gap-1 font-medium ${task.is_overdue ? 'text-rose-600 font-bold' : ''}`}>
                                    <Clock className="w-3 h-3" />
                                    {task.due_date}
                                  </span>
                                ) : (
                                  <span></span>
                                )}

                                {task.blockers && task.blockers.length > 0 && (
                                  <span className="flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                    <ShieldAlert className="w-3 h-3" />
                                    {task.blockers.length}
                                  </span>
                                )}

                                <div className="flex -space-x-1.5 overflow-hidden ml-auto">
                                  {task.assignees.map(a => (
                                    <div
                                      key={a.id}
                                      className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white ring-2 ring-white"
                                      style={{ backgroundColor: a.avatar_color || '#3b82f6' }}
                                      title={a.name}
                                    >
                                      {a.name[0]}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};
