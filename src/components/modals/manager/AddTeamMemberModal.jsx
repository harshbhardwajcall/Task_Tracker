import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/services/api';
import { UserPlus, X } from 'lucide-react';

export default function AddTeamMemberModal({
  isOpen = true,
  team,
  employees = [],
  onClose,
  onSuccess
}) {
  if (!isOpen || !team) return null;

  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState('Member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberUserId) return;

    try {
      setLoading(true);
      setError('');
      await api.addTeamMember(team.id, {
        user_id: Number(memberUserId),
        role_in_team: memberRole
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add member.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 dark:bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-md animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4.5 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <UserPlus className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Add Member to "{team.name}"</span>
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
          <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleAddMember} className="p-5 space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-800 dark:text-slate-200 block">Select Employee / Intern *</label>
            <select
              value={memberUserId}
              onChange={(e) => setMemberUserId(e.target.value)}
              className="input-field py-2 text-xs"
              required
            >
              <option value="">-- Choose Staff Member --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.title || emp.role} - {emp.department_name || 'Global'})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-800 dark:text-slate-200 block">Role in Squad (Optional)</label>
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
              className="input-field py-2 text-xs"
            >
              <option value="Lead">Squad Lead</option>
              <option value="Member">Core Contributor / Member</option>
              <option value="Developer">Developer</option>
              <option value="Designer">Designer</option>
              <option value="QA">QA / Tester</option>
              <option value="Intern">Intern / Trainee</option>
            </select>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-xs"
            >
              <span>{loading ? 'Adding...' : 'Add to Squad'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
