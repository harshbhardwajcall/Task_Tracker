import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import {
  Users,
  Briefcase,
  Shield,
  FileText,
  UserPlus,
  Trash2,
  Eye,
  Share2,
  X
} from 'lucide-react';

export default function ViewTeamModal({
  isOpen = true,
  team,
  onClose,
  onSeeProjectDetails,
  onAddMember,
  onShareProject,
  onRefresh
}) {
  if (!isOpen || !team) return null;

  const [teamDetails, setTeamDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSquadDetails = async () => {
    try {
      setLoading(true);
      const res = await api.getTeam(team.id);
      setTeamDetails(res);
    } catch (err) {
      console.error('Failed to load squad details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSquadDetails();
  }, [team.id]);

  const handleRemoveMember = async (userId) => {
    if (!confirm('Are you sure you want to remove this member from the team?')) return;
    try {
      await api.removeTeamMember(team.id, userId);
      loadSquadDetails();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to remove member.');
    }
  };

  const handleDeallocateProject = async (projectId) => {
    if (!confirm('Remove project allocation from this team?')) return;
    try {
      await api.deallocateTeamProject(team.id, projectId);
      loadSquadDetails();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to deallocate project.');
    }
  };

  const teamIdDisplay = team.team_code || `TM-${String(team.id).padStart(4, '0')}`;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 dark:bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-2xl max-h-[90vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header (Fixed) */}
        <div className="shrink-0 p-4.5 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700">
              {teamIdDisplay}
            </span>
            <div className="flex flex-col">
              {team.project_names && team.name ? (
                <>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    {team.project_names}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    {team.name}
                  </span>
                </>
              ) : (
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                  {team.project_names || team.name}
                </h3>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Option to See Project Details in View Modal */}
            {(team.project_names || (teamDetails?.projects && teamDetails.projects.length > 0)) && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const proj = teamDetails?.projects?.[0] || {
                      name: team.project_names,
                      department_name: team.department_name,
                      description: team.description || 'Project associated with this squad.'
                    };
                    if (onSeeProjectDetails) onSeeProjectDetails(proj);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center gap-1.5 font-semibold text-xs transition cursor-pointer shadow-sm"
                  title="Inspect Project Deliverables & Details"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>See Project Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const proj = teamDetails?.projects?.[0] || {
                      id: team.project_id,
                      name: team.project_names
                    };
                    if (onShareProject) onShareProject(proj);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/60 flex items-center gap-1.5 font-semibold text-xs transition cursor-pointer shadow-sm"
                  title="Share Project with other Managers"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Project</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Squad Meta Info Bar: Team Name, Project Allocated, Team Lead, Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
            {team.name && (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 block">Team Name</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block truncate">{team.name}</span>
              </div>
            )}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 block">Team Lead</span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block flex items-center gap-1 truncate">
                <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{team.manager_name || 'Unassigned'}</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 block">Project Allocated</span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block flex items-center gap-1 truncate">
                <Briefcase className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{team.project_names || 'None Allocated'}</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 block">Department</span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block truncate">{team.department_name || 'Global'}</span>
            </div>
          </div>

          {/* Description if have */}
          {team.description && (
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 block flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-sky-500" />
                <span>Squad Description</span>
              </span>
              <p className="text-slate-700 dark:text-zinc-300 leading-relaxed text-xs">
                {team.description}
              </p>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-slate-400">Loading squad roster...</div>
          ) : (
            <div className="space-y-4">
              {/* Squad Members List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <Users className="w-3.5 h-3.5 text-sky-500" />
                    <span>Squad Members ({teamDetails?.members?.length || 0})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (onAddMember) onAddMember(team);
                    }}
                    className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>+ Add Member</span>
                  </button>
                </div>

                {teamDetails?.members?.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    {teamDetails.members.map((member) => (
                      <div key={member.user_id} className="p-2.5 flex items-center justify-between bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-sky-100 dark:bg-sky-950 flex items-center justify-center font-bold text-sky-700 dark:text-sky-300 text-xs">
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{member.name}</div>
                            <div className="text-[10px] text-slate-500 dark:text-zinc-400">{member.title || member.role} • {member.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                            {member.role_in_team || 'Member'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.user_id)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                            title="Remove member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center text-slate-400">
                    No members in this squad yet.
                  </div>
                )}
              </div>

              {/* Allocated Projects List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Allocated Projects ({teamDetails?.projects?.length || 0})</span>
                  </h4>
                </div>

                {teamDetails?.projects?.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    {teamDetails.projects.map((proj) => (
                      <div key={proj.id} className="p-2.5 flex items-center justify-between bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{proj.name}</div>
                            <div className="text-[10px] text-slate-500 dark:text-zinc-400">{proj.department_name || 'Global'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (onSeeProjectDetails) onSeeProjectDetails(proj);
                            }}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 flex items-center gap-1 transition cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>See Details</span>
                          </button>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                            {proj.total_tasks || 0} Tasks
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeallocateProject(proj.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                            title="Remove project allocation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center text-slate-400">
                    No projects allocated to this squad yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer (Fixed) */}
        <div className="shrink-0 p-4 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
