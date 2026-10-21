import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { X, PlusCircle, Calendar, User, Users, Briefcase, Building, Upload, CheckSquare, Square, Clock, Timer, Zap, Link as LinkIcon, Plus, Repeat, Bell } from 'lucide-react';

export default function CreateTaskModal({ onClose, onTaskCreated }) {
  const { user: currentUser } = useAuth();
  const canRepeat = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const [isLoop, setIsLoop] = useState(false);
  const [loopIntervalHours, setLoopIntervalHours] = useState(24);
  const [isCustomInterval, setIsCustomInterval] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDependencies, setSelectedDependencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noDueDate, setNoDueDate] = useState(false);
  const [referenceLinks, setReferenceLinks] = useState([{ title: '', url: '' }]);

  const handleAddLinkInput = () => {
    for (let i = 0; i < referenceLinks.length; i++) {
      if (!referenceLinks[i].url || !referenceLinks[i].url.trim()) {
        setError('Link URL cannot be empty. Please enter a valid URL before adding another link line.');
        return;
      }
    }
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

  const todayStr = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    project_id: '',
    department_id: '',
    assigned_date: todayStr,
    start_date: todayStr,
    due_date: '',
    priority: 'Medium',
    manager_remarks: '',
    estimated_hours: ''
  });

  const [files, setFiles] = useState([]);

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
        console.error('Metadata load error:', err);
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

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const oversized = selectedFiles.find(f => f.size > 10 * 1024 * 1024);
    if (oversized) {
      setError(`File "${oversized.name}" exceeds the 10MB limit (${(oversized.size / (1024 * 1024)).toFixed(1)}MB). Please upload files under 10MB.`);
      e.target.value = '';
      setFiles([]);
      return;
    }
    setError('');
    setFiles(selectedFiles);
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

      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'due_date' && noDueDate) {
          submitData.append('due_date', '');
        } else {
          submitData.append(key, formData[key] || '');
        }
      });

      if (selectedDependencies.length > 0) {
        submitData.append('dependencies', JSON.stringify(selectedDependencies.map(d => d.id || d)));
      }

      if (canRepeat && isLoop) {
        submitData.append('is_loop', '1');
        submitData.append('loop_interval_hours', String(Math.max(0.1, Number(loopIntervalHours) || 24)));
      }

      // Validate reference links: Link URL cannot be empty
      for (let i = 0; i < referenceLinks.length; i++) {
        const l = referenceLinks[i];
        if (!l.url || !l.url.trim()) {
          return setError(`Link URL cannot be empty${referenceLinks.length > 1 ? ` (Link #${i + 1})` : ''}. Please enter a valid URL or remove the link line.`);
        }
      }

      const validLinks = referenceLinks
        .map(l => {
          const u = l.url.trim();
          const fullUrl = u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`;
          const title = (l.title || '').trim() || u.replace(/^https?:\/\//i, '');
          return { title, url: fullUrl };
        });
      if (validLinks.length > 0) {
        submitData.append('links', JSON.stringify(validLinks));
      }

      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          submitData.append('attachments', files[i]);
        }
      }

      await api.createTask(submitData);
      if (onTaskCreated) onTaskCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create task.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/50 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0c0c10] w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-white/15 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-zinc-900/90 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <PlusCircle className="w-5 h-5 text-white" />
            <span>Create New Task</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold shrink-0">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className="font-semibold text-neutral-300 mb-1 block">Task Title *</label>
            <input
              type="text"
              name="title"
              placeholder="e.g. Redesign Landing Page Hero Section"
              value={formData.title}
              onChange={handleChange}
              className="input-field font-medium"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="font-semibold text-neutral-300 mb-1 block">Task Description *</label>
            <textarea
              name="description"
              placeholder="Detailed description of deliverables, objectives, and specifications..."
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="input-field"
              required
            />
          </div>

          {/* Grid Row 1: Assignee, Project, Department */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-neutral-300 flex items-center gap-1 text-xs">
                  <User className="w-3.5 h-3.5 text-emerald-400" /> Assign To *
                </label>
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, assigned_to: String(currentUser.id) }));
                      setSelectedDependencies(prev => prev.filter(d => String(d.id || d) !== String(currentUser.id)));
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition flex items-center gap-1 border cursor-pointer ${
                      String(formData.assigned_to) === String(currentUser.id)
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
                className="input-field"
                required
              >
                <option value="">Select Employee...</option>
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
              <label className="font-semibold text-neutral-300 mb-1 block flex items-center gap-1 text-xs">
                <Briefcase className="w-3.5 h-3.5 text-neutral-300" /> Project *
              </label>
              <select
                name="project_id"
                value={formData.project_id}
                onChange={handleChange}
                className="input-field"
                required
              >
                <option value="">Select Project...</option>
                {projects.map(proj => (
                  <option key={proj.id} value={proj.id}>{proj.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-neutral-300 mb-1 block flex items-center gap-1 text-xs">
                <Building className="w-3.5 h-3.5 text-purple-400" /> Department *
              </label>
              <select
                name="department_id"
                value={formData.department_id}
                onChange={handleChange}
                className="input-field"
                required
              >
                <option value="">Select Department...</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dependencies / Co-Employees Section */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="font-semibold text-neutral-200 flex items-center gap-1.5 text-xs">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Task Dependencies / Co-Employees</span>
                  <span className="text-[10px] font-normal text-cyan-400">(Add more employees over the same task)</span>
                </label>
                <p className="text-[11px] text-neutral-400">
                  Multiple employees who will collaborate, depend on, or co-work on this deliverable.
                </p>
              </div>

              {/* Add Dependency Dropdown */}
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
                      className="input-field text-xs py-1.5 bg-white dark:bg-zinc-950 font-medium"
                    >
                      <option value="">+ Add Co-Employee / Dependency...</option>
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

            {/* Selected Dependencies Tags */}
            {selectedDependencies.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedDependencies.map(dep => (
                  <span
                    key={dep.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-950/70 text-cyan-200 border border-cyan-800/80 shadow-sm animate-in fade-in"
                  >
                    <span className="w-4 h-4 rounded-full bg-cyan-800 text-cyan-100 flex items-center justify-center text-[10px] font-bold">
                      {dep.name ? dep.name.charAt(0).toUpperCase() : 'U'}
                    </span>
                    <span>{dep.name}</span>
                    <span className="text-[10px] text-cyan-400 font-normal">({dep.department_name || dep.title || 'Co-Worker'})</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDependencies(prev => prev.filter(d => String(d.id || d) !== String(dep.id)))}
                      className="hover:text-rose-400 transition ml-0.5 p-0.5 rounded cursor-pointer"
                      title="Remove employee"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-neutral-500 italic">
                No dependencies added yet. If more than 1 employee is working on this task, select them from the dropdown.
              </p>
            )}
          </div>

          {/* Grid Row 2: Dates, Priority & Estimated Time */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="font-semibold text-neutral-300 mb-1 block flex items-center gap-1 text-xs">
                <Calendar className="w-3.5 h-3.5 text-neutral-300" /> Start Date *
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  onClick={(e) => {
                    try { e.target.showPicker(); } catch (err) { }
                  }}
                  className="input-field cursor-pointer [color-scheme:dark]"
                  required
                />
              </div>
            </div>

            {/* Due Date with "No Due Date" Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-neutral-300 flex items-center gap-1 text-xs">
                  <Clock className={`w-3.5 h-3.5 ${noDueDate ? 'text-neutral-500' : 'text-rose-400'}`} />
                  <span>Due Date {noDueDate ? '(Optional)' : '*'}</span>
                </label>
                <button
                  type="button"
                  onClick={handleToggleNoDueDate}
                  className="flex items-center gap-1 text-[11px] font-bold text-neutral-400 hover:text-white transition cursor-pointer select-none"
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
                    className="input-field cursor-pointer [color-scheme:dark]"
                    required={!noDueDate}
                  />
                )}
              </div>
            </div>

            <div>
              <label className="font-semibold text-neutral-300 mb-1 block">Priority *</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="input-field font-semibold"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-neutral-300 mb-1 block flex items-center gap-1 text-xs">
                <Timer className="w-3.5 h-3.5 text-sky-400" />
                <span>Estimated Hrs</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g. 4.5"
                name="estimated_hours"
                value={formData.estimated_hours}
                onChange={handleChange}
                className="input-field py-2 text-xs"
              />
            </div>
          </div>

          {/* Repeat / Loop Task Section (Admin & Manager Only) */}
          {canRepeat && (
            <div className="p-3.5 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-zinc-950/40 border border-indigo-800/40 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                      Repeat Task Loop (Auto-Reset)
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                        Admin / Manager
                      </span>
                    </span>
                    <p className="text-[11px] text-neutral-400">
                      Task resets in-place for a new cycle after time duration completes (no matter if completed or not).
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
                <div className="pt-2.5 border-t border-indigo-800/30 space-y-2.5 animate-in fade-in">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-300">Repeat Interval:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: 'Every 12h', hours: 12 },
                        { label: 'Every 24h (Daily)', hours: 24 },
                        { label: 'Every 48h', hours: 48 },
                        { label: 'Every 7 Days', hours: 168 }
                      ].map(preset => (
                        <button
                          type="button"
                          key={preset.hours}
                          onClick={() => {
                            setLoopIntervalHours(preset.hours);
                            setIsCustomInterval(false);
                          }}
                          className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition cursor-pointer ${
                            !isCustomInterval && Number(loopIntervalHours) === preset.hours
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                              : 'bg-zinc-900 border-zinc-700 text-neutral-300 hover:border-zinc-500'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setIsCustomInterval(true)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition cursor-pointer ${
                          isCustomInterval
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                            : 'bg-zinc-900 border-zinc-700 text-neutral-300 hover:border-zinc-500'
                        }`}
                      >
                        Custom Timer
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

                  <div className="text-[11px] text-indigo-300/80 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                    <span>Assignee will receive alerts before cycle completes and upon reset for each new cycle.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Admin Remarks / Guidelines */}
          <div>
            <label className="font-semibold text-neutral-300 mb-1 block">Guidelines / Supervisor Remarks</label>
            <textarea
              name="manager_remarks"
              rows={2}
              placeholder="Any specific execution guidelines, requirements, or additional remarks..."
              value={formData.manager_remarks}
              onChange={handleChange}
              className="input-field"
            />
          </div>

          {/* Dynamic Reference Links Section */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 dark:text-slate-200 block text-xs flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                <span>Reference Links</span>
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Click <span className="text-sky-500 dark:text-sky-400 font-bold">+</span> to add another link line
              </span>
            </div>

            {referenceLinks.length === 0 ? (
              <div className="flex items-center justify-between py-1 px-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span>No reference links added.</span>
                <button
                  type="button"
                  onClick={handleAddLinkInput}
                  className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center gap-1 cursor-pointer transition shadow-sm active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Reference Link</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {referenceLinks.map((link, idx) => {
                  const isUrlEmpty = !link.url || !link.url.trim();
                  const hasLinkError = error && error.toLowerCase().includes('link');
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <LinkIcon className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Link URL (e.g. https://... or website.com) *"
                          value={link.url || ''}
                          onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                          className={`input-field py-1.5 text-xs w-full transition ${isUrlEmpty && hasLinkError ? 'border-rose-500 ring-1 ring-rose-500/60 bg-rose-50/10' : ''}`}
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
                        onClick={handleAddLinkInput}
                        className="p-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center cursor-pointer shrink-0 transition shadow-sm active:scale-95"
                        title="Add another link line"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveLink(idx)}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-900 hover:bg-rose-100 dark:hover:bg-rose-950/60 hover:text-rose-600 dark:hover:text-rose-400 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-zinc-800 hover:border-rose-300 dark:hover:border-rose-800 transition cursor-pointer shrink-0 active:scale-95"
                        title="Remove this link line"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* File Attachments */}
          <div>
            <label className="font-semibold text-neutral-300 mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <Upload className="w-3.5 h-3.5 text-neutral-400" /> Attach Reference Files
              </span>
              <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                Max 10MB per file
              </span>
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full text-xs text-neutral-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 cursor-pointer"
            />
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {files.map((file, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] text-neutral-300">
                    {file.name} ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3 shrink-0">
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
              <PlusCircle className="w-4 h-4" />
              <span>{loading ? 'Creating Task...' : 'Create Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
