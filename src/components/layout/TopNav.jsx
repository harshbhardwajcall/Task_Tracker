import React from 'react';
import {
  Users,
  Briefcase,
  Building,
  CheckCircle2,
  CheckSquare,
  Send,
  ShieldCheck,
  Trash2,
  FolderKanban,
  NotebookPen,
  History,
  Sliders,
  BarChart3,
  UserCog
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function TopNav({
  currentTab,
  setCurrentTab
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const isManager = user?.role === 'Manager';

  const adminNav = [
    { id: 'dashboard', label: 'Company Dashboard', icon: CheckSquare },
    { id: 'teams', label: 'Teams & Allocation', icon: FolderKanban },
    { id: 'reports', label: 'Reports & Workload', icon: BarChart3 },
    { id: 'self_logs', label: 'My Self-Logs', icon: NotebookPen },
    { id: 'audit_logs', label: 'Change History', icon: History },
    { id: 'manager_control', label: 'Manager Control', icon: Sliders, highlight: true },
    { id: 'admin_settings', label: 'Admin', icon: ShieldCheck, highlight: true },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'departments', label: 'Departments', icon: Building },
    { id: 'recycle_bin', label: 'Recycle Bin', icon: Trash2 },
    { id: 'profile', label: 'My Profile', icon: UserCog },
  ];

  const allManagerNavItems = [
    { id: 'dashboard', label: 'Tasks Dashboard', icon: CheckSquare },
    { id: 'teams', label: 'Teams & Allocation', icon: FolderKanban },
    { id: 'self_logs', label: 'Self-Logs', icon: NotebookPen },
    { id: 'completed_tasks', label: 'Completed Tasks', icon: CheckCircle2 },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'departments', label: 'Departments', icon: Building },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'reports', label: 'Reports & Workload', icon: BarChart3 },
    { id: 'recycle_bin', label: 'Recycle Bin', icon: Trash2 },
    { id: 'audit_logs', label: 'Change History', icon: History },
    { id: 'profile', label: 'My Profile', icon: UserCog }
  ];

  const allowedTabs = user?.permissions?.allowed_tabs || ['dashboard', 'teams', 'self_logs', 'completed_tasks', 'reports'];
  // Profile is always allowed for manager
  const managerNav = allManagerNavItems.filter(item => item.id === 'profile' || allowedTabs.includes(item.id));

  const employeeNav = [
    { id: 'dashboard', label: 'Tasks Dashboard', icon: CheckSquare },
    { id: 'my_team', label: 'My Team', icon: Users },
    { id: 'self_logs', label: 'My Self-Logs', icon: NotebookPen },
    { id: 'completed_tasks', label: 'Completed Tasks', icon: CheckCircle2 },
    { id: 'profile', label: 'My Profile', icon: UserCog },
  ];

  const navItems = isAdmin ? adminNav : isManager ? managerNav : employeeNav;

  return (
    <div className="bg-white/95 dark:bg-black/95 border-b border-slate-200 dark:border-zinc-800 px-4 lg:px-6 py-2 sticky top-[57px] z-20 backdrop-blur-md shadow-sm">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const isHighlight = item.highlight;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-150 cursor-pointer shrink-0 ${
                isActive
                  ? isHighlight
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 shadow-sm'
                    : 'bg-slate-100 text-slate-900 border border-slate-300 dark:bg-white/15 dark:text-white dark:border-white/25 shadow-sm'
                  : isHighlight
                  ? 'text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? (isHighlight ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white') : isHighlight ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-neutral-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
