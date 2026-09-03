import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { X, UserPlus, User, Mail, Building, Briefcase, Lock, Eye, EyeOff } from 'lucide-react';

export default function AddEmployeeModal({ onClose, onEmployeeAdded }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [departmentId, setDepartmentId] = useState('');
  const [title, setTitle] = useState('Employee'); // 'Employee' | 'Intern' | 'SDE' | etc.
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

    if (!name.trim()) return setError('Employee full name is required.');
    if (!email.trim()) return setError('Login email address is required.');

    try {
      setLoading(true);
      const res = await api.createAdminUser({
        name: name.trim(),
        email: email.trim(),
        password: password.trim() || 'password123',
        role: title === 'Intern' ? 'Intern' : 'Employee',
        department_id: departmentId ? Number(departmentId) : 1,
        title: title
      });

      if (onEmployeeAdded) {
        onEmployeeAdded(res.user);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add employee account.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-[#0c0c10] w-full max-w-md rounded-2xl border border-white/15 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-white font-bold text-sm">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <span>Add New Employee Account</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="font-semibold text-neutral-300 block flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              Full Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Priya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition"
              autoFocus
              required
            />
          </div>

          {/* Email Address */}
          <div className="space-y-1">
            <label className="font-semibold text-neutral-300 block flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-sky-400" />
              Login Email Address *
            </label>
            <input
              type="email"
              placeholder="e.g. priya.sharma@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="font-semibold text-neutral-300 block flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Initial Login Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="password123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 pr-9 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Designation Title (Employee or Intern) */}
          <div className="space-y-1">
            <label className="font-semibold text-neutral-300 block flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-purple-400" />
              Designation *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTitle('Employee')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  title === 'Employee'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm'
                    : 'bg-zinc-900 border-zinc-800 text-neutral-400 hover:text-white'
                }`}
              >
                <span>Full-time Employee</span>
              </button>
              <button
                type="button"
                onClick={() => setTitle('Intern')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  title === 'Intern'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                    : 'bg-zinc-900 border-zinc-800 text-neutral-400 hover:text-white'
                }`}
              >
                <span>Intern</span>
              </button>
            </div>
          </div>

          {/* Department */}
          <div className="space-y-1">
            <label className="font-semibold text-neutral-300 block flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-neutral-400" />
              Department *
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white transition"
              required
            >
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-neutral-300 border border-zinc-750 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{loading ? 'Creating...' : `Add ${title}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
