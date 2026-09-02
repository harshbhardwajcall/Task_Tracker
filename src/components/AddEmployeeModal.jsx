import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { X, UserPlus, User, Mail, Building, Briefcase } from 'lucide-react';

export default function AddEmployeeModal({ onClose, onEmployeeAdded }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [title, setTitle] = useState('Employee'); // 'Employee' | 'Intern'
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

    if (!name.trim()) return setError('Employee name is required.');

    try {
      setLoading(true);
      const res = await api.createEmployee({
        name: name.trim(),
        email: email.trim() || undefined,
        department_id: departmentId || 1,
        title: title
      });

      if (onEmployeeAdded) {
        onEmployeeAdded(res.employee);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add team member.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-base">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <span>Add Team Member</span>
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
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 block text-xs flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              Full Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Priya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field py-2.5 text-xs text-slate-100 placeholder-slate-500"
              autoFocus
              required
            />
          </div>

          {/* Email (Optional) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 block text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-neutral-300" />
                Email Address
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Optional</span>
            </label>
            <input
              type="email"
              placeholder="e.g. priya.sharma@company.com (Optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field py-2.5 text-xs text-slate-100 placeholder-slate-500"
            />
          </div>

          {/* Designation Title (Intern or Employee) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 block text-xs flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-amber-400" />
              Title / Position *
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTitle('Employee')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  title === 'Employee'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Full-time Employee</span>
              </button>
              <button
                type="button"
                onClick={() => setTitle('Intern')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  title === 'Intern'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Intern</span>
              </button>
            </div>
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 block text-xs flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-purple-400" />
              Department *
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="input-field py-2 text-xs"
              required
            >
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary text-xs">
              <UserPlus className="w-4 h-4" />
              {loading ? 'Adding...' : `Add ${title}`}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
