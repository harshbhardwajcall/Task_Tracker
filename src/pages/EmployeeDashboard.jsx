import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FilterBar, TaskTable, TaskDetailsModal, EditTaskModal } from '../components';
import {
  CheckCircle2,
  Clock,
  PauseCircle,
  AlertTriangle,
  Layers
} from 'lucide-react';

export default function EmployeeDashboard({ filterCompletedOnly = false, scope = '', onOpenCreateTask }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskToEdit, setTaskToEdit] = useState(null);

  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [filters, setFilters] = useState({
    search: '',
    project_id: '',
    department_id: '',
    created_by_role: '',
    priority: '',
    status: filterCompletedOnly ? 'Completed' : '',
    scope: scope || '',
    date_filter: '',
    from_date: '',
    to_date: ''
  });

  const fetchMetadata = async () => {
    try {
      const [projRes, deptRes] = await Promise.all([
        api.getProjects(),
        api.getDepartments()
      ]);
      setProjects(projRes.projects || []);
      setDepartments(deptRes.departments || []);
    } catch (err) {
      console.error('Failed loading metadata:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const queryParams = {
        ...filters,
        scope: filters.scope !== undefined && filters.scope !== '' ? filters.scope : (scope || '')
      };

      if (filterCompletedOnly) {
        queryParams.status = 'Completed';
      } else if (!filters.status) {
        // On main dashboard, exclude completed tasks so completed deliverables move to the Completed Tasks section
        queryParams.exclude_completed = 'true';
      }

      const res = await api.getTasks(queryParams);
      setTasks(res.tasks || []);
      setSummary(res.summary || {});
    } catch (err) {
      console.error('Failed loading assigned tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [filters, filterCompletedOnly, scope]);

  const handleSelectStatusFilter = (statusValue) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status === statusValue ? '' : statusValue
    }));
  };

  const handleDeleteTask = async (task) => {
    if (window.confirm(`Are you sure you want to delete task ${task.task_id}?`)) {
      try {
        await api.deleteTask(task.id);
        fetchTasks();
      } catch (err) {
        alert(err.message || 'Failed to delete task.');
      }
    }
  };

  return (
    <div className="space-y-4 relative selection:bg-white/20">
      <div className="relative z-10 space-y-4">

        {/* Small, Compact Metric Cards (Matching Admin View Card Layout) */}
        {!filterCompletedOnly && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {/* 1. Total Tasks */}
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
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{summary.total || 0}</div>
              <div className="text-[9px] text-slate-600 dark:text-neutral-400">All deliverables</div>
            </button>

            {/* 2. In Progress Tasks */}
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
              <div className="text-lg font-extrabold text-sky-900 dark:text-sky-300 mt-0.5">{summary.in_progress || 0}</div>
              <div className="text-[9px] text-sky-700/80 dark:text-sky-500/80">Active work</div>
            </button>

            {/* 3. On Hold Tasks */}
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
              <div className="text-lg font-extrabold text-amber-900 dark:text-amber-300 mt-0.5">{summary.pending || summary.on_hold || 0}</div>
              <div className="text-[9px] text-amber-700/80 dark:text-amber-500/80">Paused work</div>
            </button>

            {/* 4. Completed Tasks */}
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
              <div className="text-lg font-extrabold text-emerald-900 dark:text-emerald-400 mt-0.5">{summary.completed || 0}</div>
              <div className="text-[9px] text-emerald-700/80 dark:text-emerald-500/80">Delivered</div>
            </button>

            {/* 5. Overdue Tasks */}
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
              <div className="text-lg font-extrabold text-rose-900 dark:text-rose-400 mt-0.5">{summary.overdue || 0}</div>
              <div className="text-[9px] text-rose-700/80 dark:text-rose-500/80">Needs attention</div>
            </button>
          </div>
        )}

        {/* Filters Section */}
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          projects={projects}
          departments={departments}
          isManager={false}
        />

        {/* Task List Table */}
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
            currentUser={user}
            onClose={() => setSelectedTaskId(null)}
            onTaskUpdated={fetchTasks}
          />
        )}

        {/* Edit Task Modal */}
        {taskToEdit && (
          <EditTaskModal
            task={taskToEdit}
            onClose={() => setTaskToEdit(null)}
            onTaskUpdated={fetchTasks}
          />
        )}
      </div>
    </div>
  );
}
