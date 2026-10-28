import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/services/api';
import {
  Users,
  Edit2,
  X,
  UserPlus,
  Plus,
  CheckCircle2,
  Link2,
  Trash2
} from 'lucide-react';

export default function EditTeamModal({
  isOpen = true,
  team,
  employees = [],
  departments = [],
  projects = [],
  onClose,
  onSuccess
}) {
  if (!isOpen || !team) return null;

  // Form State
  const [teamName, setTeamName] = useState(team.name || '');
  const [teamDesc, setTeamDesc] = useState(team.description || '');
  const [teamDept, setTeamDept] = useState(team.department_id ? String(team.department_id) : '');
  const [teamLead, setTeamLead] = useState(team.manager_id ? String(team.manager_id) : '');

  // Project Links State
  const [projectLinks, setProjectLinks] = useState([{ title: '', url: '' }]);
  const [linkedProjectId, setLinkedProjectId] = useState(null);

  // Members Fields (Add, Remove within modal)
  const [members, setMembers] = useState([]);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState('Member');

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddLink = () => {
    setProjectLinks(prev => [...prev, { title: '', url: '' }]);
  };

  const handleUpdateLink = (index, field, value) => {
    setProjectLinks(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleRemoveLink = (index) => {
    setProjectLinks(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.length > 0 ? filtered : [{ title: '', url: '' }];
    });
  };

  useEffect(() => {
    let isMounted = true;
    const loadSquadData = async () => {
      try {
        const res = await api.getTeam(team.id);
        if (!isMounted) return;

        if (res && res.members) {
          setMembers(res.members.map(m => ({
            user_id: m.user_id,
            user_name: m.name,
            user_title: m.title || m.role,
            role_in_team: m.role_in_team || 'Member'
          })));
        }

        // Load project links from fetched squad projects or fallback to team props
        const projList = (res && res.projects && res.projects.length > 0)
          ? res.projects
          : (team.projects && team.projects.length > 0 ? team.projects : []);

        if (projList.length > 0) {
          const primaryProject = projList[0];
          setLinkedProjectId(primaryProject.id);
          if (primaryProject.links) {
            try {
              const parsed = typeof primaryProject.links === 'string' ? JSON.parse(primaryProject.links) : primaryProject.links;
              if (Array.isArray(parsed) && parsed.length > 0) {
                setProjectLinks(parsed.map(l => ({
                  url: typeof l === 'string' ? l : (l.url || ''),
                  title: typeof l === 'string' ? '' : (l.title || l.remark || '')
                })));
              }
            } catch (err) {
              console.error('Failed to parse links in EditTeamModal:', err);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load squad details for editing:', err);
      }
    };

    loadSquadData();
    return () => {
      isMounted = false;
    };
  }, [team.id]);

  const handleAddMember = (e) => {
    if (e) e.preventDefault();
    if (!memberUserId) return;
    const uId = Number(memberUserId);
    if (members.some(m => m.user_id === uId)) {
      setError('This staff member is already in the squad roster.');
      return;
    }
    const emp = employees.find(e => e.id === uId);
    setMembers(prev => [
      ...prev,
      {
        user_id: uId,
        user_name: emp ? emp.name : `Member #${uId}`,
        user_title: emp ? (emp.title || emp.role) : '',
        role_in_team: memberRole.trim() || 'Member'
      }
    ]);
    setMemberUserId('');
    setMemberRole('Member');
    setError('');
  };

  const handleRemoveMember = (userId) => {
    setMembers(prev => prev.filter(m => m.user_id !== userId));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setError('Squad title is required.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const validLinks = projectLinks
        .map(l => ({ url: (l.url || '').trim(), title: (l.title || '').trim(), remark: (l.title || '').trim() }))
        .filter(l => l.url || l.title);
      const serializedLinks = validLinks.length > 0 ? JSON.stringify(validLinks) : '';

      await api.updateTeam(team.id, {
        name: teamName.trim(),
        description: teamDesc.trim(),
        department_id: teamDept ? Number(teamDept) : null,
        manager_id: teamLead ? Number(teamLead) : null,
        project_id: linkedProjectId || undefined,
        links: serializedLinks,
        members: members.map(m => ({
          user_id: m.user_id,
          role_in_team: m.role_in_team || 'Member'
        }))
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update squad.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 dark:bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-2xl max-h-[90vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header (Fixed) */}
        <div className="shrink-0 p-4.5 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <Edit2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Edit Squad: {team.name}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="shrink-0 mx-5 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Modal Form Body (Scrollable) */}
        <form id="edit-team-modal-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Section 1: Squad Information (Title, Team Lead, Department, Description) */}
          <div className="space-y-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Squad Information</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 dark:text-slate-200 block">Squad Title / Name *</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="input-field py-2 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 dark:text-slate-200 block">Team Lead</label>
                <select
                  value={teamLead}
                  onChange={(e) => setTeamLead(e.target.value)}
                  className="input-field py-2 text-xs"
                >
                  <option value="">Unassigned</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.title || emp.role} - {emp.department_name || 'Global'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 dark:text-slate-200 block">Department</label>
                <select
                  value={teamDept}
                  onChange={(e) => setTeamDept(e.target.value)}
                  className="input-field py-2 text-xs"
                >
                  <option value="">No Department (Global Squad)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 dark:text-slate-200 block">Squad Description</label>
                <input
                  type="text"
                  value={teamDesc}
                  onChange={(e) => setTeamDesc(e.target.value)}
                  className="input-field py-2 text-xs"
                  placeholder="Squad deliverables & focus..."
                />
              </div>
            </div>
          </div>

          {/* Section 2: Project / Resource Links */}
          <div className="space-y-2 pb-3 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Project / Resource Links</span>
                <span className="text-[10px] text-slate-400 font-normal lowercase">
                  (optional links: Figma, Docs, Repo)
                </span>
              </label>
              <button
                type="button"
                onClick={handleAddLink}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-medium text-[11px] flex items-center gap-1 cursor-pointer transition active:scale-95"
                title="Add link row"
              >
                <Plus className="w-3 h-3" />
                <span>Add Link</span>
              </button>
            </div>

            <div className="space-y-2">
              {projectLinks.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Link2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Link URL (e.g. https://... or docs.google.com)"
                      value={link.url}
                      onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                      className="input-field py-1.5 text-xs w-full transition font-mono"
                      style={{ paddingLeft: '2.25rem' }}
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="Title / Remark (e.g. Figma, Docs)"
                    value={link.title}
                    onChange={(e) => handleUpdateLink(idx, 'title', e.target.value)}
                    className="input-field py-1.5 text-xs w-32 sm:w-44 shrink-0"
                  />

                  {projectLinks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(idx)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-rose-100 dark:hover:bg-rose-950/60 hover:text-rose-600 text-slate-500 border border-slate-200 dark:border-zinc-700 hover:border-rose-300 transition cursor-pointer shrink-0"
                      title="Remove link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Members (Add & Remove) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <UserPlus className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Squad Members</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                  {members.length}
                </span>
              </h4>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                Add or remove squad members
              </span>
            </div>

            {/* Add Member Row */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <div className="sm:col-span-6">
                  <select
                    value={memberUserId}
                    onChange={(e) => setMemberUserId(e.target.value)}
                    className="input-field py-1.5 text-xs"
                  >
                    <option value="">-- Select Member / Intern --</option>
                    {employees
                      .filter(emp => !members.some(em => em.user_id === emp.id))
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.title || emp.role} - {emp.department_name || 'Global'})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="input-field py-1.5 text-xs"
                  >
                    <option value="Member">Role: Member</option>
                    <option value="Lead">Squad Lead</option>
                    <option value="Developer">Developer</option>
                    <option value="Designer">Designer</option>
                    <option value="QA">QA / Tester</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddMember}
                    disabled={!memberUserId}
                    className="w-full h-8 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Members Roster Preview / Remove */}
              {members.length > 0 ? (
                <div className="pt-2 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {members.map((m) => (
                    <div
                      key={m.user_id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 shadow-sm"
                    >
                      <span className="font-semibold">{m.user_name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-bold border border-sky-200 dark:border-sky-800">
                        {m.role_in_team}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.user_id)}
                        className="text-slate-400 hover:text-rose-500 transition ml-0.5 cursor-pointer"
                        title="Remove from squad"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 dark:text-zinc-500 italic">
                  No members assigned to this squad.
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Modal Footer (Fixed) */}
        <div className="shrink-0 p-4 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-team-modal-form"
            disabled={loading}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{loading ? 'Saving...' : 'Save All Changes'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
