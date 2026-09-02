import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { X, FolderPlus, Briefcase, Building, FileText } from 'lucide-react';

export default function AddProjectModal({ onClose, onProjectAdded }) {
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [description, setDescription] = useState('');
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDepts() {
      try {
        const res = await api.getDepartments();
        setDepartments(res.departments || []);
        if (res.departments && res.departments.length > 0) {
          setDepartmentId(res.departments[0].id);
        }
      } catch (err) {
        console.error('Failed loading departments:', err);
      }
    }
    loadDepts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) return setError('Project name is required.');

    try {
      setLoading(true);
      const res = await api.createProject({
        name: name.trim(),
        department_id: departmentId ? Number(departmentId) : null,
        description: description.trim()
      });

      if (onProjectAdded) {
        onProjectAdded(res.project);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create project.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-white font-bold text-base">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-white">
              <FolderPlus className="w-4 h-4" />
            </div>
            <span>Create New Project</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
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
          {/* Project Name */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 block text-xs flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-neutral-300" />
              Project Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Mobile Banking App 2.0"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field py-2.5 text-xs text-slate-100 placeholder-slate-500"
              autoFocus
              required
            />
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 block text-xs flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-purple-400" />
              Associated Department
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="input-field py-2 text-xs"
            >
              <option value="">No Specific Department (Global)</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Project Description */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 block text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Description
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Optional</span>
            </label>
            <textarea
              rows={3}
              placeholder="Provide a brief summary of this project's scope, goals, and key deliverables..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field py-2 text-xs text-slate-100 placeholder-slate-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary text-xs cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary text-xs cursor-pointer">
              <FolderPlus className="w-4 h-4" />
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
