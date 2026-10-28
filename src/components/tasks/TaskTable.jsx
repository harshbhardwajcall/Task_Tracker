import React from 'react';
import StatusBadge from '../ui/StatusBadge';
import PriorityBadge from '../ui/PriorityBadge';
import { Eye, Trash2, Calendar, FileText, MessageSquare, Paperclip, ShieldCheck, Pencil, Users, Repeat, Clock } from 'lucide-react';
import { formatCompletionTime, formatTotalDuration } from '../../utils/timeFormat';
import { useAuth } from '../../context/AuthContext';

export default function TaskTable({
  tasks = [],
  loading = false,
  onViewTask,
  onEditTask,
  onDeleteTask,
  isManager = true
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
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
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-2xl bg-white dark:bg-[#07070a]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 dark:bg-[#0b0b0e] text-black dark:text-neutral-300 font-extrabold border-b border-slate-200 dark:border-white/5 uppercase tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Task ID</th>
              <th className="py-3.5 px-4">Task Title</th>
              <th className="py-3.5 px-4">Assigned By</th>
              <th className="py-3.5 px-4">Assigned To</th>
              <th className="py-3.5 px-4">Project</th>
              <th className="py-3.5 px-4">Department</th>
              <th className="py-3.5 px-4">Assigned</th>
              <th className="py-3.5 px-4">Due Date</th>
              <th className="py-3.5 px-4">Completed / Time Taken</th>
              <th className="py-3.5 px-4">Priority</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-black dark:text-neutral-200">
            {tasks.map((task) => (
              <tr
                key={task.id}
                className="hover:bg-slate-100/80 dark:hover:bg-white/[0.03] transition duration-150 group cursor-pointer"
                onClick={() => onViewTask(task)}
              >
                <td className="py-3.5 px-4 font-mono font-black text-black dark:text-white text-xs">
                  {task.task_id}
                </td>

                <td className="py-3.5 px-4 font-extrabold text-black dark:text-white max-w-xs truncate">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-black dark:text-white">{task.title}</span>
                    {task.dependencies && task.dependencies.length > 0 && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30"
                        title={`Collaborative Task with ${task.dependencies.length} co-workers: ${task.dependencies.map(d => d.name).join(', ')}`}
                      >
                        <Users className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                        <span>{task.dependencies.length + 1} Staff</span>
                      </span>
                    )}
                    {Boolean(task.is_loop) && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30"
                        title={`Repeat Task: Every ${task.loop_interval_hours || 24}h • Cycle #${task.loop_count || 0}${task.next_run_at ? ` • Next reset: ${new Date(task.next_run_at).toLocaleString()}` : ''}`}
                      >
                        <Repeat className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        <span>Every {task.loop_interval_hours || 24}h</span>
                        {task.loop_count > 0 && <span className="text-[9px] opacity-80">#{task.loop_count}</span>}
                      </span>
                    )}
                    {task.comment_count > 0 && (
                      <span className="text-[10px] text-slate-700 dark:text-slate-400 flex items-center gap-0.5 font-bold">
                        <MessageSquare className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                        {task.comment_count}
                      </span>
                    )}
                    {task.attachment_count > 0 && (
                      <span className="text-[10px] text-slate-700 dark:text-slate-400 flex items-center gap-0.5 font-bold">
                        <Paperclip className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                        {task.attachment_count}
                      </span>
                    )}
                  </div>
                </td>

                <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                  {task.assigned_by_role === 'Admin' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 text-xs font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                      <span>{task.assigned_by_name || 'Administrator'}</span>
                    </span>
                  ) : (
                    <span className="text-black dark:text-slate-200">
                      {task.assigned_by_name || 'Administrator'}
                    </span>
                  )}
                </td>

                <td className="py-3.5 px-4 font-bold text-black dark:text-slate-200">
                  {task.assigned_to_name ? (
                    <div className="flex flex-col gap-1">
                      <div className="inline-flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-black dark:text-slate-200">
                          {task.assigned_to_name}
                        </span>
                        {Number(task.assigned_to) === Number(user?.id) ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 text-[10px] font-black border border-sky-300 dark:border-sky-500/30">
                            You (Assignee)
                          </span>
                        ) : task.dependencies && task.dependencies.some(d => Number(d.id || d.user_id) === Number(user?.id)) ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 text-[10px] font-black border border-emerald-300 dark:border-emerald-500/30">
                            🤝 You (Collaborator)
                          </span>
                        ) : Number(task.assigned_by) === Number(user?.id) ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-500/30">
                            📤 Assigned by You
                          </span>
                        ) : (!isAdmin && (
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 text-[10px] font-bold border border-purple-200 dark:border-purple-500/20">
                            Teammate
                          </span>
                        ))}
                      </div>

                      {/* Explicitly show dependency co-employees so all employees on the task are visible */}
                      {task.dependencies && task.dependencies.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-0.5">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-neutral-400">Co-workers:</span>
                          {task.dependencies.map(dep => {
                            const isMe = Number(dep.id || dep.user_id) === Number(user?.id);
                            return (
                              <span
                                key={dep.id || dep.user_id}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${
                                  isMe
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700 font-bold'
                                    : 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60 font-medium'
                                }`}
                                title={`${dep.name} (${dep.role || 'Employee'})`}
                              >
                                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                                  isMe ? 'bg-emerald-700 text-white' : 'bg-cyan-700 text-white'
                                }`}>
                                  {dep.name ? dep.name.charAt(0).toUpperCase() : 'U'}
                                </span>
                                <span>{dep.name}{isMe ? ' (You)' : ''}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full font-extrabold text-[11px] border bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                      Unassigned (Needs Reassignment)
                    </span>
                  )}
                </td>

                <td className="py-3.5 px-4 text-black dark:text-slate-200 font-bold">
                  {task.project_name}
                </td>

                <td className="py-3.5 px-4 text-black dark:text-slate-300 font-semibold">
                  {task.department_name}
                </td>

                <td className="py-3.5 px-4 text-black dark:text-slate-400 whitespace-nowrap font-semibold">
                  {task.assigned_date}
                </td>

                <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                  <span className={task.status === 'Overdue' ? 'text-rose-700 dark:text-rose-400 font-black' : (task.due_date ? 'text-black dark:text-slate-200' : 'text-slate-600 dark:text-neutral-500 italic text-[11px]')}>
                    {task.due_date || 'No Due Date'}
                  </span>
                </td>

                <td className="py-3.5 px-4 whitespace-nowrap">
                  {task.status === 'Completed' || task.completed_date ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                        {formatCompletionTime(task.completed_at || task.completed_date) || 'Completed'}
                      </span>
                      {formatTotalDuration(task) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-neutral-400">
                          <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Took: <strong className="text-black dark:text-neutral-200 font-mono">{formatTotalDuration(task)}</strong></span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 dark:text-neutral-500 text-xs">—</span>
                  )}
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
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-transparent transition cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {onEditTask && (isAdmin || user?.role === 'Manager' || Number(task.assigned_by) === Number(user?.id)) && (
                      <button
                        onClick={() => onEditTask(task)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-amber-700 dark:text-amber-300 border border-slate-300 dark:border-transparent transition cursor-pointer"
                        title="Edit Task"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onDeleteTask && (isAdmin || Number(task.assigned_by) === Number(user?.id)) && (
                      <button
                        onClick={() => onDeleteTask(task)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-transparent transition cursor-pointer"
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
