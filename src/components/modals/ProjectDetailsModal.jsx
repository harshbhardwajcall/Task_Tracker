import React from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, X } from 'lucide-react';

export default function ProjectDetailsModal({ isOpen = true, project, onClose }) {
  if (!isOpen || !project) return null;

  const createdDate = project.assigned_at || project.created_at
    ? new Date(project.assigned_at || project.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'Active';

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/60 dark:bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-lg my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4.5 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Project Details: {project.name}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Meta bar */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 block">Department</span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                {project.department_name || 'Global Department'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 block">Created / Assigned</span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                {createdDate}
              </span>
            </div>
          </div>

          {/* KPI Task Cards */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Total</div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">{project.total_tasks || 0}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50">
              <div className="text-[10px] font-bold text-sky-700 dark:text-sky-300 uppercase">Active</div>
              <div className="text-base font-extrabold text-sky-900 dark:text-sky-300 mt-0.5">{project.in_progress_tasks || 0}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Done</div>
              <div className="text-base font-extrabold text-emerald-900 dark:text-emerald-300 mt-0.5">{project.completed_tasks || 0}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50">
              <div className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase">Overdue</div>
              <div className="text-base font-extrabold text-rose-900 dark:text-rose-400 mt-0.5">{project.overdue_tasks || 0}</div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="font-bold text-slate-800 dark:text-slate-200 block">Project Scope & Description</label>
            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 leading-relaxed min-h-[60px]">
              {project.description || 'No description provided for this project.'}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn-primary text-xs"
            >
              Close Details
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
