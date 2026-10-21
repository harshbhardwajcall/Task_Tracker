import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Briefcase, Plus, Trash2, Check, X, Loader2 } from 'lucide-react';

export default function JobTitleSelect({
  value = '',
  onChange,
  placeholder = 'Select Job Title...',
  required = false,
  role = 'Employee',
  className = ''
}) {
  const [jobTitles, setJobTitles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const loadTitles = async () => {
    try {
      setLoading(true);
      const res = await api.getJobTitles();
      setJobTitles(res.job_titles || []);
    } catch (err) {
      console.error('Failed to load job titles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTitles();
  }, []);

  const handleCreateTitle = async (e) => {
    if (e) e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setActionLoading(true);
      setError('');
      const res = await api.createJobTitle({ title: newTitle.trim() });
      const createdTitle = res.job_title?.title || newTitle.trim();
      
      await loadTitles();
      if (onChange) onChange(createdTitle);
      setNewTitle('');
      setIsAdding(false);
    } catch (err) {
      setError(err.message || 'Failed to add job title.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!value) return;
    const matched = jobTitles.find(t => t.title.toLowerCase() === value.toLowerCase());
    if (!matched) return;

    if (window.confirm(`Are you sure you want to delete job title "${matched.title}" from the list?`)) {
      try {
        setActionLoading(true);
        setError('');
        await api.deleteJobTitle(matched.id);
        await loadTitles();
        if (onChange) onChange('');
      } catch (err) {
        setError(err.message || 'Failed to delete job title.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Find if currently selected title matches one in our list
  const selectedMatch = jobTitles.find(t => t.title.toLowerCase() === (value || '').toLowerCase());

  return (
    <div className={`space-y-1.5 ${className}`}>
      {error && (
        <div className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-800/60 p-1.5 rounded-lg">
          {error}
        </div>
      )}

      {isAdding ? (
        <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
          <div className="relative flex-1">
            <Briefcase className="w-3.5 h-3.5 text-sky-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              placeholder={
                role === 'Intern'
                  ? 'New title (e.g. React Developer Intern)...'
                  : role === 'Manager'
                  ? 'New title (e.g. Operations Manager)...'
                  : 'New title (e.g. Full Stack Developer)...'
              }
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateTitle();
                } else if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewTitle('');
                }
              }}
              className="w-full bg-zinc-900 border border-emerald-500/50 rounded-xl pl-8 pr-2.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none transition shadow-inner"
            />
          </div>

          <button
            type="button"
            onClick={handleCreateTitle}
            disabled={actionLoading || !newTitle.trim()}
            className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
            title="Save new job title"
          >
            {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewTitle('');
            }}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-neutral-400 hover:text-white border border-zinc-700 transition cursor-pointer active:scale-95 shrink-0"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Briefcase className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={value}
              onChange={(e) => onChange && onChange(e.target.value)}
              required={required}
              disabled={loading}
              className="w-full bg-zinc-900 border border-zinc-750 rounded-xl pl-8 pr-8 py-2 text-xs text-white focus:outline-none focus:border-white transition cursor-pointer appearance-none"
            >
              <option value="">{loading ? 'Loading titles...' : placeholder}</option>

              {/* Ensure custom/unlisted current value is still selectable */}
              {value && !selectedMatch && (
                <option value={value}>{value}</option>
              )}

              {jobTitles.map((jt) => (
                <option key={jt.id} value={jt.title}>
                  {jt.title}
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500 text-[10px]">
              ▼
            </div>
          </div>

          {/* Add Job Title Button (+) */}
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-sky-400 hover:text-sky-300 border border-zinc-750 hover:border-sky-500/40 transition cursor-pointer active:scale-95 shrink-0"
            title="Add a new job title to dropdown"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Delete Selected Job Title Button */}
          {selectedMatch && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={actionLoading}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950/60 text-neutral-400 hover:text-rose-400 border border-zinc-750 hover:border-rose-800/80 transition cursor-pointer active:scale-95 shrink-0"
              title={`Delete job title "${selectedMatch.title}" from list`}
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
