import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  PlusCircle,
  Users,
  Briefcase,
  Building,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ currentTab, setCurrentTab, onOpenCreateTask }) {
  const { user } = useAuth();
  const isManager = user?.role === 'Manager';

  const managerNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'all_tasks', label: 'All Tasks', icon: CheckSquare },
    { id: 'create_task', label: 'Create Task', icon: PlusCircle, action: onOpenCreateTask },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'departments', label: 'Departments', icon: Building },
  ];

  const employeeNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'my_tasks', label: 'My Tasks', icon: CheckSquare },
    { id: 'completed_tasks', label: 'Completed Tasks', icon: CheckCircle2 },
  ];

  const navItems = isManager ? managerNav : employeeNav;

  return (
    <aside className="w-52 bg-slate-900/80 border-r border-slate-800 flex flex-col justify-between p-2.5 px-3 min-h-[calc(100vh-65px)] shrink-0 transition-all duration-200">
      <div className="space-y-1">
        <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {isManager ? 'Manager Workspace' : 'Employee Workspace'}
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.action) {
                  item.action();
                } else {
                  setCurrentTab(item.id);
                }
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition duration-150 ${
                item.id === 'create_task'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-md shadow-sky-500/20 my-1.5'
                  : isActive
                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Role Card Banner */}
      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mt-4 flex items-center gap-2.5">
        <img src="/Call_Astro_icon.png" alt="Astro Icon" className="w-7 h-7 object-contain opacity-80 shrink-0" />
        <div className="truncate">
          <div className="text-[11px] font-bold text-slate-200 truncate">Task Tracker</div>
          <div className="text-[9px] text-slate-400 truncate">
            {isManager ? 'Manager Control' : 'Employee Workspace'}
          </div>
        </div>
      </div>
    </aside>
  );
}
