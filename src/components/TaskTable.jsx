import React from 'react';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { Eye, Trash2, Calendar, FileText, MessageSquare, Paperclip, ShieldCheck, Pencil } from 'lucide-react';

export default function TaskTable({
  tasks = [],
  loading = false,
  onViewTask,
  onEditTask,
  onDeleteTask,
  isManager = true
}) {
  if (loading) {
    return (
      <div className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-400">Loading task records...</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="glass-panel p-12 rounded-xl text-center space-y-3">
        <FileText className="w-12 h-12 text-slate-600 mx-auto" />
        <h3 className="text-base font-semibold text-slate-300">No tasks found</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          No tasks match your filter criteria or search query. Try adjusting your search keywords or resetting filters.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/5 shadow-2xl bg-[#07070a]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0b0b0e] text-neutral-400 font-semibold border-b border-white/5 uppercase tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Task ID</th>
              <th className="py-3.5 px-4">Task Title</th>
              <th className="py-3.5 px-4">Assigned By</th>
              <th className="py-3.5 px-4">Assigned To</th>
              <th className="py-3.5 px-4">Project</th>
              <th className="py-3.5 px-4">Department</th>
              <th className="py-3.5 px-4">Assigned</th>
              <th className="py-3.5 px-4">Due Date</th>
              <th className="py-3.5 px-4">Completed</th>
              <th className="py-3.5 px-4">Priority</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-neutral-200">
            {tasks.map((task) => (
              <tr
                key={task.id}
                className="hover:bg-white/[0.03] transition duration-150 group cursor-pointer"
                onClick={() => onViewTask(task)}
              >
                <td className="py-3.5 px-4 font-mono font-bold text-white">
                  {task.task_id}
                </td>

                <td className="py-3.5 px-4 font-semibold text-slate-100 max-w-xs truncate">
                  <div className="flex items-center gap-1.5">
                    <span>{task.title}</span>
                    {task.comment_count > 0 && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <MessageSquare className="w-3 h-3 text-slate-500" />
                        {task.comment_count}
                      </span>
                    )}
                    {task.attachment_count > 0 && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Paperclip className="w-3 h-3 text-slate-500" />
                        {task.attachment_count}
                      </span>
                    )}
                  </div>
                </td>

                <td className="py-3.5 px-4 font-medium whitespace-nowrap">
                  {task.assigned_by_role === 'Admin' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{task.assigned_by_name}</span>
                    </span>
                  ) : (
                    <span className="text-slate-300">
                      {task.assigned_by_name}
                    </span>
                  )}
                </td>

                <td className="py-3.5 px-4 font-medium text-slate-200">
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
                    {task.assigned_to_name}
                  </span>
                </td>

                <td className="py-3.5 px-4 text-slate-300 font-medium">
                  {task.project_name}
                </td>

                <td className="py-3.5 px-4 text-slate-400">
                  {task.department_name}
                </td>

                <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                  {task.assigned_date}
                </td>

                <td className="py-3.5 px-4 font-medium whitespace-nowrap">
                  <span className={task.status === 'Overdue' ? 'text-rose-400 font-bold' : (task.due_date ? 'text-slate-300' : 'text-neutral-500 italic text-[11px]')}>
                    {task.due_date || 'No Due Date'}
                  </span>
                </td>

                <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                  {task.completed_date ? task.completed_date.split(' ')[0] : '—'}
                </td>

                <td className="py-3.5 px-4">
                  <PriorityBadge priority={task.priority} />
                </td>

                <td className="py-3.5 px-4">
                  <StatusBadge status={task.status} />
                </td>

                <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onViewTask(task)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-neutral-300 hover:text-white transition cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {isManager && onEditTask && (
                      <button
                        onClick={() => onEditTask(task)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 hover:text-white transition cursor-pointer"
                        title="Edit Task"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isManager && (
                      <button
                        onClick={() => onDeleteTask(task)}
                        className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 transition cursor-pointer"
                        title="Delete Task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
