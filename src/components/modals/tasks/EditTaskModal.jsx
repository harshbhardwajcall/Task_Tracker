import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { X, Save, Calendar, User, Users, Briefcase, Building, CheckSquare, Square, Clock, ShieldCheck, AlertCircle, Zap, Link as LinkIcon, Plus, Repeat, Bell } from 'lucide-react';

export default function EditTaskModal({ task, onClose, onTaskUpdated }) {
  const { user: currentUser } = useAuth();
  const canRepeat = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const [isLoop, setIsLoop] = useState(Boolean(task.is_loop));
  const [loopIntervalHours, setLoopIntervalHours] = useState(task.loop_interval_hours || 24);
  const [isCustomInterval, setIsCustomInterval] = useState(![12, 24, 48, 168].includes(Number(task.loop_interval_hours || 24)));
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDependencies, setSelectedDependencies] = useState(task.dependencies || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noDueDate, setNoDueDate] = useState(!task.due_date);

  const parseInitialLinks = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(l => l && (l.url || l.title));
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(l => l && (l.url || l.title));
    } catch { }
    return [];
  };

  const [referenceLinks, setReferenceLinks] = useState(parseInitialLinks(task.links));

  const handleAddLinkInput = () => {
    setError('');
    setReferenceLinks(prev => [...prev, { title: '', url: '' }]);
  };

  const handleUpdateLink = (index, field, value) => {
    if (error && error.toLowerCase().includes('link')) setError('');
    setReferenceLinks(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleRemoveLink = (index) => {
    if (error && error.toLowerCase().includes('link')) setError('');
    setReferenceLinks(prev => prev.filter((_, i) => i !== index));
  };

  const [formData, setFormData] = useState({
    title: task.title || '',
    description: task.description || '',
    assigned_to: task.assigned_to || '',
    project_id: task.project_id || '',
    department_id: task.department_id || '',
    start_date: task.start_date || '',
    due_date: task.due_date || '',
    priority: task.priority || 'Medium',
    status: task.status || 'Not Started',
    manager_remarks: task.manager_remarks || ''
  });

  useEffect(() => {
    async function loadMetadata() {
      try {
        const [empRes, projRes, deptRes] = await Promise.all([
          api.getEmployees(),
          api.getProjects(),
          api.getDepartments()
        ]);
        setEmployees(empRes.employees || []);
        setProjects(projRes.projects || []);
        setDepartments(deptRes.departments || []);
      } catch (err) {
        console.error('Failed to load metadata:', err);
      }
    }
    loadMetadata();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Auto update project department if project selected
    if (name === 'project_id') {
      const selectedProj = projects.find(p => String(p.id) === String(value));
      if (selectedProj && selectedProj.department_id) {
        setFormData(prev => ({ ...prev, project_id: value, department_id: selectedProj.department_id }));
        return;
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleNoDueDate = () => {
    setNoDueDate(prev => {
      const next = !prev;
      if (next) {
        setFormData(f => ({ ...f, due_date: '' }));
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) return setError('Task title is required.');
    if (!formData.description.trim()) return setError('Task description is required.');
    if (!formData.assigned_to) return setError('Please select an assigned employee.');
    if (!formData.project_id) return setError('Please select a project.');
    if (!formData.department_id) return setError('Please select a department.');
    if (!noDueDate && !formData.due_date) return setError('Please specify a due date or check "No Due Date".');
    if (!noDueDate && formData.due_date && new Date(formData.due_date) < new Date(formData.start_date)) {
      return setError('Due date cannot be earlier than start date.');
    }

    try {
      setLoading(true);
      // Filter non-empty reference links (optional)
      const validLinks = referenceLinks
        .filter(l => l && l.url && l.url.trim())
        .map(l => {
          const u = l.url.trim();
          const fullUrl = u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`;
          const title = (l.title || '').trim() || u.replace(/^https?:\/\//i, '');
          return { title, url: fullUrl };
        });
      await api.updateTask(task.id, {
        ...formData,
        due_date: noDueDate ? null : formData.due_date,
        dependencies: selectedDependencies.map(d => d.id || d),
        links: validLinks,
        ...(canRepeat ? {
          is_loop: isLoop ? 1 : 0,
          loop_interval_hours: Math.max(0.1, Number(loopIntervalHours) || 24)
        } : {})
      });

      if (onTaskUpdated) onTaskUpdated();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update task.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col bg-[#0c0c12]/95">

        {/* Header */}
        <div className="p-4 sm:p-5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-zinc-800 text-white border border-zinc-700">
              {task.task_id}
            </span>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>
                  {currentUser?.role === 'Admin' ? 'Admin Edit Task' : (currentUser?.role === 'Manager' ? 'Manager Edit Task' : 'Edit Task')}
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">Modify deliverable parameters, assignments, dependencies, and status</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-900/80 text-rose-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="font-semibold text-neutral-300 mb-1 block">
              Task Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Implement OAuth2 Social Authentication"
              className="input-field text-xs font-semibold"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="font-semibold text-neutral-300 mb-1 block">
              Detailed Scope & Deliverables *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe requirements, acceptance criteria, edge cases..."
              rows={3}
              className="input-field resize-none leading-relaxed text-xs"
              required
            />
          </div>

          {/* Assignee, Priority, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-neutral-300 flex items-center gap-1 text-xs">
                  <User className="w-3.5 h-3.5 text-neutral-400" /> Assign To *
                </label>
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, assigned_to: String(currentUser.id) }));
                      setSelectedDependencies(prev => prev.filter(d => String(d.id || d) !== String(currentUser.id)));
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition flex items-center gap-1 border cursor-pointer ${String(formData.assigned_to) === String(currentUser.id)
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30'
                        : 'bg-zinc-800 text-neutral-300 hover:text-white hover:bg-zinc-700 border-zinc-700'
                      }`}
                    title="Quickly assign this task to yourself"
                  >
                    <Zap className="w-2.5 h-2.5 text-amber-400" />
                    {String(formData.assigned_to) === String(currentUser.id) ? 'Assigned to Self' : 'Assign to Self'}
                  </button>
                )}
              </div>
              <select
                name="assigned_to"
                value={formData.assigned_to}
                onChange={(e) => {
                  handleChange(e);
                  if (e.target.value) {
                    setSelectedDependencies(prev => prev.filter(d => String(d.id || d) !== String(e.target.value)));
                  }
                }}
                className="input-field font-semibold text-xs"
                required
              >
                <option value="">Select Employee</option>
                {currentUser && (
                  <option value={currentUser.id} className="font-bold text-emerald-400">
                    ⭐ Assign to Myself ({currentUser.name})
                  </option>
                )}
                {(() => {
                  const allAssignees = [...employees];
                  if (currentUser && !allAssignees.some(e => String(e.id) === String(currentUser.id))) {
                    allAssignees.unshift({
                      id: currentUser.id,
                      name: currentUser.name,
                      email: currentUser.email,
                      role: currentUser.role,
                      title: currentUser.title || currentUser.role,
                      department_name: currentUser.department_name || 'General'
                    });
                  }
                  return allAssignees
                    .filter(emp => String(emp.id) !== String(currentUser?.id))
                    .map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.title || emp.role} • {emp.department_name || 'General'})
                      </option>
                    ));
                })()}
              </select>
            </div>

            <div>
              <label className="font-semibold text-neutral-300 mb-1 block">Priority *</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="input-field font-semibold text-xs"
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
                <option value="Critical">Critical Priority</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-neutral-300 mb-1 block">Status *</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="input-field font-semibold text-xs"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Collaborators / Co-Assignees Section */}
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="font-semibold text-neutral-200 flex items-center gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Collaborators / Co-Assignees</span>
                <span className="text-[11px] font-normal text-neutral-400">(Optional)</span>
              </label>

              {/* Add Collaborator Dropdown */}
              <div className="sm:w-64">
                {(() => {
                  const allAssignees = [...employees];
                  if (currentUser && !allAssignees.some(e => String(e.id) === String(currentUser.id))) {
                    allAssignees.unshift({
                      id: currentUser.id,
                      name: currentUser.name,
                      email: currentUser.email,
                      role: currentUser.role,
                      title: currentUser.title || currentUser.role,
                      department_name: currentUser.department_name || 'General'
                    });
                  }
                  const availableForDep = allAssignees.filter(
                    emp => String(emp.id) !== String(formData.assigned_to) &&
                      !selectedDependencies.some(d => String(d.id || d) === String(emp.id))
                  );
                  return (
                    <select
                      value=""
                      onChange={(e) => {
                        const empId = e.target.value;
                        if (!empId) return;
                        const targetEmp = allAssignees.find(emp => String(emp.id) === String(empId));
                        if (targetEmp && !selectedDependencies.some(d => String(d.id || d) === String(targetEmp.id))) {
                          setSelectedDependencies(prev => [...prev, targetEmp]);
                        }
                      }}
                      className="input-field text-xs py-1.5 bg-zinc-950 font-medium"
                    >
                      <option value="">+ Add Collaborator...</option>
                      {availableForDep.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.title || emp.role} • {emp.department_name || 'General'})
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            </div>

            {/* Selected Collaborator Tags */}
            {selectedDependencies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedDependencies.map(dep => (
                  <span
                    key={dep.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-950/70 text-cyan-200 border border-cyan-800/80 shadow-xs animate-in fade-in"
                  >
                    <span className="w-4 h-4 rounded-full bg-cyan-800 text-cyan-100 flex items-center justify-center text-[10px] font-bold">
                      {dep.name ? dep.name.charAt(0).toUpperCase() : 'U'}
                    </span>
                    <span>{dep.name}</span>
                    <span className="text-[10px] text-cyan-400 font-normal">({dep.department_name || dep.title || 'Collaborator'})</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDependencies(prev => prev.filter(d => String(d.id || d) !== String(dep.id)))}
                      className="hover:text-rose-400 transition ml-0.5 p-0.5 rounded cursor-pointer"
                      title="Remove collaborator"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Project & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-neutral-300 mb-1 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-neutral-400" /> Project *
              </label>
              <select
                name="project_id"
                value={formData.project_id}
                onChange={handleChange}
                className="input-field text-xs"
                required
              >
                <option value="">Select Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.department_name || 'General'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-neutral-300 mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-neutral-400" /> Department *
              </label>
              <select
                name="department_id"
                value={formData.department_id}
                onChange={handleChange}
                className="input-field text-xs"
                required
              >
                <option value="">Select Department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Start Date & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-neutral-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" /> Start Date *
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                onClick={(e) => {
                  try { e.target.showPicker(); } catch (err) { }
                }}
                className="input-field cursor-pointer [color-scheme:dark] text-xs"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-neutral-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Due Date {noDueDate ? '(Optional)' : '*'}</span>
                </label>
                <button
                  type="button"
                  onClick={handleToggleNoDueDate}
                  className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 hover:text-white transition cursor-pointer select-none"
                >
                  {noDueDate ? (
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-neutral-500" />
                  )}
                  <span className={noDueDate ? 'text-emerald-300 font-extrabold' : ''}>No Due Date</span>
                </button>
              </div>

              <div className="relative">
                {noDueDate ? (
                  <div
                    onClick={handleToggleNoDueDate}
                    className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-2 text-neutral-500 text-xs italic flex items-center justify-between cursor-pointer hover:border-zinc-700 transition"
                  >
                    <span>No deadline set (Ongoing)</span>
                    <span className="text-[10px] text-neutral-400 not-italic font-bold underline">Set Date</span>
                  </div>
                ) : (
                  <input
                    type="date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleChange}
                    onClick={(e) => {
                      try { e.target.showPicker(); } catch (err) { }
                    }}
                    className="input-field cursor-pointer [color-scheme:dark] text-xs"
                    required={!noDueDate}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Recurring / Repeat Task Option (Admin & Manager Only) */}
          {canRepeat && (
            <div className="p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <Repeat className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-neutral-200">
                      Recurring Task
                    </span>
                    <p className="text-[11px] text-neutral-400">
                      Automatically reset task on a scheduled interval.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLoop(prev => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isLoop ? 'bg-indigo-600' : 'bg-zinc-800'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${isLoop ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </div>

              {isLoop && (
                <div className="pt-2.5 border-t border-zinc-800 space-y-2 animate-in fade-in">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-300">Interval:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: 'Every 12h', hours: 12 },
                        { label: 'Daily (24h)', hours: 24 },
                        { label: 'Every 48h', hours: 48 },
                        { label: 'Weekly (7d)', hours: 168 }
                      ].map(preset => (
                        <button
                          type="button"
                          key={preset.hours}
                          onClick={() => {
                            setLoopIntervalHours(preset.hours);
                            setIsCustomInterval(false);
                          }}
                          className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition cursor-pointer ${!isCustomInterval && Number(loopIntervalHours) === preset.hours
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                              : 'bg-zinc-950 border-zinc-700 text-neutral-300 hover:border-zinc-500'
                            }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setIsCustomInterval(true)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition cursor-pointer ${isCustomInterval
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                            : 'bg-zinc-950 border-zinc-700 text-neutral-300 hover:border-zinc-500'
                          }`}
                      >
                        Custom
                      </button>
                    </div>

                    {isCustomInterval && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={loopIntervalHours}
                          onChange={(e) => setLoopIntervalHours(e.target.value)}
                          className="input-field py-1 px-2.5 text-xs w-20 text-center font-bold"
                          placeholder="24"
                        />
                        <span className="text-xs text-neutral-400">hours</span>
                      </div>
                    )}
                  </div>

                  {task.next_run_at && (
                    <div className="text-[11px] text-indigo-300/80">
                      Next reset: <span className="font-mono">{new Date(task.next_run_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manager Remarks */}
          <div>
            <label className="font-semibold text-neutral-300 mb-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Admin Guidelines / Remarks (Optional)
            </label>
            <textarea
              name="manager_remarks"
              value={formData.manager_remarks}
              onChange={handleChange}
              placeholder="Add supervisory notes, guidelines, or instructions..."
              rows={2}
              className="input-field resize-none leading-relaxed text-xs"
            />
          </div>

          {/* Reference Links Section (Optional) */}
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-200 block text-xs flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>Reference Links</span>
                <span className="text-[11px] font-normal text-neutral-400">(Optional)</span>
              </label>
              {referenceLinks.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddLinkInput}
                  className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer transition"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Another Link</span>
                </button>
              )}
            </div>

            {referenceLinks.length === 0 ? (
              <div className="flex items-center justify-between py-1 px-0.5 text-xs text-neutral-400">
                <span className="text-[11px]">Optional: Attach specifications, docs, or web links.</span>
                <button
                  type="button"
                  onClick={handleAddLinkInput}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-sky-600 hover:text-white text-slate-200 font-medium text-xs flex items-center gap-1 cursor-pointer transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Link</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {referenceLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <LinkIcon className="w-3.5 h-3.5 text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="URL (e.g. https://drive.google.com/...)"
                        value={link.url || ''}
                        onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                        className="input-field py-1.5 text-xs w-full transition"
                        style={{ paddingLeft: '2.25rem' }}
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Title (optional)"
                      value={link.title || ''}
                      onChange={(e) => handleUpdateLink(idx, 'title', e.target.value)}
                      className="input-field py-1.5 text-xs w-28 sm:w-36"
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveLink(idx)}
                      className="p-2 rounded-lg bg-zinc-900 hover:bg-rose-950/60 hover:text-rose-400 text-neutral-400 border border-zinc-800 hover:border-rose-800 transition cursor-pointer shrink-0 active:scale-95"
                      title="Remove this link line"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-neutral-300 border border-zinc-750 font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold flex items-center gap-2 transition cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
