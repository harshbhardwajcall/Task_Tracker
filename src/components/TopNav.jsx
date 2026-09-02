import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  PlusCircle,
  Users,
  Briefcase,
  Building,
  CheckCircle2,
  RefreshCw,
  Globe,
  Shield,
  Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function TopNav({
  currentTab,
  setCurrentTab,
  onOpenCreateTask,
  viewAllTasks = false,
  onRefresh,
  isRefreshing = false
}) {
  const { user } = useAuth();
  const isManager = user?.role === 'Manager';

  const managerNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'all_tasks', label: 'All Tasks', icon: CheckSquare },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'departments', label: 'Departments', icon: Building },
    { id: 'recycle_bin', label: 'Recycle Bin', icon: Trash2 },
  ];

  const employeeNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'my_tasks', label: 'My Tasks', icon: CheckSquare },
    { id: 'completed_tasks', label: 'Completed Tasks', icon: CheckCircle2 },
  ];

  const navItems = isManager ? managerNav : employeeNav;

  return (
    <div className="bg-black/95 border-b border-zinc-800 px-4 lg:px-6 py-2 sticky top-[61px] z-20 backdrop-blur-md shadow-sm">
      <div className="flex items-center justify-between gap-4 overflow-x-auto">
        {/* Horizontal Navigation Tabs */}
        <div className="flex items-center gap-1.5 shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-white/10 text-white border border-white/25 shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Options: Active View Indicator, Refresh Button & Create Task */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Active Scope Badge (All Managers or Specific Manager) */}
          <div className="flex items-center">
            {viewAllTasks ? (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-neutral-800 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 shadow-sm">
                <Globe className="w-3.5 h-3.5 text-neutral-300" />
                <span>All Managers View (Global)</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-neutral-800 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 shadow-sm">
                <Shield className="w-3.5 h-3.5 text-neutral-300" />
                <span>Scope: {user?.name || 'Active Manager'}</span>
              </span>
            )}
          </div>

          {/* Refresh Action Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-neutral-200 border border-zinc-800 transition cursor-pointer shadow-sm active:scale-95"
              title="Refresh Tasks and Summary"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}

          {/* Create Task Button (Sleek Dark Theme) */}
          {isManager && onOpenCreateTask && (
            <button
              onClick={onOpenCreateTask}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-extrabold bg-white hover:bg-neutral-200 text-black shadow-md shadow-white/5 transition duration-150 cursor-pointer active:scale-95"
              title="Assign & Create a New Task"
            >
              <PlusCircle className="w-3.5 h-3.5 text-black" />
              <span>Create Task</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
