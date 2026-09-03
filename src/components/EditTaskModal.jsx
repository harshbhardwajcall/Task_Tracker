import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { X, Save, Calendar, User, Briefcase, Building, CheckSquare, Square, Clock, ShieldCheck, AlertCircle } from 'lucide-react';

export default function EditTaskModal({ task, onClose, onTaskUpdated }) {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noDueDate, setNoDueDate] = useState(!task.due_date);

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
      await api.updateTask(task.id, {
        ...formData,
        due_date: noDueDate ? null : formData.due_date
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
                <span>Admin Edit Task</span>
              </h2>
              <p className="text-[11px] text-neutral-400">Modify deliverable parameters, assignments, dates, and status</p>
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
              <label className="font-semibold text-neutral-300 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-neutral-400" /> Assign To *
              </label>
              <select
                name="assigned_to"
                value={formData.assigned_to}
                onChange={handleChange}
                className="input-field font-semibold text-xs"
                required
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.title || emp.role} • {emp.department_name || 'General'})
                  </option>
                ))}
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
                  try { e.target.showPicker(); } catch (err) {}
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
                      try { e.target.showPicker(); } catch (err) {}
                    }}
                    className="input-field cursor-pointer [color-scheme:dark] text-xs"
                    required={!noDueDate}
                  />
                )}
              </div>
            </div>
          </div>

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
