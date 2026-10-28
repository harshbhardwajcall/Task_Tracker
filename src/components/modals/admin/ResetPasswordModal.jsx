import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, Lock, Eye, EyeOff, X, CheckCircle2, ShieldAlert } from 'lucide-react';
import { api } from '@/services/api';

export default function ResetPasswordModal({ user, onClose, onSuccess }) {
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [modalSuccess, setModalSuccess] = useState('');
  const [modalError, setModalError] = useState('');

  if (!user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalSuccess('');
    setModalError('');
    setResetLoading(true);

    try {
      const res = await api.resetUserPassword(user.id, newPassword);
      setModalSuccess(res.message || 'Password successfully updated!');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
        setNewPassword('');
        setModalSuccess('');
      }, 1500);
    } catch (err) {
      setModalError(err.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#0c0c10] border border-white/15 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 relative">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Reset Account Password</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
          <div className="text-neutral-400">Target Account:</div>
          <div className="font-bold text-white">{user.name} ({user.title || user.role})</div>
          <div className="text-[11px] text-neutral-500">{user.email}</div>
        </div>

        {modalSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{modalSuccess}</span>
          </div>
        )}

        {modalError && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{modalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-neutral-300 block mb-1">New Password (Min 4 characters) *</label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password..."
                className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 pl-9 pr-9 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition"
                required
                minLength={4}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
              >
                {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

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
              disabled={resetLoading}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{resetLoading ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
