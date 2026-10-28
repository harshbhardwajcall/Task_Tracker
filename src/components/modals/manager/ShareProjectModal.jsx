import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import {
  Share2,
  Shield,
  Users,
  UserPlus,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export default function ShareProjectModal({
  isOpen = true,
  onClose,
  preselectedProjectId = null,
  preselectedTeamId = null,
  onSuccess
}) {
  if (!isOpen) return null;

  const { user } = useAuth();
  const initialTeamId = preselectedTeamId || preselectedProjectId;

  // State
  const [manageableTeams, setManageableTeams] = useState([]);
  const [allManagers, setAllManagers] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(initialTeamId ? String(initialTeamId) : '');
  const [shareData, setShareData] = useState(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingShares, setLoadingShares] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Reset modal state when opened
  useEffect(() => {
    setFeedback(null);
    setSelectedManagerId('');
    if (initialTeamId) {
      setSelectedTeamId(String(initialTeamId));
    }
  }, [isOpen, initialTeamId]);

  // Auto-dismiss feedback message after 3 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => {
      setFeedback(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Load manageable teams (teams created/managed by this manager) and eligible managers (only role = 'Manager')
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setLoadingTeams(true);
        const [teamsRes, mgrsRes] = await Promise.all([
          api.getManageableTeams().catch(() => ({ teams: [] })),
          api.getEligibleManagers().catch(() => ({ managers: [] }))
        ]);
        if (isMounted) {
          const tms = teamsRes.teams || [];
          setManageableTeams(tms);
          // Only managers (role = 'Manager', no Admin, no Employee)
          const onlyManagers = (mgrsRes.managers || []).filter(m => m.role === 'Manager');
          setAllManagers(onlyManagers);

          if (initialTeamId && tms.some(t => String(t.id) === String(initialTeamId))) {
            setSelectedTeamId(String(initialTeamId));
          } else if (tms.length > 0 && !selectedTeamId) {
            setSelectedTeamId(String(tms[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to load teams or managers:', err);
      } finally {
        if (isMounted) setLoadingTeams(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [initialTeamId]);

  // Load shares for the selected team
  const loadTeamShares = async (tId) => {
    if (!tId) {
      setShareData(null);
      return;
    }
    try {
      setLoadingShares(true);
      const res = await api.getTeamShares(tId);
      setShareData(res);
      setSelectedManagerId('');
    } catch (err) {
      console.error('Failed to load team shares:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load team share data.' });
    } finally {
      setLoadingShares(false);
    }
  };

  useEffect(() => {
    if (selectedTeamId) {
      loadTeamShares(selectedTeamId);
    }
  }, [selectedTeamId]);

  // Handle Share Team
  const handleShare = async (e) => {
    e.preventDefault();
    if (!selectedTeamId) {
      setFeedback({ type: 'error', message: 'Please select a team to share.' });
      return;
    }
    if (!selectedManagerId) {
      setFeedback({ type: 'error', message: 'Please select a manager.' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);
      const res = await api.shareTeam(selectedTeamId, { manager_id: Number(selectedManagerId) });
      setFeedback({ type: 'success', message: res.message || 'Team access granted successfully.' });
      await loadTeamShares(selectedTeamId);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Failed to share team:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to share team.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Revoke Team Share
  const handleRevoke = async (targetUserId, targetName) => {
    const confirmMsg = `Remove co-manager access for ${targetName || 'this manager'} on this team?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setRevokingId(targetUserId);
      setFeedback(null);
      const res = await api.revokeTeamShare(selectedTeamId, targetUserId);
      setFeedback({ type: 'success', message: res.message || 'Co-manager access removed.' });
      await loadTeamShares(selectedTeamId);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Failed to revoke team share:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to remove access.' });
    } finally {
      setRevokingId(null);
    }
  };

  const currentTeam = shareData?.team || manageableTeams.find(t => String(t.id) === String(selectedTeamId));
  const sharedManagers = shareData?.shared_managers || [];
  const sharedManagerIds = new Set(sharedManagers.map(m => Number(m.user_id)));

  // Available managers: ONLY users with role = 'Manager', excluding self, current team lead, and already shared managers
  const availableManagers = (shareData?.available_managers && shareData.available_managers.length > 0)
    ? shareData.available_managers.filter(m => m.role === 'Manager')
    : allManagers.filter(m => !sharedManagerIds.has(Number(m.id)) && Number(m.id) !== Number(currentTeam?.manager_id));

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 dark:bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-lg my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="shrink-0 px-5 py-4 bg-slate-50/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/10 dark:bg-purple-500/20 border border-purple-300 dark:border-purple-600/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Share Team
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                Give another manager co-management access to your team
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-200 transition-all ${
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

          {/* Team Selector (Only teams created/managed by this manager) */}
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Select Team</span>
            </label>
            {loadingTeams ? (
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-900 text-slate-400 text-xs">
                Loading your teams...
              </div>
            ) : manageableTeams.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-slate-400 text-xs">
                No teams created by you found.
              </div>
            ) : (
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-slate-100 font-medium text-xs focus:outline-none focus:border-purple-500 cursor-pointer shadow-xs"
              >
                {manageableTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.department_name ? `(${t.department_name})` : ''} • {t.total_members || 0} Members
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected Team Summary Card */}
          {currentTeam && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 shrink-0">
                  TEAM-{String(currentTeam.id).padStart(3, '0')}
                </span>
                <span className="font-bold text-slate-900 dark:text-white truncate">
                  {currentTeam.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {currentTeam.department_name && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300">
                    {currentTeam.department_name}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {currentTeam.total_members || 0} Members
                </span>
              </div>
            </div>
          )}

          {/* Share Action Form (Only other Managers) */}
          <form onSubmit={handleShare} className="space-y-1.5 pt-1">
            <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Select Manager</span>
            </label>

            <div className="flex items-center gap-2">
              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                disabled={loadingShares || submitting || availableManagers.length === 0}
                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-purple-500 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <option value="">
                  {loadingShares
                    ? 'Loading managers...'
                    : availableManagers.length === 0
                    ? 'No other managers available'
                    : 'Choose a manager...'}
                </option>
                {availableManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email}) {m.department_name ? `• ${m.department_name}` : ''}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={!selectedManagerId || submitting || loadingShares}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 transition-all shrink-0"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Active Co-Managers List */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Active Co-Managers ({sharedManagers.length})</span>
              </label>
              {loadingShares && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
            </div>

            {loadingShares ? (
              <div className="p-3 text-center text-slate-400 text-xs">Loading co-managers...</div>
            ) : sharedManagers.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center text-slate-500 dark:text-neutral-400 text-xs">
                No other co-managers added to this team yet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {sharedManagers.map((m) => (
                  <div
                    key={m.user_id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{m.name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 shrink-0">
                            Co-Manager
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {m.email} {m.shared_by_name ? `• by ${m.shared_by_name}` : ''}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={revokingId === m.user_id}
                      onClick={() => handleRevoke(m.user_id, m.name)}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50 shrink-0"
                      title={`Remove ${m.name}`}
                    >
                      {revokingId === m.user_id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 px-5 py-3.5 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 font-semibold text-xs cursor-pointer transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
