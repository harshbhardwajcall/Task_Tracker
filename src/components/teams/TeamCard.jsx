import React from 'react';
import {
  Users,
  Briefcase,
  Shield,
  Calendar,
  Edit2,
  Eye,
  Trash2,
  UserPlus,
  Share2
} from 'lucide-react';

export default function TeamCard({
  team,
  onView,
  onEdit,
  onDelete,
  onAddMember,
  onShareProject
}) {
  const teamIdDisplay = team.team_code || `TM-${String(team.id).padStart(4, '0')}`;
  const createdDateFormatted = team.created_at
    ? new Date(team.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'Recent';

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between space-y-4">
      {/* Top Row: Team ID, Project ID, Department, View, Edit, Delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Team ID (High contrast in dark and light modes) */}
          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700">
            {teamIdDisplay}
          </span>

          {/* Project ID (High contrast visible in dark mode) */}
          {(team.project_id || team.project_ids) && (
            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-900/80 dark:text-emerald-200 dark:border-emerald-600/80">
              PRJ-{String(team.project_id || team.project_ids.split(',')[0]).padStart(3, '0')}
            </span>
          )}

          {/* Department Badge if any */}
          {team.department_name && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-900/60 dark:text-sky-200 dark:border-sky-700/60">
              {team.department_name}
            </span>
          )}

          {/* Co-Managed Badge if squad works on a shared project */}
          {Boolean(team.is_co_managed_squad) && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-900/60 dark:text-purple-200 dark:border-purple-700/60 flex items-center gap-1">
              <Share2 className="w-2.5 h-2.5" />
              <span>Co-Managed</span>
            </span>
          )}
        </div>

        {/* Action Icons: Share, View, Edit, Delete */}
        <div className="flex items-center gap-1">
          {/* Share Project with other managers */}
          {(team.project_id || team.project_ids) && (
            <button
              type="button"
              onClick={() => onShareProject && onShareProject(team)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 dark:text-zinc-400 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition cursor-pointer"
              title="Share Project with other Managers"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onView && onView(team)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
            title="View Squad Details"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onEdit && onEdit(team)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 dark:text-zinc-400 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition cursor-pointer"
            title="Edit Squad"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onDelete && onDelete(team)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
            title="Delete Squad"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Team Name or Project Name (if both show project name and team name in a small font) */}
      <div className="space-y-1">
        {team.project_names && team.name ? (
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 leading-snug">
              <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{team.project_names}</span>
            </h3>
            <div className="text-xs font-semibold text-slate-500 dark:text-neutral-400 flex items-center gap-1 mt-0.5">
              <Users className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>{team.name}</span>
            </div>
          </div>
        ) : team.project_names ? (
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 leading-snug">
            <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{team.project_names}</span>
          </h3>
        ) : (
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 leading-snug">
            <Users className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>{team.name}</span>
          </h3>
        )}

        {/* Description of Team */}
        <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed pt-1">
          {team.description || 'No description provided for this team.'}
        </p>
      </div>

      {/* Team Lead & No of Team Members */}
      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 grid grid-cols-2 gap-2 text-xs">
        {/* Team Lead */}
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
          <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="truncate">
            Lead: <strong className="font-semibold text-slate-900 dark:text-white">{team.manager_name || 'Unassigned'}</strong>
          </span>
        </div>

        {/* No of Team Members */}
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
          <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
          <span>
            <strong className="font-semibold text-slate-900 dark:text-white">{team.total_members || 0}</strong> Members
          </span>
        </div>
      </div>

      {/* Team Tasks Status Breakdown (In Progress, On Hold, Completed, Not Started) */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-zinc-400">
          <span className="uppercase tracking-wider">Team Tasks Status</span>
          <span className="text-slate-800 dark:text-zinc-200 font-extrabold">{team.total_tasks || 0} Total</span>
        </div>

        {/* Multi-segment visual progress bar */}
        {(team.total_tasks || 0) > 0 && (
          <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${Math.round(((team.completed_tasks || 0) / team.total_tasks) * 100)}%` }}
              className="bg-emerald-500 h-full"
              title={`Completed: ${team.completed_tasks || 0}`}
            />
            <div
              style={{ width: `${Math.round(((team.in_progress_tasks || 0) / team.total_tasks) * 100)}%` }}
              className="bg-sky-500 h-full"
              title={`In Progress: ${team.in_progress_tasks || 0}`}
            />
            <div
              style={{ width: `${Math.round(((team.on_hold_tasks || 0) / team.total_tasks) * 100)}%` }}
              className="bg-amber-500 h-full"
              title={`On Hold: ${team.on_hold_tasks || 0}`}
            />
            <div
              style={{ width: `${Math.round(((team.not_started_tasks || 0) / team.total_tasks) * 100)}%` }}
              className="bg-slate-300 dark:bg-zinc-600 h-full"
              title={`Not Started: ${team.not_started_tasks || 0}`}
            />
          </div>
        )}

        {/* 4 Status Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-[10px]">
          {/* In Progress */}
          <div className="p-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50">
            <span className="text-slate-500 dark:text-zinc-400 block text-[9px] uppercase font-semibold">In Progress</span>
            <span className="font-extrabold text-sky-700 dark:text-sky-300 text-xs">{team.in_progress_tasks || 0}</span>
          </div>

          {/* On Hold */}
          <div className="p-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
            <span className="text-slate-500 dark:text-zinc-400 block text-[9px] uppercase font-semibold">On Hold</span>
            <span className="font-extrabold text-amber-700 dark:text-amber-300 text-xs">{team.on_hold_tasks || 0}</span>
          </div>

          {/* Completed */}
          <div className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
            <span className="text-slate-500 dark:text-zinc-400 block text-[9px] uppercase font-semibold">Completed</span>
            <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-xs">{team.completed_tasks || 0}</span>
          </div>

          {/* Not Started */}
          <div className="p-1 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <span className="text-slate-500 dark:text-zinc-400 block text-[9px] uppercase font-semibold">Not Started</span>
            <span className="font-extrabold text-slate-700 dark:text-zinc-300 text-xs">{team.not_started_tasks || 0}</span>
          </div>
        </div>

        {team.overdue_tasks > 0 && (
          <div className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-[10px] text-rose-700 dark:text-rose-300 font-bold flex items-center justify-between">
            <span>🚨 Overdue tasks:</span>
            <span className="font-extrabold text-rose-600 dark:text-rose-400">{team.overdue_tasks}</span>
          </div>
        )}
      </div>

      {/* Bottom Footer Row: Team Creation Date & Quick Actions */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Team Creation Date */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
          <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
          <span>Created {createdDateFormatted}</span>
        </div>

        {/* Quick Action: Add Member */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAddMember && onAddMember(team)}
            className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 font-semibold flex items-center gap-1 text-[11px] transition cursor-pointer"
          >
            <UserPlus className="w-3 h-3" />
            <span>Add Member</span>
          </button>
        </div>
      </div>
    </div>
  );
}
