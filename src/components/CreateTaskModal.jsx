import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { X, PlusCircle, Calendar, User, Briefcase, Building, Upload, CheckSquare, Square, Clock } from 'lucide-react';

export default function CreateTaskModal({ onClose, onTaskCreated }) {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noDueDate, setNoDueDate] = useState(false);

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
    manager_remarks: ''
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
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-[#0c0c10] w-full max-w-2xl rounded-2xl border border-white/15 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <PlusCircle className="w-5 h-5 text-white" />
            <span>Create New Task</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
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
              <label className="font-semibold text-neutral-300 mb-1 block flex items-center gap-1 text-xs">
                <User className="w-3.5 h-3.5 text-emerald-400" /> Assign To *
              </label>
              <select
                name="assigned_to"
                value={formData.assigned_to}
                onChange={handleChange}
                className="input-field"
                required
              >
                <option value="">Select Employee...</option>
                {employees
                  .filter(emp => String(emp.id) !== String(currentUser?.id))
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department_name || 'General'})
                    </option>
                  ))}
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

          {/* Grid Row 2: Dates & Priority with "No Due Date" Option */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    try { e.target.showPicker(); } catch (err) {}
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
                      try { e.target.showPicker(); } catch (err) {}
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
          </div>

          {/* Admin Remarks / Guidelines */}
          <div>
            <label className="font-semibold text-neutral-300 mb-1 block">Guidelines / Supervisor Remarks</label>
            <textarea
              name="manager_remarks"
              rows={2}
              placeholder="Any specific execution guidelines, requirements, or reference links..."
              value={formData.manager_remarks}
              onChange={handleChange}
              className="input-field"
            />
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
