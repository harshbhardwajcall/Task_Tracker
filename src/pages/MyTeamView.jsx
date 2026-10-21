import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ViewProjectModal, TaskDetailsModal, StatusBadge, PriorityBadge } from '../components';
import {
  Users,
  Briefcase,
  Building,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  ExternalLink,
  Link2,
  Mail,
  User,
  Sparkles,
  RefreshCw,
  FolderKanban,
  CheckSquare,
  AlertCircle,
  FileText,
  Eye
} from 'lucide-react';

export default function MyTeamView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allocationData, setAllocationData] = useState({
    teams: [],
    projects: [],
    tasks: [],
    teammates: [],
    summary: { total_teams: 0, total_projects: 0, total_teammates: 0, pending_tasks: 0 }
  });
  const [activeTab, setActiveTab] = useState('teams'); // 'teams' | 'projects' | 'teammates' | 'tasks'
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskFilter, setTaskFilter] = useState('all'); // 'all' | 'mine' | 'teammates'

  const fetchAllocation = async () => {
    try {
      setLoading(true);
      const res = await api.getMyTeamAllocation();
      if (res) {
        setAllocationData({
          teams: res.teams || [],
          projects: res.projects || [],
          tasks: res.tasks || [],
          teammates: res.teammates || [],
          summary: res.summary || {
            total_teams: (res.teams || []).length,
            total_projects: (res.projects || []).length,
            total_teammates: (res.teammates || []).length,
            pending_tasks: (res.tasks || []).filter(t => t.status !== 'Completed' && t.is_my_task).length
          }
        });
      }
    } catch (err) {
      console.error('Failed fetching team allocation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllocation();
  }, [user?.id]);

  const { teams, projects, tasks, teammates, summary } = allocationData;

  const filteredTasks = tasks.filter((task) => {
    if (taskFilter === 'mine') return Boolean(task.is_my_task);
    if (taskFilter === 'teammates') return !task.is_my_task;
    return true;
  });

  // Helper to parse project links JSON or strings
  const parseProjectLinks = (linksRaw) => {
    if (!linksRaw) return [];
    try {
      const parsed = JSON.parse(linksRaw);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => {
            if (typeof item === 'string') return { url: item.trim(), remark: '' };
            return {
              url: (item.url || '').trim(),
              remark: (item.remark || item.title || '').trim()
            };
          })
          .filter(l => l.url || l.remark);
      }
    } catch {
      return linksRaw
        .split(/[\r\n,]+/)
        .map(l => l.trim())
        .filter(Boolean)
        .map(url => ({ url, remark: '' }));
    }
    return [];
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-sky-500/10 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  My Team & Project Allocation
                </h1>
                <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
                  Assigned squads, projects, and team members for {user?.name} ({user?.role || 'Employee'})
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchAllocation}
            disabled={loading}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-xs font-bold text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white transition shadow-sm active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* 4 KPI Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
          {/* Total Squads */}
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-500 shrink-0">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-neutral-400">Assigned Squads</p>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{summary.total_teams}</h3>
            </div>
          </div>

          {/* Assigned Projects */}
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-500 shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-neutral-400">Allocated Projects</p>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{summary.total_projects}</h3>
            </div>
          </div>

          {/* Teammates */}
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-500 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-neutral-400">Squad Teammates</p>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{summary.total_teammates}</h3>
            </div>
          </div>

          {/* Pending Tasks */}
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500 shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-neutral-400">My Active Tasks</p>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{summary.pending_tasks}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 border-b border-slate-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveTab('teams')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition duration-150 cursor-pointer ${
            activeTab === 'teams'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FolderKanban className="w-3.5 h-3.5" />
          <span>My Squads ({teams.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition duration-150 cursor-pointer ${
            activeTab === 'projects'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Allocated Projects ({projects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('teammates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition duration-150 cursor-pointer ${
            activeTab === 'teammates'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Teammates Roster ({teammates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition duration-150 cursor-pointer ${
            activeTab === 'tasks'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>My Project Deliverables ({tasks.length})</span>
        </button>
      </div>

      {/* Loading Spinner */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium">Loading your team allocation...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: TEAMS & SQUADS */}
          {activeTab === 'teams' && (
            <div className="space-y-6">
              {teams.length === 0 ? (
                <div className="glass-panel p-10 text-center rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center mx-auto text-slate-400 dark:text-neutral-500">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">No Squad Assigned Yet</h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
                    You have not been added to a squad yet. Once your Manager or Administrator allocates you to a team, your teammates and allocated projects will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className="glass-panel rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-md overflow-hidden"
                    >
                      {/* Squad Header */}
                      <div className="p-5 sm:p-6 bg-slate-50/70 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                              {team.name}
                            </h2>
                            {team.team_code && (
                              <span className="px-2 py-0.5 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30 text-[10px] font-mono font-bold">
                                {team.team_code}
                              </span>
                            )}
                            {team.department_name && (
                              <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-neutral-300 text-[10px] font-medium flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {team.department_name}
                              </span>
                            )}
                          </div>
                          {team.description && (
                            <p className="text-xs text-slate-600 dark:text-neutral-400">
                              {team.description}
                            </p>
                          )}
                        </div>

                        {/* Manager / Lead Badge */}
                        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shrink-0">
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-500/30">
                            {team.manager_avatar ? (
                              <img src={team.manager_avatar} alt={team.manager_name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{team.manager_name ? team.manager_name.charAt(0).toUpperCase() : 'M'}</span>
                            )}
                          </div>
                          <div className="text-left text-xs">
                            <p className="font-bold text-slate-900 dark:text-white leading-tight">
                              {team.manager_name || 'Assigned Lead'}
                            </p>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold uppercase">
                              Team Manager
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Squad Body: Allocated Projects & Teammates */}
                      <div className="p-5 sm:p-6 space-y-6">
                        {/* Allocated Projects in this Squad */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-purple-400" />
                              <span>Allocated Projects ({team.projects?.length || 0})</span>
                            </h3>
                          </div>

                          {(!team.projects || team.projects.length === 0) ? (
                            <p className="text-xs text-slate-500 dark:text-neutral-400 italic">
                              No projects allocated to this squad yet.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                              {team.projects.map((proj) => {
                                const links = parseProjectLinks(proj.links);
                                return (
                                  <div
                                    key={proj.id}
                                    className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2.5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-zinc-700 transition"
                                  >
                                    <div>
                                      <div className="flex items-start justify-between gap-2">
                                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                                          {proj.name}
                                        </h4>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedProject(proj)}
                                          className="px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 text-[10px] font-bold cursor-pointer shrink-0 flex items-center gap-1 transition active:scale-95 shadow-2xs"
                                          title="View project details (name, description, links, remarks)"
                                        >
                                          <Eye className="w-3 h-3 text-sky-500" />
                                          <span>View</span>
                                        </button>
                                      </div>
                                      <p className="text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-2 mt-0.5">
                                        {proj.description || 'No project description provided.'}
                                      </p>
                                    </div>

                                    {/* Project Quick Links */}
                                    {links.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 pt-1">
                                        {links.slice(0, 3).map((l, idx) => (
                                          <a
                                            key={idx}
                                            href={l.url.startsWith('http') ? l.url : `https://${l.url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 text-[10px] font-medium"
                                            title={l.url}
                                          >
                                            <Link2 className="w-2.5 h-2.5" />
                                            <span className="truncate max-w-[90px]">{l.remark || 'Resource'}</span>
                                            <ExternalLink className="w-2.5 h-2.5" />
                                          </a>
                                        ))}
                                      </div>
                                    )}

                                    {/* Tasks Breakdown (In Progress, On Hold, Completed, Not Started) */}
                                    <div className="pt-2 border-t border-slate-200 dark:border-zinc-800/80 space-y-1.5">
                                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-neutral-400">
                                        <span className="uppercase tracking-wider">Tasks Status</span>
                                        <span className="text-slate-900 dark:text-white font-extrabold">{proj.total_tasks || 0} Total</span>
                                      </div>

                                      {(proj.total_tasks || 0) > 0 && (
                                        <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden flex">
                                          <div
                                            style={{ width: `${Math.round(((proj.completed_tasks || 0) / proj.total_tasks) * 100)}%` }}
                                            className="bg-emerald-500 h-full"
                                            title={`Completed: ${proj.completed_tasks || 0}`}
                                          />
                                          <div
                                            style={{ width: `${Math.round(((proj.in_progress_tasks || 0) / proj.total_tasks) * 100)}%` }}
                                            className="bg-sky-500 h-full"
                                            title={`In Progress: ${proj.in_progress_tasks || 0}`}
                                          />
                                          <div
                                            style={{ width: `${Math.round(((proj.on_hold_tasks || 0) / proj.total_tasks) * 100)}%` }}
                                            className="bg-amber-500 h-full"
                                            title={`On Hold: ${proj.on_hold_tasks || 0}`}
                                          />
                                          <div
                                            style={{ width: `${Math.round(((proj.not_started_tasks || 0) / proj.total_tasks) * 100)}%` }}
                                            className="bg-slate-300 dark:bg-zinc-600 h-full"
                                            title={`Not Started: ${proj.not_started_tasks || 0}`}
                                          />
                                        </div>
                                      )}

                                      <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                                        <div className="p-1 rounded-md bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50">
                                          <span className="text-slate-500 dark:text-zinc-400 block text-[8px] uppercase font-semibold">Prog</span>
                                          <span className="font-extrabold text-sky-700 dark:text-sky-300 text-[11px]">{proj.in_progress_tasks || 0}</span>
                                        </div>
                                        <div className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
                                          <span className="text-slate-500 dark:text-zinc-400 block text-[8px] uppercase font-semibold">Hold</span>
                                          <span className="font-extrabold text-amber-700 dark:text-amber-300 text-[11px]">{proj.on_hold_tasks || 0}</span>
                                        </div>
                                        <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                                          <span className="text-slate-500 dark:text-zinc-400 block text-[8px] uppercase font-semibold">Done</span>
                                          <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-[11px]">{proj.completed_tasks || 0}</span>
                                        </div>
                                        <div className="p-1 rounded-md bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                                          <span className="text-slate-500 dark:text-zinc-400 block text-[8px] uppercase font-semibold">New</span>
                                          <span className="font-extrabold text-slate-700 dark:text-zinc-300 text-[11px]">{proj.not_started_tasks || 0}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Teammates List */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                              <Users className="w-4 h-4 text-emerald-400" />
                              <span>Squad Members ({team.members?.length || 0})</span>
                            </h3>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {(team.members || []).map((m) => {
                              const isSelf = m.user_id === user?.id;
                              return (
                                <div
                                  key={m.user_id}
                                  className={`p-3 rounded-2xl border transition flex items-center gap-3 ${
                                    isSelf
                                      ? 'bg-sky-50/70 dark:bg-sky-950/20 border-sky-500/40 shadow-xs'
                                      : 'bg-slate-50 dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800'
                                  }`}
                                >
                                  {/* Avatar */}
                                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
                                    {m.avatar ? (
                                      <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span>{m.name ? m.name.charAt(0).toUpperCase() : 'U'}</span>
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                        {m.name}
                                      </p>
                                      {isSelf && (
                                        <span className="px-1 py-0.2 rounded bg-sky-500/20 text-sky-500 dark:text-sky-300 text-[9px] font-black uppercase">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-neutral-400 truncate">
                                      {m.title || m.role}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1 text-[9px]">
                                      <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-neutral-300 font-medium">
                                        {m.role_in_team || 'Member'}
                                      </span>
                                      <span className="text-slate-400">
                                        {m.active_tasks || 0} active
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ALLOCATED PROJECTS */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              {projects.length === 0 ? (
                <div className="glass-panel p-10 text-center rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center mx-auto text-slate-400 dark:text-neutral-500">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">No Projects Allocated Yet</h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
                    You have no projects assigned to you or your squad yet. Once tasks or projects are allocated, you will see all repositories and specifications here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((proj) => {
                    const links = parseProjectLinks(proj.links);
                    return (
                      <div
                        key={proj.id}
                        className="glass-panel p-5 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-md flex flex-col justify-between space-y-4 hover:border-sky-500/40 transition"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold text-sky-500 dark:text-sky-400 uppercase tracking-wider block">
                                {proj.department_name || 'General'}
                              </span>
                              <h3
                                className="text-sm font-bold text-slate-900 dark:text-white hover:text-sky-500 cursor-pointer transition"
                                onClick={() => setSelectedProject(proj)}
                              >
                                {proj.name}
                              </h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedProject(proj)}
                              className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                              title="View project details (name, description, links, remarks)"
                            >
                              <Eye className="w-3.5 h-3.5 text-sky-500" />
                              <span>View Details</span>
                            </button>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-neutral-400 line-clamp-3">
                            {proj.description || 'No detailed description provided.'}
                          </p>

                          {/* Quick Links with Past Link and Remarks */}
                          {links.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-zinc-800">
                              <p className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                                Project Links & Past References
                              </p>
                              <div className="flex flex-col gap-1">
                                {links.map((l, idx) => (
                                  <a
                                    key={idx}
                                    href={l.url.startsWith('http') ? l.url : `https://${l.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-zinc-900/80 hover:bg-sky-500/10 text-slate-700 dark:text-neutral-300 hover:text-sky-400 text-[11px] transition"
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <Link2 className="w-3 h-3 text-sky-400 shrink-0" />
                                      <span className="font-semibold truncate">{l.remark || 'Project Link'}</span>
                                    </div>
                                    <ExternalLink className="w-3 h-3 opacity-60 shrink-0 ml-1" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Tasks Breakdown (In Progress, On Hold, Completed, Not Started) */}
                        <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-neutral-400">
                            <span className="uppercase tracking-wider">Project Tasks Status</span>
                            <span className="text-slate-900 dark:text-white font-extrabold">{proj.total_tasks || 0} Total</span>
                          </div>

                          {(proj.total_tasks || 0) > 0 && (
                            <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden flex">
                              <div
                                style={{ width: `${Math.round(((proj.completed_tasks || 0) / proj.total_tasks) * 100)}%` }}
                                className="bg-emerald-500 h-full"
                                title={`Completed: ${proj.completed_tasks || 0}`}
                              />
                              <div
                                style={{ width: `${Math.round(((proj.in_progress_tasks || 0) / proj.total_tasks) * 100)}%` }}
                                className="bg-sky-500 h-full"
                                title={`In Progress: ${proj.in_progress_tasks || 0}`}
                              />
                              <div
                                style={{ width: `${Math.round(((proj.on_hold_tasks || 0) / proj.total_tasks) * 100)}%` }}
                                className="bg-amber-500 h-full"
                                title={`On Hold: ${proj.on_hold_tasks || 0}`}
                              />
                              <div
                                style={{ width: `${Math.round(((proj.not_started_tasks || 0) / proj.total_tasks) * 100)}%` }}
                                className="bg-slate-300 dark:bg-zinc-600 h-full"
                                title={`Not Started: ${proj.not_started_tasks || 0}`}
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                            <div className="p-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50">
                              <span className="text-slate-500 dark:text-zinc-400 block text-[9px] uppercase font-semibold">Prog</span>
                              <span className="font-extrabold text-sky-700 dark:text-sky-300 text-xs">{proj.in_progress_tasks || 0}</span>
                            </div>
                            <div className="p-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
                              <span className="text-slate-500 dark:text-zinc-400 block text-[9px] uppercase font-semibold">Hold</span>
                              <span className="font-extrabold text-amber-700 dark:text-amber-300 text-xs">{proj.on_hold_tasks || 0}</span>
                            </div>
                            <div className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                              <span className="text-slate-500 dark:text-zinc-400 block text-[9px] uppercase font-semibold">Done</span>
                              <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-xs">{proj.completed_tasks || 0}</span>
                            </div>
                            <div className="p-1 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                              <span className="text-slate-500 dark:text-zinc-400 block text-[9px] uppercase font-semibold">New</span>
                              <span className="font-extrabold text-slate-700 dark:text-zinc-300 text-xs">{proj.not_started_tasks || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TEAMMATES ROSTER */}
          {activeTab === 'teammates' && (
            <div className="space-y-4">
              {teammates.length === 0 ? (
                <div className="glass-panel p-10 text-center rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center mx-auto text-slate-400 dark:text-neutral-500">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">No Teammates Found</h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
                    You currently have no colleagues assigned to your squads.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {teammates.map((m) => (
                    <div
                      key={m.user_id}
                      className="glass-panel p-4 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-slate-300 dark:hover:border-zinc-700 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl overflow-hidden bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                          {m.avatar ? (
                            <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{m.name ? m.name.charAt(0).toUpperCase() : 'U'}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {m.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                            {m.title || m.role}
                          </p>
                          <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-neutral-300">
                            {m.role}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-neutral-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[120px]">{m.email}</span>
                        </span>
                        <span className="font-semibold text-sky-500">
                          {m.active_tasks || 0} tasks
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SHARED PROJECT DELIVERABLES */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              {/* Filter Pills for Tasks Tab */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400">
                    Filter Deliverables:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTaskFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        taskFilter === 'all'
                          ? 'bg-sky-500 text-white shadow-xs'
                          : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-zinc-700'
                      }`}
                    >
                      All Shared Tasks ({tasks.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskFilter('mine')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        taskFilter === 'mine'
                          ? 'bg-sky-500 text-white shadow-xs'
                          : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-zinc-700'
                      }`}
                    >
                      My Tasks ({tasks.filter(t => t.is_my_task).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskFilter('teammates')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        taskFilter === 'teammates'
                          ? 'bg-sky-500 text-white shadow-xs'
                          : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-zinc-700'
                      }`}
                    >
                      Teammates' Tasks ({tasks.filter(t => !t.is_my_task).length})
                    </button>
                  </div>
                </div>

                <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium">
                  Showing tasks for shared projects in your squad
                </span>
              </div>

              {filteredTasks.length === 0 ? (
                <div className="glass-panel p-10 text-center rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center mx-auto text-slate-400 dark:text-neutral-500">
                    <CheckSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">No Deliverables Found</h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
                    {taskFilter === 'teammates'
                      ? "No teammate tasks found under your shared projects."
                      : taskFilter === 'mine'
                      ? "You currently have no tasks assigned to you within these projects."
                      : "No deliverables assigned under your squad's projects yet."}
                  </p>
                </div>
              ) : (
                <div className="glass-panel rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                          <th className="py-3 px-4">Task Details</th>
                          <th className="py-3 px-4">Project</th>
                          <th className="py-3 px-4">Assigned To</th>
                          <th className="py-3 px-4">Priority</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Due Date</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                        {filteredTasks.map((task) => (
                          <tr
                            key={task.id}
                            className={`transition cursor-pointer ${
                              task.is_my_task
                                ? 'bg-sky-50/40 dark:bg-sky-950/15 hover:bg-sky-50 dark:hover:bg-sky-950/30'
                                : 'hover:bg-slate-50/80 dark:hover:bg-zinc-900/40'
                            }`}
                            onClick={() => setSelectedTaskId(task.id)}
                          >
                            <td className="py-3 px-4">
                              <p className="font-bold text-slate-900 dark:text-white">
                                {task.title}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {task.task_id}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-700 dark:text-neutral-300">
                                {task.project_name}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg overflow-hidden bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                                  {task.assigned_to_avatar ? (
                                    <img src={task.assigned_to_avatar} alt={task.assigned_to_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{task.assigned_to_name ? task.assigned_to_name.charAt(0).toUpperCase() : 'U'}</span>
                                  )}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-white text-xs block leading-tight">
                                    {task.assigned_to_name || 'Unassigned'}
                                  </span>
                                  {task.is_my_task ? (
                                    <span className="text-[9px] font-extrabold text-sky-500 uppercase">
                                      You
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-400">
                                      Teammate
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <PriorityBadge priority={task.priority} />
                            </td>
                            <td className="py-3 px-4">
                              <StatusBadge status={task.status} />
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-neutral-400">
                              {task.due_date || 'No deadline'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTaskId(task.id);
                                }}
                                className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-sky-50 dark:bg-zinc-800 dark:hover:bg-sky-950/40 text-slate-700 dark:text-neutral-300 hover:text-sky-500 dark:hover:text-sky-400 border border-slate-200 dark:border-zinc-700 text-[10px] font-bold transition flex items-center gap-1 ml-auto cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>View</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Project Details Modal */}
      {selectedProject && (
        <ViewProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onEdit={null}
        />
      )}

      {/* Task Details Modal */}
      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdated={() => {
            fetchAllocation();
            setSelectedTaskId(null);
          }}
        />
      )}
    </div>
  );
}
