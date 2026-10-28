import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/services/api';
import {
  Users,
  Briefcase,
  Building,
  Plus,
  X,
  UserPlus,
  Shield,
  CheckCircle2,
  Link2,
  Trash2
} from 'lucide-react';

export default function CreateTeamModal({
  isOpen = true,
  onClose,
  onSuccess,
  employees: propEmployees,
  projects: propProjects,
  departments: propDepartments
}) {
  // If not open, render nothing
  if (!isOpen) return null;

  // Local data lists (fallback if not passed from parent)
  const [employees, setEmployees] = useState(propEmployees || []);
  const [projects, setProjects] = useState(propProjects || []);
  const [departments, setDepartments] = useState(propDepartments || []);

  // Form State
  const [hiddenTeamId, setHiddenTeamId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [teamLeadId, setTeamLeadId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [description, setDescription] = useState('');
  const [projectLinks, setProjectLinks] = useState([{ title: '', url: '' }]);

  // Draft Members State
  const [draftMembers, setDraftMembers] = useState([]);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState('Member');

  // Request State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddLink = () => {
    setProjectLinks(prev => [...prev, { title: '', url: '' }]);
  };

  const handleUpdateLink = (index, field, value) => {
    setProjectLinks(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleRemoveLink = (index) => {
    setProjectLinks(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.length > 0 ? filtered : [{ title: '', url: '' }];
    });
  };

  // Initialize unique hidden team ID on mount
  useEffect(() => {
    setHiddenTeamId('TM-' + Math.floor(1000 + Math.random() * 9000));
  }, []);

  // Fetch lists if not provided via props
  useEffect(() => {
    let isMounted = true;
    const fetchMissingData = async () => {
      try {
        const promises = [];
        if (!propEmployees || propEmployees.length === 0) promises.push(api.getEmployees());
        if (!propProjects || propProjects.length === 0) promises.push(api.getProjects());
        if (!propDepartments || propDepartments.length === 0) promises.push(api.getDepartments());

        if (promises.length > 0) {
          const results = await Promise.all(promises);
          let idx = 0;
          if (!propEmployees || propEmployees.length === 0) {
            if (isMounted) setEmployees(results[idx]?.employees || []);
            idx++;
          }
          if (!propProjects || propProjects.length === 0) {
            if (isMounted) setProjects(results[idx]?.projects || []);
            idx++;
          }
          if (!propDepartments || propDepartments.length === 0) {
            if (isMounted) setDepartments(results[idx]?.departments || []);
            idx++;
          }
        }
      } catch (err) {
        console.error('Failed to load auxiliary options for CreateTeamModal:', err);
      }
    };

    fetchMissingData();
    return () => {
      isMounted = false;
    };
  }, [propEmployees, propProjects, propDepartments]);

  const handleProjectSelect = (pId) => {
    setProjectId(pId);
    if (pId) {
      const proj = projects.find(p => p.id === Number(pId));
      if (proj) {
        if (!teamName.trim()) {
          setTeamName(`${proj.name} Squad`);
        }
        if (!departmentId && proj.department_id) {
          setDepartmentId(String(proj.department_id));
        }
        if (proj.links) {
          try {
            const parsed = typeof proj.links === 'string' ? JSON.parse(proj.links) : proj.links;
            if (Array.isArray(parsed) && parsed.length > 0) {
              setProjectLinks(parsed.map(l => ({
                url: typeof l === 'string' ? l : (l.url || ''),
                title: typeof l === 'string' ? '' : (l.title || l.remark || '')
              })));
            }
          } catch (e) {
            // keep existing links
          }
        }
      }
    }
  };

  const handleAddDraftMember = (e) => {
    if (e) e.preventDefault();
    if (!memberUserId) return;

    const uId = Number(memberUserId);
    if (draftMembers.some(m => m.user_id === uId)) {
      setError('This staff member is already added to the squad draft.');
      return;
    }

    const emp = employees.find(e => e.id === uId);
    setDraftMembers(prev => [
      ...prev,
      {
        user_id: uId,
        user_name: emp ? emp.name : `Member #${uId}`,
        user_title: emp ? (emp.title || emp.role) : '',
        department_name: emp ? emp.department_name : '',
        role_in_team: memberRole.trim() || 'Member'
      }
    ]);

    // If role is Lead and no team lead is assigned yet, pre-assign this user as Team Lead
    if (memberRole === 'Lead' && !teamLeadId) {
      setTeamLeadId(String(uId));
    }

    setMemberUserId('');
    setMemberRole('Member');
    setError('');
  };

  const handleRemoveDraftMember = (userId) => {
    setDraftMembers(prev => prev.filter(m => m.user_id !== userId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const finalName = teamName.trim() || (projectId ? `${projects.find(p => p.id === Number(projectId))?.name || 'Project'} Squad` : '');

    if (!finalName) {
      return setError('Please enter a Squad Name or select a Project.');
    }

    try {
      setLoading(true);

      const validLinks = projectLinks
        .map(l => ({ url: (l.url || '').trim(), title: (l.title || '').trim(), remark: (l.title || '').trim() }))
        .filter(l => l.url || l.title);
      const serializedLinks = validLinks.length > 0 ? JSON.stringify(validLinks) : '';

      const res = await api.createTeam({
        team_id: hiddenTeamId,
        team_code: hiddenTeamId,
        name: finalName,
        project_id: projectId ? Number(projectId) : null,
        links: serializedLinks,
        description: description.trim(),
        department_id: departmentId ? Number(departmentId) : null,
        manager_id: teamLeadId ? Number(teamLeadId) : null,
        members: draftMembers.map(m => ({
          user_id: m.user_id,
          role_in_team: m.role_in_team || 'Member'
        }))
      });

      if (onSuccess) {
        onSuccess(res.team);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create team.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 dark:bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-xl max-h-[90vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header (Fixed) */}
        <div className="shrink-0 p-4.5 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Create New Squad</span>
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

        {/* Scrollable Form Body */}
        <form id="create-team-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Hidden Team ID Field */}
          <input type="hidden" name="team_id" value={hiddenTeamId} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Team Name */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-800 dark:text-slate-200 block">
                Squad Name <span className="text-slate-400 font-normal">(or pick project)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Core Platform Squad"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="input-field py-2 text-xs"
              />
            </div>

            {/* Project Name (Choose Project) */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-800 dark:text-slate-200 block">
                Project Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <select
                value={projectId}
                onChange={(e) => handleProjectSelect(e.target.value)}
                className="input-field py-2 text-xs"
              >
                <option value="">-- Choose Project (Optional) --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.department_name ? `(${p.department_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Team Lead */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-800 dark:text-slate-200 block">
                Team Lead <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <select
                value={teamLeadId}
                onChange={(e) => setTeamLeadId(e.target.value)}
                className="input-field py-2 text-xs"
              >
                <option value="">-- Assign Team Lead (Optional) --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.title || emp.role} - {emp.department_name || 'Global'})
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-800 dark:text-slate-200 block">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
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
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-800 dark:text-slate-200 block">Squad Description</label>
            <input
              type="text"
              placeholder="Squad focus & sprint goals..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field py-2 text-xs"
            />
          </div>

          {/* Section: Project / Resource Links */}
          <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Project / Resource Links</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  (Optional links: Figma, Docs, Repo, Roadmap)
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

          {/* Section: Option to Add Team Member */}
          <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Team Members</span>
                {draftMembers.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                    {draftMembers.length}
                  </span>
                )}
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Optionally add initial squad members
              </span>
            </div>

            {/* Add Member Controls Row */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                {/* Employee Picker */}
                <div className="sm:col-span-6">
                  <select
                    value={memberUserId}
                    onChange={(e) => setMemberUserId(e.target.value)}
                    className="input-field py-1.5 text-xs"
                  >
                    <option value="">-- Select Member / Intern --</option>
                    {employees
                      .filter(emp => !draftMembers.some(dm => dm.user_id === emp.id))
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.title || emp.role} - {emp.department_name || 'Global'})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Role Picker (Optional) */}
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

                {/* Add Member Button */}
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddDraftMember}
                    disabled={!memberUserId}
                    className="w-full h-8 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Added Members Chips / Preview */}
              {draftMembers.length > 0 ? (
                <div className="pt-2 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {draftMembers.map((m) => (
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
                        onClick={() => handleRemoveDraftMember(m.user_id)}
                        className="text-slate-400 hover:text-rose-500 transition ml-0.5"
                        title="Remove from squad"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 dark:text-zinc-500 italic">
                  No members added yet. You can add them here or assign later.
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer Actions (Fixed) */}
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
            form="create-team-modal-form"
            disabled={loading}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{loading ? 'Creating...' : 'Create Squad'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
