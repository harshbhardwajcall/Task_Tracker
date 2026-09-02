import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SummaryCards from '../components/SummaryCards';
import FilterBar from '../components/FilterBar';
import TaskTable from '../components/TaskTable';
import TaskDetailsModal from '../components/TaskDetailsModal';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

export default function EmployeeDashboard({ filterCompletedOnly = false }) {
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
      const res = await api.getTasks({
        ...filters,
        status: filterCompletedOnly ? 'Completed' : filters.status
      });
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
  }, [filters, filterCompletedOnly]);

  return (
    <div className="relative rounded-2xl bg-[#08080a] border border-white/5 p-4 sm:p-5 lg:p-6 shadow-2xl overflow-hidden space-y-6">
      {/* Employee Section Ambient Background Emblem */}
      <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden select-none">
        <img
          src="/Call_Astro_icon.png"
          alt="Employee Section Background"
          className="w-[520px] h-[520px] object-contain opacity-15 grayscale-[50%] brightness-75 drop-shadow-2xl"
        />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">
              {filterCompletedOnly ? 'My Completed Tasks' : 'My Personal Task Board'}
            </h2>
            <p className="text-xs text-slate-400">
              Welcome back, <span className="text-white font-bold">{user?.name}</span>! Track your assigned deliverables and update status.
            </p>
          </div>

          <button
            onClick={fetchTasks}
            className="btn-secondary text-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
