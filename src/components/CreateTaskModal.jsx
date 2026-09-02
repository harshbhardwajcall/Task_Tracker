import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { X, PlusCircle, Calendar, User, Briefcase, Building, Upload } from 'lucide-react';

export default function CreateTaskModal({ onClose, onTaskCreated }) {
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) return setError('Task title is required.');
    if (!formData.description.trim()) return setError('Task description is required.');
    if (!formData.assigned_to) return setError('Please select an assigned employee.');
    if (!formData.project_id) return setError('Please select a project.');
    if (!formData.department_id) return setError('Please select a department.');
    if (!formData.due_date) return setError('Please specify a due date.');
    if (new Date(formData.due_date) < new Date(formData.start_date)) {
      return setError('Due date cannot be earlier than start date.');
    }

    try {
      setLoading(true);

      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        submitData.append(key, formData[key]);
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
    } fontFinally: {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <PlusCircle className="w-5 h-5 text-white" />
            Create New Task
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="m-5 mb-0 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Task Title */}
          <div>
            <label className="font-semibold text-slate-300 mb-1 block">Task Title *</label>
            <input
              type="text"
              name="title"
              placeholder="e.g. Implement Google OAuth Login API"
              value={formData.title}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="font-semibold text-slate-300 mb-1 block">Task Description *</label>
            <textarea
              name="description"
              rows={3}
              placeholder="Provide clear steps, requirements, and expected deliverables..."
              value={formData.description}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>

          {/* Grid Row 1: Assignee, Project, Department */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-300 mb-1 block flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-emerald-400" /> Assigned To *
              </label>
              <select
                name="assigned_to"
                value={formData.assigned_to}
                onChange={handleChange}
                className="input-field"
                required
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.department_name})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-300 mb-1 block flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-amber-400" /> Project *
              </label>
              <select
                name="project_id"
                value={formData.project_id}
                onChange={handleChange}
                className="input-field"
                required
              >
                <option value="">Select Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-300 mb-1 block flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-purple-400" /> Department *
              </label>
              <select
                name="department_id"
                value={formData.department_id}
                onChange={handleChange}
                className="input-field"
                required
              >
                <option value="">Select Department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid Row 2: Dates & Priority */}
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

            <div>
              <label className="font-semibold text-neutral-300 mb-1 block flex items-center gap-1 text-xs">
                <Calendar className="w-3.5 h-3.5 text-rose-400" /> Due Date *
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleChange}
                  onClick={(e) => {
                    try { e.target.showPicker(); } catch (err) {}
                  }}
                  className="input-field cursor-pointer [color-scheme:dark]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-300 mb-1 block">Priority *</label>
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

          {/* Manager Remarks */}
          <div>
            <label className="font-semibold text-slate-300 mb-1 block">Manager Remarks / Guidelines</label>
            <textarea
              name="manager_remarks"
              rows={2}
              placeholder="Add optional notes, references, or instructions for the employee..."
              value={formData.manager_remarks}
              onChange={handleChange}
              className="input-field"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="font-semibold text-slate-300 mb-1 block">Initial Attachments (Optional)</label>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files))}
              className="input-field file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-white hover:file:bg-neutral-700"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Creating Task...' : 'Assign & Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
