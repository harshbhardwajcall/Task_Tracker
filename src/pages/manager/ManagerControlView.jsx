import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import {
  Sliders,
  Shield,
  ShieldCheck,
  ShieldAlert,
  User,
  Users,
  Briefcase,
  Building,
  CheckCircle2,
  CheckSquare,
  FolderKanban,
  NotebookPen,
  History,
  Trash2,
  BarChart3,
  Search,
  Save,
  RotateCcw,
  Sparkles,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
  Plus
} from 'lucide-react';

const AVAILABLE_TABS = [
  { id: 'dashboard', label: 'Company / Task Dashboard', desc: 'Overview of all active, overdue, and completed deliverables', icon: CheckSquare },
  { id: 'teams', label: 'Teams & Squad Allocation', desc: 'Squad formation, member assignments, and team lead view', icon: FolderKanban },
  { id: 'self_logs', label: 'Personal Self-Logs & Notes', desc: 'Private tasks, notes, checklists, and calendar schedule', icon: NotebookPen },
  { id: 'completed_tasks', label: 'Completed Deliverables', desc: 'Archive of finished and turned-around deliverables', icon: CheckCircle2 },
  { id: 'projects', label: 'Projects Directory', desc: 'Browse all company projects, links, media, and remarks', icon: Briefcase },
  { id: 'departments', label: 'Departments Directory', desc: 'Browse all operational departments and user counts', icon: Building },
  { id: 'employees', label: 'Employees Directory', desc: 'Directory of all staff, interns, and team members', icon: Users },
  { id: 'reports', label: 'Reports & Analytics', desc: 'Manager workload metrics, turnaround times, and throughput', icon: BarChart3 },
  { id: 'recycle_bin', label: 'Recycle Bin', desc: 'Access soft-deleted tasks with restore functionality', icon: Trash2 },
  { id: 'audit_logs', label: 'System Change History', desc: 'Real-time organization-wide audit log and change records', icon: History }
];

