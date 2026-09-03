import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Users,
  Briefcase,
  Building,
  CheckCircle2,
  CheckSquare,
  Send,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  Sliders
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function TopNav({
  currentTab,
  setCurrentTab,
  onOpenCreateTask,
  onRefresh,
  isRefreshing = false
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const adminNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'admin_settings', label: 'Admin', icon: ShieldCheck, highlight: true },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'departments', label: 'Departments', icon: Building },
    { id: 'recycle_bin', label: 'Recycle Bin', icon: Trash2 },
  ];

  const employeeNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'my_tasks', label: 'My Tasks', icon: CheckSquare },
    { id: 'assigned_to_others', label: 'Assigned To', icon: Send },
    { id: 'completed_tasks', label: 'Completed Tasks', icon: CheckCircle2 },
  ];

  const navItems = isAdmin ? adminNav : employeeNav;

  return (
    <div className="bg-black/95 border-b border-zinc-800 px-4 lg:px-6 py-2 sticky top-[57px] z-20 backdrop-blur-md shadow-sm">
      <div className="flex items-center justify-between gap-4 overflow-x-auto">
        {/* Horizontal Navigation Tabs */}
        <div className="flex items-center gap-1.5 shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const isHighlight = item.highlight;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-150 cursor-pointer ${
                  isActive
                    ? isHighlight
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'bg-white/10 text-white border border-white/25 shadow-sm'
                    : isHighlight
                    ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? (isHighlight ? 'text-amber-300' : 'text-white') : isHighlight ? 'text-amber-400' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Options: Active View Indicator, Refresh Button & Create Task */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Active Scope Badge */}
          <div className="flex items-center">
            {isAdmin ? (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Administrator</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>My Assigned Deliverables</span>
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

          {/* Create Task Button (Available to Everyone) */}
          {onOpenCreateTask && (
            <button
              onClick={onOpenCreateTask}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-extrabold bg-white hover:bg-neutral-200 text-black shadow-md shadow-white/5 transition duration-150 cursor-pointer active:scale-95"
              title="Create a New Task"
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
