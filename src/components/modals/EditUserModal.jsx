import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, X } from 'lucide-react';
import { api } from '../../services/api';
import { ADMIN_ROLE_OPTIONS } from '../../constants/tasks';
import JobTitleSelect from '../ui/JobTitleSelect';

export default function EditUserModal({ user, departments = [], onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'Employee',
    department_id: '',
    title: '',
    admin_role: 'CTO',
    custom_admin_role: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const matchedAdminOpt = ADMIN_ROLE_OPTIONS.find(o => o.value === user.title);
      setFormData({
        name: user.name || '',
        email: user.email || '',
        role: user.role || 'Employee',
        department_id: user.department_id || '',
        title: user.title || (user.role === 'Admin' ? 'Administrator' : 'Employee'),
        admin_role: matchedAdminOpt ? matchedAdminOpt.value : (user.role === 'Admin' ? 'Other' : 'CTO'),
        custom_admin_role: matchedAdminOpt ? '' : (user.title || '')
      });
    }
  }, [user]);

  if (!user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const finalTitle = formData.role === 'Admin'
        ? (formData.admin_role === 'Other' ? (formData.custom_admin_role.trim() || 'Administrator') : formData.admin_role)
        : formData.title;

      await api.updateAdminUser(user.id, {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        department_id: formData.role === 'Admin' ? null : (formData.department_id ? Number(formData.department_id) : null),
        title: finalTitle
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to update user.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#0c0c10] border border-white/15 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 relative">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-white" />
            <h3 className="text-sm font-bold text-white">Edit User Profile</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-semibold text-neutral-300 block mb-1">Full Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white transition"
              required
            />
          </div>

          <div>
            <label className="font-semibold text-neutral-300 block mb-1">Email Address *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white transition"
              required
            />
          </div>

          <div>
            <label className="font-semibold text-neutral-300 block mb-1">Account Role *</label>
            <select
              value={formData.role}
              onChange={(e) => {
                const newRole = e.target.value;
                setFormData({
                  ...formData,
                  role: newRole,
                  title: newRole === 'Manager' && (!formData.title || formData.title === 'Employee' || formData.title === 'Intern')
                    ? 'Manager'
                    : formData.title
                });
              }}
              className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white transition"
            >
              <option value="Employee">Employee</option>
              <option value="Manager">Manager</option>
              <option value="Intern">Intern</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          {formData.role === 'Admin' ? (
            <div>
              <label className="font-semibold text-amber-300 block mb-1">Admin Role / Title *</label>
              <select
                value={formData.admin_role}
                onChange={(e) => setFormData({ ...formData, admin_role: e.target.value })}
                className="w-full bg-zinc-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-200 font-semibold focus:outline-none focus:border-amber-400 transition"
              >
                {ADMIN_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white font-normal">
                    {opt.label}
                  </option>
                ))}
              </select>
              {formData.admin_role === 'Other' && (
                <input
                  type="text"
                  value={formData.custom_admin_role}
                  onChange={(e) => setFormData({ ...formData, custom_admin_role: e.target.value })}
                  placeholder="Enter custom role..."
                  className="w-full bg-zinc-900 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-amber-200 focus:outline-none focus:border-amber-400 transition mt-1.5"
                />
              )}
            </div>
          ) : (
            <div>
              <label className="font-semibold text-neutral-300 block mb-1">Department</label>
              <select
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white transition"
              >
                <option value="">Select Department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {formData.role !== 'Admin' && (
            <div className="space-y-1">
              <label className="font-semibold text-neutral-300 block mb-1 flex items-center justify-between">
                <span>Job Title</span>
                <span className="text-[10px] text-neutral-500 font-normal">Select or add with +</span>
              </label>
              <JobTitleSelect
                value={formData.title}
                onChange={(val) => setFormData({ ...formData, title: val })}
                role={formData.role}
                placeholder="Select Job Title..."
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-850">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-neutral-300 border border-zinc-750 font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{loading ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
