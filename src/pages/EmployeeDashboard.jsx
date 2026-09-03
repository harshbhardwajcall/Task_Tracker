import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SummaryCards from '../components/SummaryCards';
import FilterBar from '../components/FilterBar';
import TaskTable from '../components/TaskTable';
import TaskDetailsModal from '../components/TaskDetailsModal';
import { RefreshCw, CheckCircle2, PlusCircle } from 'lucide-react';

export default function EmployeeDashboard({ filterCompletedOnly = false, scope = '', onOpenCreateTask }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [filters, setFilters] = useState({
    search: '',
    project_id: '',
    department_id: '',
    created_by_role: '',
    priority: '',
    status: filterCompletedOnly ? 'Completed' : '',
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
        scope: scope || ''
      };

      if (filterCompletedOnly) {
        queryParams.status = 'Completed';
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

  const handleRefreshAll = async () => {
    await fetchMetadata();
    await fetchTasks();
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [filters, filterCompletedOnly, scope]);

  const getTitle = () => {
    if (filterCompletedOnly) return 'My Completed Tasks';
    if (scope === 'ASSIGNED_TO_ME') return 'My Tasks (Assigned to Me)';
    if (scope === 'ASSIGNED_BY_ME') return 'Tasks Assigned to Others (Created by Me)';
    return 'My Personal Task Board';
  };

  const getSubtitle = () => {
    if (filterCompletedOnly) return 'All completed deliverables and milestones recorded in the system.';
    if (scope === 'ASSIGNED_TO_ME') return 'Deliverables assigned directly to you for execution and completion.';
    if (scope === 'ASSIGNED_BY_ME') return 'Deliverables you created and assigned to other team members.';
    return (
      <>
        Welcome back, <span className="text-white font-bold">{user?.name}</span>! Track your assigned deliverables and create new tasks.
      </>
    );
  };

  return (
    <div className="relative rounded-2xl bg-[#08080a] border border-white/5 p-4 sm:p-5 lg:p-6 shadow-2xl overflow-hidden space-y-6">
      <div className="relative z-10 space-y-6">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">
              {getTitle()}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {getSubtitle()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCreateTask && (
              <button
                onClick={onOpenCreateTask}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5 text-black" />
                <span>Create Task</span>
              </button>
            )}

            <button
              onClick={handleRefreshAll}
              className="btn-secondary text-xs"
              title="Refresh deliverables"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        {!filterCompletedOnly && (
          <SummaryCards
            summary={summary}
            activeStatus={filters.status}
            onSelectStatus={(statusVal) => setFilters(prev => ({ ...prev, status: statusVal }))}
          />
        )}

        {/* Filters */}
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
          isManager={false}
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
      </div>
    </div>
  );
}
