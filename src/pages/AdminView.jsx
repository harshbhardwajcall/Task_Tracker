import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  AddEmployeeModal,
  AddProjectModal,
  AddDepartmentModal,
  CreateTaskModal,
  EditTaskModal,
  FilterBar,
  TaskTable,
  TaskDetailsModal
} from '../components';
import {
  ShieldCheck,
  Users,
  Briefcase,
  Building,
  Plus,
  CheckCircle2,
  Clock,
  PauseCircle,
  AlertTriangle,
  RefreshCw,
  Layers,
  FolderPlus,
  UserPlus,
  PlusCircle
} from 'lucide-react';

export default function AdminView() {
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskToEdit, setTaskToEdit] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Modals
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showAddDepartmentModal, setShowAddDepartmentModal] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  // Task Filters
  const [filters, setFilters] = useState({
    search: '',
    project_id: '',
    department_id: '',
    assigned_to: '',
    assigned_by: '',
    created_by_role: '',
    priority: '',
    status: '',
    scope: '',
    date_filter: '',
    from_date: '',
    to_date: ''
  });

  const fetchMetadataAndStats = async () => {
    try {
      const [statsRes, empRes, deptRes, projRes] = await Promise.all([
        api.getAdminStats().catch(() => ({ stats: null })),
        api.getEmployees().catch(() => ({ employees: [] })),
        api.getDepartments().catch(() => ({ departments: [] })),
        api.getProjects().catch(() => ({ projects: [] }))
      ]);

      setStats(statsRes.stats || null);
      setEmployees(empRes.employees || []);
      setDepartments(deptRes.departments || []);
      setProjects(projRes.projects || []);
    } catch (err) {
      console.error('Failed loading metadata and stats:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.getTasks({
        ...filters,
        assigned_by: 'ALL'
      });
      setTasks(res.tasks || []);
    } catch (err) {
      console.error('Failed loading admin tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    await fetchMetadataAndStats();
    await fetchTasks();
  };

  useEffect(() => {
    fetchMetadataAndStats();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [filters]);

  const handleDeleteTask = async (task) => {
    if (window.confirm(`Are you sure you want to delete task ${task.task_id}?`)) {
      try {
        await api.deleteTask(task.id);
        await handleRefreshAll();
      } catch (err) {
        alert(err.message || 'Failed to delete task.');
      }
    }
  };

  const handleSelectStatusFilter = (statusValue) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status === statusValue ? '' : statusValue
    }));
  };

  const internCount = stats?.totalInterns ?? employees.filter(e => e.role === 'Intern' || e.title === 'Intern').length;
  const employeeCount = stats?.totalEmployees ?? employees.filter(e => (e.role === 'Employee' || !e.role) && e.title !== 'Intern').length;
  const totalStaffCount = stats?.totalEmployeesAndInterns ?? (employeeCount + internCount);

  return (
    <div className="space-y-4 relative selection:bg-white/20">
      <div className="relative z-10 space-y-4">


        {/* Small, Compact Metric Cards / Active Frames (Clickable to Filter) */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {/* 1. Employee / Intern */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950/90 border border-slate-200 dark:border-zinc-800 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition">
              <div className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3 text-sky-500 dark:text-sky-400" /> Employee / Intern
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{totalStaffCount}</div>
              <div className="text-[9px] text-slate-500 dark:text-neutral-500">
                {employeeCount} Emp • {internCount} Intern{internCount === 1 ? '' : 's'}
              </div>
            </div>

            {/* 2. Departments */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950/90 border border-slate-200 dark:border-zinc-800 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition">
              <div className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <Building className="w-3 h-3 text-purple-500 dark:text-purple-400" /> Depts
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{stats.totalDepartments}</div>
              <div className="text-[9px] text-slate-500 dark:text-neutral-500">Divisions</div>
            </div>

            {/* 3. Projects */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950/90 border border-slate-200 dark:border-zinc-800 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition">
              <div className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> Projects
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{stats.totalProjects}</div>
              <div className="text-[9px] text-slate-500 dark:text-neutral-500">Registered</div>
            </div>

            {/* 4. Total Tasks (Click to show all) */}
            <button
              type="button"
              onClick={() => handleSelectStatusFilter('')}
              className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${filters.status === ''
                  ? 'bg-slate-200/90 dark:bg-zinc-800 border-slate-400 dark:border-zinc-500 shadow-md ring-1 ring-slate-400/40 dark:ring-zinc-600/50'
                  : 'bg-white dark:bg-zinc-950/90 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 shadow-sm'
                }`}
            >
              <div className="text-[10px] font-bold text-slate-600 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-700 dark:text-neutral-300" /> Total Tasks
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{stats.totalTasks}</div>
              <div className="text-[9px] text-slate-600 dark:text-neutral-400">All deliverables</div>
            </button>

            {/* 5. In Progress Tasks */}
            <button
              type="button"
              onClick={() => handleSelectStatusFilter('In Progress')}
              className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${filters.status === 'In Progress'
                  ? 'bg-sky-100 dark:bg-sky-900/40 border-sky-400 dark:border-sky-500 shadow-md'
                  : 'bg-sky-50/80 dark:bg-sky-950/30 border-sky-200/80 dark:border-sky-800/40 hover:border-sky-300 dark:hover:border-sky-700/60 shadow-sm'
                }`}
            >
              <div className="text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" /> In Progress
              </div>
              <div className="text-lg font-extrabold text-sky-900 dark:text-sky-300 mt-0.5">{stats.inProgressTasks || 0}</div>
              <div className="text-[9px] text-sky-700/80 dark:text-sky-500/80">Active work</div>
            </button>

            {/* 6. On Hold Tasks */}
            <button
              type="button"
              onClick={() => handleSelectStatusFilter('On Hold')}
              className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${filters.status === 'On Hold'
                  ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-400 dark:border-amber-500 shadow-md'
                  : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/40 hover:border-amber-300 dark:hover:border-amber-700/60 shadow-sm'
                }`}
            >
              <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <PauseCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" /> On Hold
              </div>
              <div className="text-lg font-extrabold text-amber-900 dark:text-amber-300 mt-0.5">{stats.onHoldTasks || 0}</div>
              <div className="text-[9px] text-amber-700/80 dark:text-amber-500/80">Paused work</div>
            </button>

            {/* 7. Completed Tasks */}
            <button
              type="button"
              onClick={() => handleSelectStatusFilter('Completed')}
              className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${filters.status === 'Completed'
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 dark:border-emerald-500 shadow-md'
                  : 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/40 hover:border-emerald-300 dark:hover:border-emerald-700/60 shadow-sm'
                }`}
            >
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Completed
              </div>
              <div className="text-lg font-extrabold text-emerald-900 dark:text-emerald-400 mt-0.5">{stats.completedTasks || 0}</div>
              <div className="text-[9px] text-emerald-700/80 dark:text-emerald-500/80">Delivered</div>
            </button>

            {/* 8. Overdue Tasks */}
            <button
              type="button"
              onClick={() => handleSelectStatusFilter('Overdue')}
              className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${filters.status === 'Overdue'
                  ? 'bg-rose-100 dark:bg-rose-900/40 border-rose-400 dark:border-rose-500 shadow-md'
                  : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-800/40 hover:border-rose-300 dark:hover:border-rose-700/60 shadow-sm'
                }`}
            >
              <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" /> Overdue
              </div>
              <div className="text-lg font-extrabold text-rose-900 dark:text-rose-400 mt-0.5">{stats.overdueTasks || 0}</div>
              <div className="text-[9px] text-rose-700/80 dark:text-rose-500/80">Needs attention</div>
            </button>
          </div>
        )}

        {/* Filter Section as per Department, Employee, Progress/Status, Priority, Date & Search */}
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          employees={employees}
          projects={projects}
          departments={departments}
          isManager={true}
        />

        {/* Task List Count Indicator */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs font-bold text-neutral-300">
            Showing <span className="text-white font-mono font-extrabold px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">{tasks.length}</span> System Tasks
          </div>
        </div>

        {/* Full All Tasks Table */}
        <TaskTable
          tasks={tasks}
          loading={loading}
          onViewTask={(task) => setSelectedTaskId(task.id)}
          onEditTask={(task) => setTaskToEdit(task)}
          onDeleteTask={handleDeleteTask}
          isManager={true}
        />

        {/* Task Details Modal */}
        {selectedTaskId && (
          <TaskDetailsModal
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            onTaskUpdated={handleRefreshAll}
          />
        )}

        {/* Admin Edit Task Modal */}
        {taskToEdit && (
          <EditTaskModal
            task={taskToEdit}
            onClose={() => setTaskToEdit(null)}
            onTaskUpdated={() => {
              handleRefreshAll();
              setTaskToEdit(null);
            }}
          />
        )}

        {/* Create Task Modal */}
        {showCreateTaskModal && (
          <CreateTaskModal
            onClose={() => setShowCreateTaskModal(false)}
            onTaskCreated={() => {
              handleRefreshAll();
              setShowCreateTaskModal(false);
            }}
          />
        )}

        {/* Add Employee Modal */}
        {showAddEmployeeModal && (
          <AddEmployeeModal
            onClose={() => setShowAddEmployeeModal(false)}
            onEmployeeAdded={() => {
              handleRefreshAll();
              setShowAddEmployeeModal(false);
            }}
          />
        )}

        {/* Add Department Modal */}
        {showAddDepartmentModal && (
          <AddDepartmentModal
            onClose={() => setShowAddDepartmentModal(false)}
            onDepartmentAdded={() => {
              handleRefreshAll();
              setShowAddDepartmentModal(false);
            }}
          />
        )}

        {/* Add Project Modal */}
        {showAddProjectModal && (
          <AddProjectModal
            onClose={() => setShowAddProjectModal(false)}
            onProjectAdded={() => {
              handleRefreshAll();
              setShowAddProjectModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
