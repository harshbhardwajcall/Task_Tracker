import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { X, UserPlus, User, Mail } from 'lucide-react';

export default function AddManagerModal({ onClose, onManagerAdded }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) return setError('Please enter manager name.');

    try {
      setLoading(true);
      const newMgr = await api.createManager({
        name: name.trim(),
        email: email.trim() || undefined,
        department_id: 1
      });

      if (onManagerAdded) {
        onManagerAdded(newMgr.manager);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create manager profile.');
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
              <UserPlus className="w-4 h-4" />
            </div>
            <span>Add New Manager Profile</span>
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
          <p className="text-slate-400 text-xs">
            Enter the details below to register a new manager profile.
          </p>

          {/* 1. Manager Name */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 block text-xs flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-neutral-300" />
              Manager Name *
            </label>
            <input
              type="text"
              placeholder="Enter full name (e.g. Vikram Malhotra)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field py-2.5 text-xs text-slate-100 placeholder-slate-500"
              autoFocus
              required
            />
          </div>

          {/* 2. Manager Email (Optional) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 block text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-400" />
                Manager Email
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Optional</span>
            </label>
            <input
              type="email"
              placeholder="e.g. vikram@company.com (Optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field py-2.5 text-xs text-slate-100 placeholder-slate-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary text-xs">
              <UserPlus className="w-4 h-4" />
              {loading ? 'Adding Manager...' : 'Add Manager'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
