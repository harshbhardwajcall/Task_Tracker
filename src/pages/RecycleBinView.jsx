import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { Trash2, RotateCcw, AlertTriangle, Clock, Calendar, CheckCircle2, ShieldAlert, RefreshCw } from 'lucide-react';

export default function RecycleBinView() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadRecycledTasks = async () => {
    try {
      setLoading(true);
      const res = await api.getRecycleBin();
      setTasks(res.tasks || []);
    } catch (err) {
      console.error('Failed loading recycle bin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecycledTasks();
  }, []);

  const handleRestore = async (task) => {
    try {
      setActionLoading(true);
      await api.restoreTask(task.id);
      setFeedback(`Task ${task.task_id} restored to dashboard!`);
      setTimeout(() => setFeedback(''), 4000);
      loadRecycledTasks();
    } catch (err) {
      alert(err.message || 'Failed to restore task.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDelete = async (task) => {
    if (window.confirm(`Permanently purge task ${task.task_id} (${task.title})? This cannot be undone.`)) {
      try {
        setActionLoading(true);
        await api.deleteTaskPermanently(task.id);
        setFeedback(`Task ${task.task_id} permanently deleted.`);
        setTimeout(() => setFeedback(''), 4000);
        loadRecycledTasks();
      } catch (err) {
        alert(err.message || 'Failed to delete task.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleEmptyBin = async () => {
    if (window.confirm('Are you sure you want to permanently delete all tasks in the recycle bin?')) {
      try {
        setActionLoading(true);
        const res = await api.emptyRecycleBin();
        setFeedback(res.message);
        setTimeout(() => setFeedback(''), 4000);
        loadRecycledTasks();
      } catch (err) {
        alert(err.message || 'Failed to empty recycle bin.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
        <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-400">Loading Recycle Bin...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <span>Recycle Bin</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-950/60 border border-rose-800/60 text-rose-300">
              {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Tasks remain in the recycle bin for 10 days before being automatically purged permanently.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {tasks.length > 0 && (
            <button
              onClick={handleEmptyBin}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-rose-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Empty Recycle Bin</span>
            </button>
          )}

          <button
            onClick={loadRecycledTasks}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-neutral-300 border border-zinc-750 text-xs font-semibold flex items-center justify-center transition cursor-pointer shadow-sm active:scale-95"
            title="Refresh Recycle Bin"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Recycled Tasks List */}
      {tasks.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl text-center space-y-3 border border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
            <Trash2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-200">Recycle Bin is Empty</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No tasks have been deleted recently. Deleted tasks are retained here for 10 days before automatic permanent removal.
          </p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Task ID & Title</th>
                  <th className="py-3 px-4">Assignee & Dept</th>
                  <th className="py-3 px-4">Priority & Status</th>
                  <th className="py-3 px-4">Deleted On</th>
                  <th className="py-3 px-4">Auto-Purge In</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {tasks.map(task => (
                  <tr key={task.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-xs">{task.task_id}</span>
                        <span className="font-semibold text-slate-200">{task.title}</span>
                      </div>
                      {task.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 max-w-md">{task.description}</p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-200">{task.assigned_to_name || 'Unassigned'}</div>
                      <div className="text-[10px] text-slate-400">{task.department_name || 'General'}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={task.priority} />
                        <StatusBadge status={task.status} />
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>{task.deleted_at ? task.deleted_at.substring(0, 16) : 'Recently'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 w-fit">
                        <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>{task.days_remaining > 0 ? `${task.days_remaining} days remaining` : 'Purging today'}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Restore Button */}
                        <button
                          onClick={() => handleRestore(task)}
                          disabled={actionLoading}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                          title="Restore to dashboard"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>

                        {/* Permanent Delete Button */}
                        <button
                          onClick={() => handlePermanentDelete(task)}
                          disabled={actionLoading}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition cursor-pointer"
                          title="Permanently delete now"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
