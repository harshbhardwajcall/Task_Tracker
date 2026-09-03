import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SummaryCards from '../components/SummaryCards';
import FilterBar from '../components/FilterBar';
import TaskTable from '../components/TaskTable';
import TaskDetailsModal from '../components/TaskDetailsModal';
import CreateTaskModal from '../components/CreateTaskModal';
import EditTaskModal from '../components/EditTaskModal';

export default function ManagerDashboard({
  onOpenCreateTask,
  showCreateModal,
  setShowCreateModal,
  viewAllTasks = false,
  refreshTrigger = 0,
  onTasksLoaded
}) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskToEdit, setTaskToEdit] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [filters, setFilters] = useState({
    search: '',
    project_id: '',
    department_id: '',
    assigned_to: '',
    assigned_by: '',
    priority: '',
    status: '',
    date_filter: '',
    from_date: '',
    to_date: ''
  });

  const fetchMetadata = async () => {
    try {
      const [empRes, projRes, deptRes] = await Promise.all([
        api.getEmployees(),
        api.getProjects(),
        api.getDepartments()
      ]);
      setEmployees(empRes.employees || []);
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
        assigned_by: viewAllTasks ? 'ALL' : filters.assigned_by || user?.id
      };
      const res = await api.getTasks(queryParams);
      setTasks(res.tasks || []);
      setSummary(res.summary || {});
      if (onTasksLoaded) onTasksLoaded();
    } catch (err) {
      console.error('Failed loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [filters, user?.id, viewAllTasks, refreshTrigger]);

  const handleDeleteTask = async (task) => {
    if (window.confirm(`Are you sure you want to delete task ${task.task_id}?`)) {
      try {
        await api.deleteTask(task.id);
        fetchTasks();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  return (
    <div className="relative rounded-2xl bg-[#08080a] border border-white/5 p-4 sm:p-5 lg:p-6 shadow-2xl overflow-hidden space-y-5">
      <div className="relative z-10 space-y-4">
        {/* Summary Cards */}
        <SummaryCards
          summary={summary}
          activeStatus={filters.status}
          onSelectStatus={(statusVal) => setFilters(prev => ({ ...prev, status: statusVal }))}
        />

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          employees={employees}
          projects={projects}
          departments={departments}
          isManager={true}
        />

        {/* Task List Subheader */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs font-bold text-neutral-300">
            Showing <span className="text-white font-mono font-extrabold px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">{tasks.length}</span> System Tasks
          </div>
        </div>

        {/* Main Full-Width Task Table */}
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
            onTaskUpdated={fetchTasks}
          />
        )}

        {/* Admin Edit Task Modal */}
        {taskToEdit && (
          <EditTaskModal
            task={taskToEdit}
            onClose={() => setTaskToEdit(null)}
            onTaskUpdated={() => {
              fetchTasks();
              setTaskToEdit(null);
            }}
          />
        )}

        {/* Create Task Modal */}
        {showCreateModal && (
          <CreateTaskModal
            onClose={() => setShowCreateModal(false)}
            onTaskCreated={() => {
              fetchTasks();
              setShowCreateModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