export default function ManagerControlView() {
  const { user: currentUser } = useAuth();
  const [managers, setManagers] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // Permissions state of currently selected manager
  const [currentPermissions, setCurrentPermissions] = useState(null);

  const loadManagers = async () => {
    try {
      setLoading(true);
      const res = await api.getManagersWithPermissions();
      const list = res.managers || [];
      setManagers(list);
      if (list.length > 0 && !selectedManagerId) {
        setSelectedManagerId(list[0].id);
        setCurrentPermissions({ ...list[0].permissions });
      } else if (selectedManagerId) {
        const found = list.find(m => m.id === selectedManagerId);
        if (found) {
          setCurrentPermissions({ ...found.permissions });
        }
      }
    } catch (err) {
      console.error('Failed to load managers:', err);
      setStatusMessage({ type: 'error', text: 'Failed to load manager accounts.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManagers();
  }, []);

  const handleSelectManager = (mgr) => {
    setSelectedManagerId(mgr.id);
    setCurrentPermissions({ ...mgr.permissions });
    setStatusMessage({ type: '', text: '' });
  };

  const handleToggleTab = (tabId) => {
    if (!currentPermissions) return;
    const currentTabs = Array.isArray(currentPermissions.allowed_tabs) ? currentPermissions.allowed_tabs : [];
    let updatedTabs = [];
    if (currentTabs.includes(tabId)) {
      // Don't allow deselecting dashboard if it's the only one
      if (currentTabs.length === 1 && currentTabs[0] === tabId) {
        setStatusMessage({ type: 'error', text: 'At least one navigation tab must remain enabled for the manager.' });
        return;
      }
      updatedTabs = currentTabs.filter(t => t !== tabId);
    } else {
      updatedTabs = [...currentTabs, tabId];
    }
    setCurrentPermissions(prev => ({
      ...prev,
      allowed_tabs: updatedTabs
    }));
  };

  const handleTogglePower = (powerKey) => {
    if (!currentPermissions) return;
    setCurrentPermissions(prev => ({
      ...prev,
      [powerKey]: !prev[powerKey]
    }));
  };

  const handleApplyPreset = async (preset) => {
    if (!selectedManagerId) return;
    try {
      setSaving(true);
      const res = await api.applyManagerPreset(selectedManagerId, preset);
      setCurrentPermissions({ ...res.permissions });
      // Update local managers list
      setManagers(prev => prev.map(m => m.id === selectedManagerId ? { ...m, permissions: res.permissions } : m));
      setStatusMessage({ type: 'success', text: `Successfully applied "${preset.toUpperCase()}" preset.` });
    } catch (err) {
      console.error('Failed to apply preset:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to apply preset.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedManagerId || !currentPermissions) return;
    try {
      setSaving(true);
      const res = await api.updateManagerPermissions(selectedManagerId, currentPermissions);
      // Update local state
      setManagers(prev => prev.map(m => m.id === selectedManagerId ? { ...m, permissions: res.permissions } : m));
      setCurrentPermissions({ ...res.permissions });
      setStatusMessage({ type: 'success', text: res.message || 'Manager permissions updated successfully!' });
    } catch (err) {
      console.error('Failed to save permissions:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update manager permissions.' });
    } finally {
      setSaving(false);
    }
  };

  const selectedManager = managers.find(m => m.id === selectedManagerId);

  const filteredManagers = managers.filter(m => {
    const q = searchQuery.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.department_name?.toLowerCase().includes(q) ||
      m.title?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-purple-500" />
            <span>Manager Control & View Customizer</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Customize which navigation tabs each Manager can see and grant granular powers (task editing, team deletion, project creation, recycle bin access).
          </p>
        </div>

        <button
          onClick={loadManagers}
          className="btn-secondary text-xs flex items-center gap-2 cursor-pointer w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status Messages */}
      {statusMessage.text && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
              : 'bg-rose-950/60 text-rose-300 border-rose-800/80'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage({ type: '', text: '' })}
            className="text-slate-400 hover:text-white cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Managers List on Left, Controls on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Manager Accounts Selection (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Managers Registry ({managers.length})</span>
              </h3>
            </div>

            {/* Search Filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search manager..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field py-1.5 text-xs w-full pl-9"
              />
            </div>

            {/* Managers List */}
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-500">Loading managers...</div>
              ) : filteredManagers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  {managers.length === 0
                    ? 'No users with "Manager" role found. You can promote or create managers in the Admin tab.'
                    : 'No managers match your search.'}
                </div>
              ) : (
                filteredManagers.map((m) => {
                  const isSelected = m.id === selectedManagerId;
                  const allowedTabsCount = m.permissions?.allowed_tabs?.length || 0;
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleSelectManager(m)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-purple-500/15 border-purple-500/50 shadow-md ring-1 ring-purple-500/30'
                          : 'bg-white/60 dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-neutral-300'
                        }`}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {m.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                            {m.title || 'Manager'} • {m.department_name || 'General'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                          {allowedTabsCount} Tabs
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Customization Controls (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {!selectedManager || !currentPermissions ? (
            <div className="glass-panel p-12 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center text-slate-500">
              Select a manager on the left to customize their view and powers.
            </div>
          ) : (
            <>
              {/* Selected Manager Profile Banner & Presets */}
              <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
                      {selectedManager.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{selectedManager.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30">
                          Manager #{selectedManager.id}
                        </span>
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-neutral-400">
                        {selectedManager.email} • {selectedManager.title || 'Manager'} • {selectedManager.department_name || 'General Management'}
                      </p>
                    </div>
                  </div>

                  {/* Save Changes Button */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSavePermissions}
                      className="px-4 py-2 rounded-xl text-xs font-extrabold bg-purple-600 hover:bg-purple-500 text-white shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Saving...' : 'Save Permissions'}</span>
                    </button>
                  </div>
                </div>

                {/* 1-Click Quick Presets Bar */}
                <div className="pt-3 border-t border-slate-200 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Quick Apply Presets:</span>
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleApplyPreset('standard')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-zinc-700 transition cursor-pointer border border-slate-300 dark:border-zinc-700"
                      title="Tasks, Squads, Reports, Self-Logs"
                    >
                      ⚡ Standard Manager
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleApplyPreset('super')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition cursor-pointer border border-indigo-300 dark:border-indigo-800/60"
                      title="All Views + Projects, Recycle Bin, Reports & Change History"
                    >
                      🛡️ Super Manager (Full Access)
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleApplyPreset('restricted')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-zinc-850 text-slate-600 dark:text-neutral-400 hover:text-white transition cursor-pointer border border-slate-200 dark:border-zinc-800"
                      title="Only Squad Deliverables & Self-Logs"
                    >
                      🔒 Restricted (Squad Only)
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 1: Customize Visible Navigation Views / Tabs */}
              <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-neutral-200 flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-sky-400" />
                      <span>Custom Navigation Views (What Manager Sees in Nav Bar)</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                      Enable or disable which tabs appear in this manager&apos;s top navigation bar.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {AVAILABLE_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isEnabled = currentPermissions.allowed_tabs?.includes(tab.id);
                    return (
                      <div
                        key={tab.id}
                        onClick={() => handleToggleTab(tab.id)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                          isEnabled
                            ? 'bg-sky-500/10 border-sky-500/40 dark:bg-sky-500/10 dark:border-sky-500/40'
                            : 'bg-white/40 dark:bg-zinc-900/40 border-slate-200 dark:border-zinc-800/70 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            isEnabled
                              ? 'bg-sky-500/20 text-sky-400'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-neutral-400'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {tab.label}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-neutral-400 truncate">
                              {tab.desc}
                            </p>
                          </div>
                        </div>

                        {/* Visual Switch Indicator */}
                        <div className={`w-9 h-5 rounded-full transition p-0.5 shrink-0 flex items-center ${
                          isEnabled ? 'bg-sky-500 justify-end' : 'bg-slate-300 dark:bg-zinc-700 justify-start'
                        }`}>
                          <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Specific Operational Powers & Granular Permissions */}
              <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-neutral-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Granular Operational Powers & Action Permissions</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                    Assign specific operational powers so this manager can perform authorized actions.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category 1: Task Management Powers */}
                  <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2.5">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                      <span>Task Operations</span>
                    </h4>

                    <div className="space-y-2 text-xs">
                      {[
                        { key: 'can_create_tasks', label: 'Create & Assign Tasks', desc: 'Can create and delegate deliverables' },
                        { key: 'can_edit_tasks', label: 'Edit Any Task', desc: 'Can modify task titles, due dates, and remarks' },
                        { key: 'can_delete_tasks', label: 'Delete Tasks (To Bin)', desc: 'Can move deliverables to Recycle Bin' },
                        { key: 'can_view_all_tasks', label: 'Company-Wide Task Visibility', desc: 'See all company tasks vs only squads' }
                      ].map(item => (
                        <div
                          key={item.key}
                          onClick={() => handleTogglePower(item.key)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/60 cursor-pointer transition"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-200 text-xs">{item.label}</p>
                            <p className="text-[10px] text-slate-500 dark:text-neutral-400">{item.desc}</p>
                          </div>
                          <div className={`w-8 h-4.5 rounded-full transition p-0.5 shrink-0 flex items-center ${
                            currentPermissions[item.key] ? 'bg-blue-500 justify-end' : 'bg-slate-300 dark:bg-zinc-700 justify-start'
                          }`}>
                            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category 2: Squads & Team Management Powers */}
                  <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2.5">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5 text-purple-400" />
                      <span>Squad & Team Management</span>
                    </h4>

                    <div className="space-y-2 text-xs">
                      {[
                        { key: 'can_create_teams', label: 'Create New Squads', desc: 'Can assemble cross-functional teams' },
                        { key: 'can_delete_teams', label: 'Delete Squads', desc: 'Can disband or delete squads' },
                        { key: 'can_manage_members', label: 'Add / Remove Squad Members', desc: 'Allocate engineers and interns to teams' }
                      ].map(item => (
                        <div
                          key={item.key}
                          onClick={() => handleTogglePower(item.key)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/60 cursor-pointer transition"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-200 text-xs">{item.label}</p>
                            <p className="text-[10px] text-slate-500 dark:text-neutral-400">{item.desc}</p>
                          </div>
                          <div className={`w-8 h-4.5 rounded-full transition p-0.5 shrink-0 flex items-center ${
                            currentPermissions[item.key] ? 'bg-purple-500 justify-end' : 'bg-slate-300 dark:bg-zinc-700 justify-start'
                          }`}>
                            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category 3: Project Management Powers */}
                  <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2.5">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                      <span>Project Management</span>
                    </h4>

                    <div className="space-y-2 text-xs">
                      {[
                        { key: 'can_create_projects', label: 'Create Projects', desc: 'Add new company initiatives and projects' },
                        { key: 'can_edit_projects', label: 'Edit Projects', desc: 'Update project links, media, and remarks' },
                        { key: 'can_delete_projects', label: 'Delete Projects', desc: 'Remove projects and purge associated tasks' }
                      ].map(item => (
                        <div
                          key={item.key}
                          onClick={() => handleTogglePower(item.key)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/60 cursor-pointer transition"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-200 text-xs">{item.label}</p>
                            <p className="text-[10px] text-slate-500 dark:text-neutral-400">{item.desc}</p>
                          </div>
                          <div className={`w-8 h-4.5 rounded-full transition p-0.5 shrink-0 flex items-center ${
                            currentPermissions[item.key] ? 'bg-amber-500 justify-end' : 'bg-slate-300 dark:bg-zinc-700 justify-start'
                          }`}>
                            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category 4: Advanced & System Powers */}
                  <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2.5">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-rose-400" />
                      <span>Advanced System Powers</span>
                    </h4>

                    <div className="space-y-2 text-xs">
                      {[
                        { key: 'can_view_reports', label: 'Access Performance Reports', desc: 'View department throughput and turnaround' },
                        { key: 'can_access_recycle_bin', label: 'Recycle Bin & Restore', desc: 'Access and restore deleted tasks' },
                        { key: 'can_empty_recycle_bin', label: 'Permanent Purge Recycle Bin', desc: 'Permanently delete tasks and disk media' },
                        { key: 'can_view_change_history', label: 'System Change History', desc: 'Inspect full audit log and system actions' }
                      ].map(item => (
                        <div
                          key={item.key}
                          onClick={() => handleTogglePower(item.key)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/60 cursor-pointer transition"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-200 text-xs">{item.label}</p>
                            <p className="text-[10px] text-slate-500 dark:text-neutral-400">{item.desc}</p>
                          </div>
                          <div className={`w-8 h-4.5 rounded-full transition p-0.5 shrink-0 flex items-center ${
                            currentPermissions[item.key] ? 'bg-rose-500 justify-end' : 'bg-slate-300 dark:bg-zinc-700 justify-start'
                          }`}>
                            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-4 border-t border-slate-200 dark:border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                    Changes take effect on the manager&apos;s next navigation action or login.
                  </span>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSavePermissions}
                    className="px-5 py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving Changes...' : `Save Changes for ${selectedManager.name}`}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
