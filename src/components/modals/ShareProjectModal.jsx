import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Share2,
  Users,
  Shield,
  Briefcase,
  Building,
  UserPlus,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Info
} from 'lucide-react';

export default function ShareProjectModal({
  isOpen = true,
  onClose,
  preselectedProjectId = null,
  onSuccess
}) {
  if (!isOpen) return null;

  const { user } = useAuth();

  // State
  const [manageableProjects, setManageableProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(preselectedProjectId || '');
  const [shareData, setShareData] = useState(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingShares, setLoadingShares] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  // Reset modal state when opened or project changes
  useEffect(() => {
    setFeedback(null);
    setSelectedManagerId('');
    if (preselectedProjectId) {
      setSelectedProjectId(String(preselectedProjectId));
    }
  }, [isOpen, preselectedProjectId]);

  // Load manageable projects
  useEffect(() => {
    let isMounted = true;
    const fetchProjects = async () => {
      try {
        setLoadingProjects(true);
        const res = await api.getManageableProjects();
        if (isMounted) {
          const projs = res.projects || [];
          setManageableProjects(projs);
          if (preselectedProjectId) {
            setSelectedProjectId(String(preselectedProjectId));
          } else if (projs.length > 0 && !selectedProjectId) {
            setSelectedProjectId(String(projs[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to load manageable projects:', err);
      } finally {
        if (isMounted) setLoadingProjects(false);
      }
    };
    fetchProjects();
    return () => { isMounted = false; };
  }, [preselectedProjectId]);

  // Load shares for selected project
  const loadProjectShares = async (projId) => {
    if (!projId) {
      setShareData(null);
      return;
    }
    try {
      setLoadingShares(true);
      const res = await api.getProjectShares(projId);
      setShareData(res);
      setSelectedManagerId('');
    } catch (err) {
      console.error('Failed to load project shares:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load project share data.' });
    } finally {
      setLoadingShares(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectShares(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Handle Share Project
  const handleShare = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setFeedback({ type: 'error', message: 'Please select a project to share.' });
      return;
    }
    if (!selectedManagerId) {
      setFeedback({ type: 'error', message: 'Please select a manager to share this project with.' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);
      const res = await api.shareProject(selectedProjectId, { manager_id: Number(selectedManagerId) });
      setFeedback({ type: 'success', message: res.message || 'Project shared successfully!' });
      await loadProjectShares(selectedProjectId);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Failed to share project:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to share project.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Revoke Share
  const handleRevoke = async (targetUserId, targetName) => {
    const confirmMsg = `Are you sure you want to revoke co-management access for ${targetName || 'this manager'} on this project?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setRevokingId(targetUserId);
      setFeedback(null);
      const res = await api.revokeProjectShare(selectedProjectId, targetUserId);
      setFeedback({ type: 'success', message: res.message || 'Co-manager access revoked.' });
      await loadProjectShares(selectedProjectId);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Failed to revoke co-management:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to revoke co-management access.' });
    } finally {
      setRevokingId(null);
    }
  };

  const currentProject = shareData?.project || manageableProjects.find(p => String(p.id) === String(selectedProjectId));

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 dark:bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-xl my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="shrink-0 p-4.5 bg-gradient-to-r from-purple-50/70 via-slate-50/50 to-white dark:from-purple-950/30 dark:via-zinc-900/90 dark:to-zinc-900/90 border-b border-purple-200/60 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 border border-purple-300 dark:border-purple-600/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Share2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Share Project with Co-Managers</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Grant other managers equal management power over project deliverables & squads
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="flex-1">{feedback.message}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Project Selector */}
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Select Project to Share</span>
            </label>
            {loadingProjects ? (
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-900 text-slate-400 text-xs">
                Loading accessible projects...
              </div>
            ) : manageableProjects.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                No manageable projects found. Create a squad with an allocated project first.
              </div>
            ) : (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-slate-100 font-medium text-xs focus:outline-none focus:border-purple-500 cursor-pointer shadow-sm"
              >
                {manageableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.department_name ? `(${p.department_name})` : ''} — {p.total_tasks || 0} Tasks {p.is_co_managed ? '• [Co-Managed]' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected Project Summary Card */}
          {currentProject && (
            <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                    PRJ-{String(currentProject.id).padStart(3, '0')}
                  </span>
                  <strong className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {currentProject.name}
                  </strong>
                </div>
                {currentProject.department_name && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {currentProject.department_name}
                  </span>
                )}
              </div>
              {currentProject.description && (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                  {currentProject.description}
                </p>
              )}
            </div>
          )}

          {/* Share Action Form */}
          <form onSubmit={handleShare} className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Select Target Manager to Grant Co-Management</span>
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                  disabled={loadingShares || submitting || !shareData?.available_managers?.length}
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-purple-500 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <option value="">
                    {loadingShares
                      ? 'Loading eligible managers...'
                      : !shareData?.available_managers?.length
                      ? 'All eligible managers already have access'
                      : 'Choose a manager...'}
                  </option>
                  {shareData?.available_managers?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email}) {m.department_name ? `• ${m.department_name}` : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={!selectedManagerId || submitting || loadingShares}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-950/20 cursor-pointer disabled:opacity-50 transition-all shrink-0"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sharing...</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Grant Co-Manager Power</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Explanatory Info Card */}
            <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 text-[11px] text-purple-900 dark:text-purple-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Equal Powers:</strong> Co-managers can form squads for this project, allocate team deliverables, reassign tasks, update status, and manage project deliverables with the exact same power as the original manager.
              </div>
            </div>
          </form>

          {/* Active Co-Managers List */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h4 className="text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Active Co-Managers ({shareData?.shared_managers?.length || 0})</span>
              </h4>
              {loadingShares && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
            </div>

            {loadingShares ? (
              <div className="p-4 text-center text-slate-400 text-xs">Loading co-managers...</div>
            ) : !shareData?.shared_managers?.length ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center text-slate-500 dark:text-slate-400 text-xs">
                This project has not been shared with any other managers yet.
              </div>
            ) : (
              <div className="space-y-2">
                {shareData.shared_managers.map((m) => (
                  <div
                    key={m.user_id}
                    className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{m.name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                            Co-Manager
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {m.email} {m.shared_by_name ? `• Shared by ${m.shared_by_name}` : ''}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={revokingId === m.user_id}
                      onClick={() => handleRevoke(m.user_id, m.name)}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50"
                      title={`Revoke co-management access for ${m.name}`}
                    >
                      {revokingId === m.user_id ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 p-3.5 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
