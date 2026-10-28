import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/services/api';
import { EmployeeAnalyticsModal, TaskDetailsModal } from '@/components/modals';
import PriorityBadge from '@/components/ui/PriorityBadge';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  BarChart3,
  Users,
  Building,
  Briefcase,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Search,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Activity,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Filter,
  SlidersHorizontal,
  Zap,
  FolderKanban,
  UserCheck,
  PieChart,
  Eye,
  Flame,
  Award,
  Trash2,
  UserX,
  RotateCcw,
  History,
  UserMinus
} from 'lucide-react';

export default function ReportsView() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedSuccess, setRefreshedSuccess] = useState(false);
  const [removingState, setRemovingState] = useState(null); // { employeeId, projectId }
  const [restoringState, setRestoringState] = useState(null); // { employeeId, projectId }
  const [deletingPreviousMemberId, setDeletingPreviousMemberId] = useState(null); // recordId / removal_id

  // Filter States
  const [dateRange, setDateRange] = useState('This Month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // View Mode: 'by_employee' | 'overall_employee' | 'by_project' | 'previous_members'
  const [viewMode, setViewMode] = useState('by_employee');

  // Sub-filter for 'by_employee' (Workload by Project): 'all' | 'active' | 'previous'
  const [memberScopeFilter, setMemberScopeFilter] = useState('all');

  // Overall Employee Report Modal State
  const [selectedEmployeeForModal, setSelectedEmployeeForModal] = useState(null);

  // Task Details Modal State
  const [selectedTaskIdForModal, setSelectedTaskIdForModal] = useState(null);

  // Expanded employee cards state for nested projects
  const [expandedEmployees, setExpandedEmployees] = useState({});

  // Expanded state for previous members cards
  const [expandedPreviousMembers, setExpandedPreviousMembers] = useState({});

  const handleRemoveEmployeeFromProject = async (emp, proj) => {
    if (!proj.project_id) {
      alert('Cannot remove an unassigned or global project allocation.');
      return;
    }
    const confirmMsg = `Are you sure you want to remove ${emp.employee_name} from project "${proj.project_name}"?\n\nThis will unassign all ${proj.total_tasks} tasks assigned to ${emp.employee_name} in this project and remove them from this report.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setRemovingState({ employeeId: emp.employee_id, projectId: proj.project_id });
      const res = await api.removeEmployeeFromProject(emp.employee_id, proj.project_id);
      await fetchReports(true);
      if (res?.message) {
        alert(res.message);
      }
    } catch (err) {
      console.error('Failed to remove employee from project:', err);
      alert(err.message || 'Failed to remove employee from project.');
    } finally {
      setRemovingState(null);
    }
  };

  const fetchReports = async (isBackground = false) => {
    try {
      if (!isBackground && !reports) setLoading(true);
      else setRefreshing(true);

      const params = {
        _t: Date.now()
      };
      if (dateRange && dateRange !== 'All Time') {
        params.date_range = dateRange;
        if (dateRange === 'Custom' && fromDate && toDate) {
          params.from_date = fromDate;
          params.to_date = toDate;
        }
      }
      if (selectedProjectId) params.project_id = selectedProjectId;
      if (selectedDepartmentId) params.department_id = selectedDepartmentId;

      const res = await api.getReports(params);
      if (res) {
        setReports({ ...res });
      }
    } catch (err) {
      console.error('Failed loading manager reports:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      setRefreshedSuccess(false);

      const params = {
        _t: Date.now()
      };
      if (dateRange && dateRange !== 'All Time') {
        params.date_range = dateRange;
        if (dateRange === 'Custom' && fromDate && toDate) {
          params.from_date = fromDate;
          params.to_date = toDate;
        }
      }
      if (selectedProjectId) params.project_id = selectedProjectId;
      if (selectedDepartmentId) params.department_id = selectedDepartmentId;

      const [res] = await Promise.all([
        api.getReports(params),
        new Promise(resolve => setTimeout(resolve, 400))
      ]);

      if (res) {
        setReports({ ...res });
        setRefreshedSuccess(true);
        setTimeout(() => setRefreshedSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Failed refreshing reports:', err);
      alert('Failed to refresh reports. Please check server connection.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports(reports !== null);
  }, [dateRange, selectedProjectId, selectedDepartmentId]);

  const handleCustomDateApply = (e) => {
    e.preventDefault();
    if (fromDate && toDate) {
      fetchReports(true);
    }
  };

  const toggleEmployeeExpand = (empId) => {
    setExpandedEmployees(prev => ({
      ...prev,
      [empId]: !prev[empId]
    }));
  };

  // Group employee project workload by employee
  const groupedEmployeeWorkload = useMemo(() => {
    if (!reports?.employeeProjectWorkload) return [];

    const map = new Map();

    reports.employeeProjectWorkload.forEach(row => {
      if (!map.has(row.employee_id)) {
        map.set(row.employee_id, {
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          employee_email: row.employee_email,
          employee_role: row.employee_role,
          employee_title: row.employee_title,
          department_name: row.department_name,
          total_tasks: 0,
          pending_tasks: 0,
          in_progress_tasks: 0,
          completed_tasks: 0,
          overdue_tasks: 0,
          total_estimated_hours: 0,
          active_estimated_hours: 0,
          projects: []
        });
      }

      const emp = map.get(row.employee_id);
      emp.total_tasks += row.total_tasks || 0;
      emp.pending_tasks += row.pending_tasks || 0;
      emp.in_progress_tasks += row.in_progress_tasks || 0;
      emp.completed_tasks += row.completed_tasks || 0;
      emp.overdue_tasks += row.overdue_tasks || 0;
      emp.total_estimated_hours += Number(row.total_estimated_hours || 0);
      emp.active_estimated_hours += Number(row.active_estimated_hours || 0);

      emp.projects.push({
        project_id: row.project_id,
        project_name: row.project_name,
        total_tasks: row.total_tasks,
        pending_tasks: row.pending_tasks,
        in_progress_tasks: row.in_progress_tasks,
        completed_tasks: row.completed_tasks,
        overdue_tasks: row.overdue_tasks,
        total_estimated_hours: row.total_estimated_hours,
        active_estimated_hours: row.active_estimated_hours
      });
    });

    // Round accumulated hours
    const list = Array.from(map.values()).map(emp => ({
      ...emp,
      total_estimated_hours: Math.round(emp.total_estimated_hours * 10) / 10,
      active_estimated_hours: Math.round(emp.active_estimated_hours * 10) / 10,
      completion_rate: emp.total_tasks > 0 ? Math.round((emp.completed_tasks / emp.total_tasks) * 100) : 0
    }));

    return list;
  }, [reports?.employeeProjectWorkload]);

  const handleRestoreEmployeeToProject = async (emp) => {
    if (!emp.project_id) {
      alert('Cannot restore without a valid project ID.');
      return;
    }
    const confirmMsg = `Are you sure you want to restore ${emp.employee_name} to project "${emp.project_name}"?\n\nThis will reassign their unassigned deliverables back to ${emp.employee_name} and restore them to active project workload.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setRestoringState({ employeeId: emp.employee_id, projectId: emp.project_id });
      const res = await api.restoreEmployeeToProject(emp.employee_id, emp.project_id);
      await fetchReports(true);
      if (res?.message) {
        alert(res.message);
      }
    } catch (err) {
      console.error('Failed to restore employee to project:', err);
      alert(err.message || 'Failed to restore employee to project.');
    } finally {
      setRestoringState(null);
    }
  };

  const handleDeletePreviousMember = async (m) => {
    const recordId = m.removal_id || m.id;
    if (!recordId) {
      alert('Cannot delete: Record ID is missing.');
      return;
    }

    const confirmMsg = `Are you sure you want to remove ${m.employee_name} from the previous members list for project "${m.project_name}"?\n\nThis will permanently delete this record from the previous members history.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setDeletingPreviousMemberId(recordId);
      const res = await api.deletePreviousMember(recordId);
      await fetchReports(true);
      if (res?.message) {
        // Optional feedback
      }
    } catch (err) {
      console.error('Failed to delete previous member record:', err);
      alert(err.message || 'Failed to delete record from previous members list.');
    } finally {
      setDeletingPreviousMemberId(null);
    }
  };

  const togglePreviousMemberExpand = (removalId) => {
    setExpandedPreviousMembers(prev => ({
      ...prev,
      [removalId]: prev[removalId] === false ? true : false
    }));
  };

  const previousMembersList = reports?.previousMembers || [];

  const filteredPreviousMembers = useMemo(() => {
    if (!previousMembersList) return [];
    if (!searchQuery.trim()) return previousMembersList;

    const q = searchQuery.toLowerCase().trim();
    return previousMembersList.filter(m =>
      m.employee_name?.toLowerCase().includes(q) ||
      m.employee_email?.toLowerCase().includes(q) ||
      m.department_name?.toLowerCase().includes(q) ||
      m.project_name?.toLowerCase().includes(q) ||
      m.removed_by_name?.toLowerCase().includes(q) ||
      (m.tasks && m.tasks.some(t => t.title?.toLowerCase().includes(q) || t.task_id?.toLowerCase().includes(q)))
    );
  }, [previousMembersList, searchQuery]);

  // Filter employees based on search query
  const filteredEmployees = useMemo(() => {
    if (!groupedEmployeeWorkload) return [];
    if (!searchQuery.trim()) return groupedEmployeeWorkload;

    const q = searchQuery.toLowerCase().trim();
    return groupedEmployeeWorkload.filter(emp =>
      emp.employee_name?.toLowerCase().includes(q) ||
      emp.employee_email?.toLowerCase().includes(q) ||
      emp.department_name?.toLowerCase().includes(q) ||
      emp.projects.some(p => p.project_name?.toLowerCase().includes(q))
    );
  }, [groupedEmployeeWorkload, searchQuery]);

  const downloadCSV = (rows, filename) => {
    const csvContent = rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDateSafe = (dateStr, includeTime = false) => {
    if (!dateStr) return 'N/A';
    let clean = String(dateStr).trim();
    if (!clean.includes('T') && !clean.endsWith('Z')) {
      clean = clean.replace(' ', 'T');
    }
    const d = new Date(clean);
    if (isNaN(d.getTime())) return String(dateStr);
    return includeTime ? d.toLocaleString() : d.toLocaleDateString();
  };

  // Export current workload report or previous members report to CSV
  const exportToCSV = () => {
    if (viewMode === 'previous_members') {
      if (!filteredPreviousMembers || filteredPreviousMembers.length === 0) {
        alert('No previous members data available to export.');
        return;
      }

      const rows = [
        ['Member Name', 'Role', 'Department', 'Project', 'Removal Date', 'Removed By', 'Total Deliverables', 'Completed', 'In Progress', 'Pending', 'Overdue', 'Total Est Hours', 'Notes']
      ];

      filteredPreviousMembers.forEach(m => {
        rows.push([
          `"${m.employee_name}"`,
          `"${m.employee_role}"`,
          `"${m.department_name || 'N/A'}"`,
          `"${m.project_name}"`,
          `"${formatDateSafe(m.removed_at, true)}"`,
          `"${m.removed_by_name || 'System'}"`,
          m.total_tasks,
          m.completed_tasks,
          m.in_progress_tasks,
          m.pending_tasks,
          m.overdue_tasks,
          m.total_estimated_hours,
          `"${m.notes || ''}"`
        ]);
      });

      downloadCSV(rows, `previous_members_report_${new Date().toISOString().split('T')[0]}.csv`);
      return;
    }

    if (!groupedEmployeeWorkload || groupedEmployeeWorkload.length === 0) {
      alert('No workload data available to export.');
      return;
    }

    const rows = [
      ['Employee Name', 'Role', 'Department', 'Project', 'Member Status', 'Total Tasks', 'In Progress', 'Pending', 'Completed', 'Overdue', 'Active Hours', 'Total Hours']
    ];

    groupedEmployeeWorkload.forEach(emp => {
      emp.projects.forEach(p => {
        rows.push([
          `"${emp.employee_name}"`,
          `"${emp.employee_role}"`,
          `"${emp.department_name || 'N/A'}"`,
          `"${p.project_name}"`,
          '"Active Member"',
          p.total_tasks,
          p.in_progress_tasks,
          p.pending_tasks,
          p.completed_tasks,
          p.overdue_tasks,
          p.active_estimated_hours,
          p.total_estimated_hours
        ]);
      });
    });

    if (filteredPreviousMembers && filteredPreviousMembers.length > 0) {
      filteredPreviousMembers.forEach(m => {
        rows.push([
          `"${m.employee_name}"`,
          `"${m.employee_role}"`,
          `"${m.department_name || 'N/A'}"`,
          `"${m.project_name}"`,
          `"Previous Member (Removed ${formatDateSafe(m.removed_at, false)})"`,
          m.total_tasks,
          m.in_progress_tasks,
          m.pending_tasks,
          m.completed_tasks,
          m.overdue_tasks,
          m.active_estimated_hours,
          m.total_estimated_hours
        ]);
      });
    }

    downloadCSV(rows, `workload_report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // Helper: Workload intensity level calculation with crisp dual light/dark styles
  const getWorkloadLevel = (activeTasks, activeHours) => {
    if (activeTasks >= 8 || activeHours >= 35) {
      return {
        label: 'Heavy / Overloaded',
        bg: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
        dot: 'bg-rose-500',
        intensity: 'high'
      };
    }
    if (activeTasks >= 5 || activeHours >= 20) {
      return {
        label: 'High Workload',
        bg: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
        dot: 'bg-amber-500',
        intensity: 'medium-high'
      };
    }
    if (activeTasks >= 2 || activeHours >= 8) {
      return {
        label: 'Balanced Workload',
        bg: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/30',
        dot: 'bg-sky-500',
        intensity: 'moderate'
      };
    }
    return {
      label: 'Light Workload',
      bg: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
      dot: 'bg-emerald-500',
      intensity: 'low'
    };
  };

  // Helper to render a previous member card
  const renderPreviousMemberCard = (m) => {
    const isPrevExpanded = expandedPreviousMembers[m.removal_id] !== false; // Default expanded
    const workload = getWorkloadLevel(m.in_progress_tasks + m.pending_tasks, m.active_estimated_hours);
    const mTotal = m.total_tasks || 1;
    const compPct = Math.round((m.completed_tasks / mTotal) * 100);
    const inProgPct = Math.round((m.in_progress_tasks / mTotal) * 100);
    const overduePct = Math.round((m.overdue_tasks / mTotal) * 100);

    return (
      <div
        key={`prev-member-${m.removal_id || m.employee_id + '-' + m.project_id}`}
        className="rounded-2xl bg-white dark:bg-zinc-900/80 border border-amber-200/80 dark:border-amber-900/40 shadow-sm overflow-hidden hover:border-amber-300 dark:hover:border-amber-700/60 transition-all"
      >
        {/* Previous Member Header */}
        <div className="p-4 bg-gradient-to-r from-amber-50/60 via-slate-50/40 to-white dark:from-amber-950/25 dark:via-zinc-900/90 dark:to-zinc-900/90 border-b border-amber-200/60 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Identity */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-600 to-rose-600 flex items-center justify-center font-black text-white text-base shadow-md">
                {m.employee_name?.charAt(0).toUpperCase()}
              </div>
              <div
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-white shadow-xs"
                title="Removed from project"
              >
                <UserX className="w-2.5 h-2.5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">{m.employee_name}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60">
                  Previous Member
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700">
                  {m.employee_role}
                </span>
                {m.department_name && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                    {m.department_name}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {m.employee_email} • {m.employee_title}
              </p>
            </div>
          </div>

          {/* Project, Removal Metadata & Actions */}
          <div className="flex items-center gap-2.5 flex-wrap justify-between md:justify-end">
            {/* Project Pill */}
            <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <Briefcase className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{m.project_name}</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Removed {formatDateSafe(m.removed_at)}</span>
                {m.removed_by_name && <span>• by {m.removed_by_name}</span>}
              </div>
            </div>

            {/* Quick Stats Pill */}
            <div className="flex items-center gap-3 text-xs border-x border-slate-200 dark:border-zinc-800 px-3 hidden sm:flex">
              <div className="text-center">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold block">Deliverables</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">{m.total_tasks}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold block">Done</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{m.completed_tasks}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold block">Est. Hours</span>
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{m.total_estimated_hours}h</span>
              </div>
            </div>

            {/* Workload Status Badge */}
            <div className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${workload.bg}`}>
              <span className={`w-2 h-2 rounded-full ${workload.dot}`} />
              <span>{workload.label}</span>
            </div>

            {/* Action: Restore Member */}
            <button
              type="button"
              disabled={restoringState?.employeeId === m.employee_id && restoringState?.projectId === m.project_id}
              onClick={() => handleRestoreEmployeeToProject(m)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-600 dark:bg-amber-950/40 dark:hover:bg-amber-600 text-amber-800 hover:text-white dark:text-amber-300 dark:hover:text-white border border-amber-300 dark:border-amber-800 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
              title={`Restore ${m.employee_name} to project "${m.project_name}" and reassign deliverables`}
            >
              {restoringState?.employeeId === m.employee_id && restoringState?.projectId === m.project_id ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Restoring...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore to Project</span>
                </>
              )}
            </button>

            {/* Action: Overall Scorecard Modal */}
            <button
              onClick={() => setSelectedEmployeeForModal(m.employee_id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 hover:bg-sky-600 dark:bg-zinc-800 dark:hover:bg-sky-600 text-slate-700 hover:text-white dark:text-zinc-300 dark:hover:text-white border border-slate-200 dark:border-zinc-700 shadow-sm cursor-pointer transition-all"
              title="Open overall scorecard, timeframes, and analytics"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Overall Report</span>
            </button>

            {/* Action: Delete from Previous Members List */}
            <button
              type="button"
              disabled={deletingPreviousMemberId === (m.removal_id || m.id)}
              onClick={() => handleDeletePreviousMember(m)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-600 text-rose-700 hover:text-white dark:text-rose-300 dark:hover:text-white border border-rose-200 dark:border-rose-900/60 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
              title={`Permanently remove ${m.employee_name} from previous members list`}
            >
              {deletingPreviousMemberId === (m.removal_id || m.id) ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete from List</span>
                </>
              )}
            </button>

            {/* Accordion Toggle */}
            <button
              onClick={() => togglePreviousMemberExpand(m.removal_id)}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800 cursor-pointer"
              title={isPrevExpanded ? 'Collapse deliverables' : 'Expand deliverables'}
            >
              {isPrevExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Deliverables Accordion Body */}
        {isPrevExpanded && (
          <div className="p-4 bg-slate-50/60 dark:bg-zinc-950/70 space-y-3.5">
            {/* Multi-Color Visual Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span>Deliverables Breakdown in {m.project_name}</span>
                <span>{compPct}% completed • {m.total_estimated_hours}h estimated</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden flex shadow-inner">
                <div style={{ width: `${compPct}%` }} className="bg-emerald-500 h-full" title={`Completed: ${m.completed_tasks}`} />
                <div style={{ width: `${inProgPct}%` }} className="bg-sky-500 h-full" title={`In Progress: ${m.in_progress_tasks}`} />
                <div style={{ width: `${overduePct}%` }} className="bg-rose-500 h-full" title={`Overdue: ${m.overdue_tasks}`} />
              </div>
            </div>

            {/* Status Pills Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Done</span>
                <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{m.completed_tasks}</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">In Progress</span>
                <span className="text-sm font-extrabold text-sky-600 dark:text-sky-400">{m.in_progress_tasks}</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Pending Backlog</span>
                <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">{m.pending_tasks}</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Overdue</span>
                <span className={`text-sm font-extrabold ${m.overdue_tasks > 0 ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-400'}`}>
                  {m.overdue_tasks}
                </span>
              </div>
            </div>

            {/* Deliverable Cards Grid */}
            {(!m.tasks || m.tasks.length === 0) ? (
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 text-center text-xs text-slate-500">
                No individual task details recorded for this removed member allocation.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {m.tasks.map(task => (
                  <div
                    key={task.id || task.task_id}
                    onClick={() => task.id && setSelectedTaskIdForModal(task.id)}
                    className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/90 space-y-2 shadow-xs hover:border-sky-400 dark:hover:border-sky-500 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="font-mono text-[11px] font-bold text-sky-600 dark:text-sky-400 group-hover:underline">
                        {task.task_id}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        task.status === 'Completed'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                          : task.status === 'In Progress'
                          ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800/40'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700'
                      }`}>
                        {task.status || 'Unassigned'}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2">
                      {task.title}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                      <span>Est: {task.estimated_hours || 0}h</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                        {task.assigned_to ? (task.current_assigned_name ? `Assigned to ${task.current_assigned_name}` : 'Reassigned') : 'Unassigned in Project'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!reports && loading) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
        Loading Reports & Workload...
      </div>
    );
  }

  const summary = reports?.summary || {};

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-gradient-to-r dark:from-zinc-900/90 dark:via-zinc-900/60 dark:to-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-sm dark:shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-sky-500/5 blur-3xl pointer-events-none" />

        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            <span>Reports & Workload</span>
          </h1>
        </div>

        {/* Global Quick Actions */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto relative z-10">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/60 shadow-sm cursor-pointer disabled:opacity-50"
            title="Refresh analytics data from database"
          >
            {refreshedSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Refreshed</span>
              </>
            ) : (
              <>
                <RefreshCw className={`w-3.5 h-3.5 text-sky-600 dark:text-sky-400 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
              </>
            )}
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 cursor-pointer"
            title="Export full workload breakdown to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Total Tasks</span>
            <Layers className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">{summary.total_tasks || 0}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>Across <strong>{summary.total_active_projects || 0}</strong> projects</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/15 border border-emerald-200 dark:border-emerald-500/20 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-2">{summary.completed_tasks || 0}</div>
          <div className="text-[11px] text-emerald-600/80 dark:text-slate-400 mt-1 font-medium">
            {summary.total_tasks ? Math.round(((summary.completed_tasks || 0) / summary.total_tasks) * 100) : 0}% completion rate
          </div>
        </div>

        <div className="p-4 rounded-xl bg-sky-50/70 dark:bg-sky-950/15 border border-sky-200 dark:border-sky-500/20 shadow-sm">
          <div className="flex items-center justify-between text-sky-700 dark:text-sky-400 text-xs font-bold uppercase tracking-wider">
            <span>In Progress</span>
            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-700 dark:text-sky-400 mt-2">{summary.in_progress_tasks || 0}</div>
          <div className="text-[11px] text-sky-600/80 dark:text-slate-400 mt-1 font-medium">
            + {summary.pending_tasks || 0} pending backlog
          </div>
        </div>

        <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/15 border border-rose-200 dark:border-rose-500/20 shadow-sm">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
            <span>Overdue Tasks</span>
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-2">{summary.overdue_tasks || 0}</div>
          <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-1 font-medium">
            Requires active intervention
          </div>
        </div>

        <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/15 border border-indigo-200 dark:border-indigo-500/20 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <span>Active Hours</span>
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-2">{summary.active_estimated_hours || 0}h</div>
          <div className="text-[11px] text-indigo-600/80 dark:text-slate-400 mt-1 font-medium">
            On <strong>{summary.total_active_employees || 0}</strong> active team members
          </div>
        </div>
      </div>

      {/* Control Strip: View Tabs + Search + Multi-dimensional Filters */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 space-y-3.5 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Main View Mode Selector */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 text-xs font-semibold shrink-0 gap-0.5 flex-wrap">
            <button
              onClick={() => setViewMode('by_employee')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                viewMode === 'by_employee'
                  ? 'bg-sky-600 dark:bg-sky-500 text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-zinc-900'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Workload by Project</span>
            </button>

            <button
              onClick={() => setViewMode('overall_employee')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                viewMode === 'overall_employee'
                  ? 'bg-sky-600 dark:bg-sky-500 text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-zinc-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Overall Employee Report</span>
            </button>

            <button
              onClick={() => setViewMode('by_project')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                viewMode === 'by_project'
                  ? 'bg-sky-600 dark:bg-sky-500 text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-zinc-900'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Projects Overview</span>
            </button>

            <button
              onClick={() => setViewMode('previous_members')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                viewMode === 'previous_members'
                  ? 'bg-amber-600 dark:bg-amber-500 text-white shadow-sm font-bold'
                  : 'text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              }`}
              title="Show team members who were removed from projects and their deliverables"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Previous Members</span>
              {filteredPreviousMembers.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  viewMode === 'previous_members'
                    ? 'bg-amber-700 text-white'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                }`}>
                  {filteredPreviousMembers.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by employee name, project, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:bg-white dark:focus:bg-zinc-950"
            />
          </div>
        </div>

        {/* Second Row: Date Filter & Scope Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800/60 text-xs">
          {/* Preset Date Range Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
              <CalendarIcon className="w-3 h-3 text-sky-600 dark:text-sky-400" />
              Period:
            </span>
            {['This Month', 'Today', 'This Week', 'All Time', 'Custom'].map(period => (
              <button
                key={period}
                onClick={() => setDateRange(period === 'All Time' ? '' : period)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  (dateRange === period || (!dateRange && period === 'All Time'))
                    ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800/60 border border-transparent'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Department & Project Selectors */}
          <div className="flex items-center gap-2">
            {/* Project Filter */}
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="">All Projects</option>
              {reports?.availableProjects?.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Department Filter */}
            <select
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="">All Departments</option>
              {reports?.availableDepartments?.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker Dropdown */}
        {dateRange === 'Custom' && (
          <form onSubmit={handleCustomDateApply} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/90 border border-slate-200 dark:border-zinc-800/80 text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-medium">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-sky-500"
              required
            />
            <span className="text-slate-600 dark:text-slate-400 font-medium">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-sky-500"
              required
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold ml-2 cursor-pointer shadow-sm"
            >
              Apply Filter
            </button>
          </form>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: WORKLOAD BY PROJECT (Employee with nested projects & deliverables) */}
      {/* ========================================================================= */}
      {viewMode === 'by_employee' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Employee Workload by Assigned Projects</span>
              </h2>
              <span className="text-xs text-slate-500">
                Showing deliverables & estimated hours per project
              </span>
            </div>

            {/* Scope Filter: Active / Previous / All */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-semibold self-start sm:self-auto gap-1">
              <button
                type="button"
                onClick={() => setMemberScopeFilter('active')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                  memberScopeFilter === 'active'
                    ? 'bg-white dark:bg-zinc-800 text-sky-600 dark:text-sky-400 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Active Members ({filteredEmployees.length})
              </button>
              <button
                type="button"
                onClick={() => setMemberScopeFilter('previous')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all flex items-center gap-1 ${
                  memberScopeFilter === 'previous'
                    ? 'bg-amber-600 text-white shadow-sm font-bold'
                    : 'text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300'
                }`}
              >
                <UserX className="w-3 h-3" />
                <span>Previous Members ({filteredPreviousMembers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMemberScopeFilter('all')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                  memberScopeFilter === 'all'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                All Combined ({filteredEmployees.length + filteredPreviousMembers.length})
              </button>
            </div>
          </div>

          {/* ACTIVE MEMBERS SECTION */}
          {(memberScopeFilter === 'active' || memberScopeFilter === 'all') && (
            filteredEmployees.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800 space-y-2 shadow-sm">
                <Users className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-400">No active employee task allocations match your filters.</p>
                <p className="text-xs text-slate-500">Try adjusting the selected period, project, or search terms.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEmployees.map(emp => {
                  const isExpanded = expandedEmployees[emp.employee_id] !== false; // Default expanded
                  const workload = getWorkloadLevel(emp.in_progress_tasks + emp.pending_tasks, emp.active_estimated_hours);

                  return (
                    <div
                      key={emp.employee_id}
                      className="rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800/90 shadow-sm overflow-hidden hover:border-slate-300 dark:hover:border-zinc-700/80"
                    >
                      {/* Employee Card Header */}
                      <div className="p-4.5 bg-slate-50/70 dark:bg-zinc-900/90 border-b border-slate-200 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Left: Avatar & Identity */}
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center font-black text-white text-base shadow-md shrink-0">
                            {emp.employee_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">{emp.employee_name}</h3>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700">
                                {emp.employee_role}
                              </span>
                              {emp.department_name && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                                  {emp.department_name}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                              {emp.employee_email} • {emp.employee_title}
                            </p>
                          </div>
                        </div>

                        {/* Right: Workload Indicator, Capacity & Actions */}
                        <div className="flex items-center gap-3 flex-wrap justify-between md:justify-end">
                          {/* Workload Status Badge */}
                          <div className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${workload.bg}`}>
                            <span className={`w-2 h-2 rounded-full ${workload.dot}`} />
                            <span>{workload.label}</span>
                          </div>

                          {/* High-level metrics */}
                          <div className="flex items-center gap-3 text-xs border-x border-slate-200 dark:border-zinc-800 px-3 hidden sm:flex">
                            <div className="text-center">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold block">Projects</span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200">{emp.projects.length}</span>
                            </div>
                            <div className="text-center">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold block">Tasks</span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200">{emp.total_tasks}</span>
                            </div>
                            <div className="text-center">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold block">Active Hours</span>
                              <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{emp.active_estimated_hours}h</span>
                            </div>
                            {emp.overdue_tasks > 0 && (
                              <div className="text-center">
                                <span className="text-[10px] text-rose-500 uppercase font-bold block">Overdue</span>
                                <span className="font-extrabold text-rose-600 dark:text-rose-400">{emp.overdue_tasks}</span>
                              </div>
                            )}
                          </div>

                          {/* Action: View Full Report Modal */}
                          <button
                            onClick={() => setSelectedEmployeeForModal(emp.employee_id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-50 hover:bg-sky-600 dark:bg-sky-500/15 dark:hover:bg-sky-500 text-sky-700 hover:text-white dark:text-sky-400 dark:hover:text-white border border-sky-200 dark:border-sky-500/30 shadow-sm cursor-pointer"
                            title="Open overall scorecard, timeframes, and analytics"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>View Overall Report</span>
                          </button>

                          {/* Accordion toggle button */}
                          <button
                            onClick={() => toggleEmployeeExpand(emp.employee_id)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800 cursor-pointer"
                            title={isExpanded ? 'Collapse projects' : 'Expand projects'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Nested Project Workload Breakdown */}
                      {isExpanded && (
                        <div className="p-4 bg-slate-50/50 dark:bg-zinc-950/50 space-y-3">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
                            <span>Assigned Project Deliverables & Capacity ({emp.projects.length})</span>
                            <span className="text-slate-500 lowercase">
                              {emp.completed_tasks} of {emp.total_tasks} total tasks delivered ({emp.completion_rate}%)
                            </span>
                          </div>

                          {/* Projects Grid for this Employee */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {emp.projects.map(proj => {
                              const pTotal = proj.total_tasks || 1;
                              const compPct = Math.round((proj.completed_tasks / pTotal) * 100);
                              const inProgPct = Math.round((proj.in_progress_tasks / pTotal) * 100);
                              const overduePct = Math.round((proj.overdue_tasks / pTotal) * 100);

                              return (
                                <div
                                  key={proj.project_id || proj.project_name}
                                  className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 space-y-2.5 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700"
                                >
                                  {/* Project Title & Task count + Remove Button */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <Briefcase className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 truncate" title={proj.project_name}>
                                        {proj.project_name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700">
                                        {proj.total_tasks} {proj.total_tasks === 1 ? 'task' : 'tasks'}
                                      </span>
                                      {/* Delete / Remove Icon to decouple employee from this project */}
                                      <button
                                        type="button"
                                        disabled={removingState?.employeeId === emp.employee_id && removingState?.projectId === proj.project_id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveEmployeeFromProject(emp, proj);
                                        }}
                                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/60 cursor-pointer disabled:opacity-50"
                                        title={`Remove ${emp.employee_name} from project "${proj.project_name}"`}
                                      >
                                        {removingState?.employeeId === emp.employee_id && removingState?.projectId === proj.project_id ? (
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                        ) : (
                                          <Trash2 className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Multi-Color Visual Progress Bar */}
                                  <div className="space-y-1">
                                    <div className="w-full bg-slate-100 dark:bg-zinc-800/90 h-2 rounded-full overflow-hidden flex shadow-inner">
                                      <div
                                        style={{ width: `${compPct}%` }}
                                        className="bg-emerald-500 h-full"
                                        title={`Completed: ${proj.completed_tasks}`}
                                      />
                                      <div
                                        style={{ width: `${inProgPct}%` }}
                                        className="bg-sky-500 h-full"
                                        title={`In Progress: ${proj.in_progress_tasks}`}
                                      />
                                      <div
                                        style={{ width: `${overduePct}%` }}
                                        className="bg-rose-500 h-full"
                                        title={`Overdue: ${proj.overdue_tasks}`}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                      <span>{compPct}% completed</span>
                                      <span>Est: {proj.total_estimated_hours}h</span>
                                    </div>
                                  </div>

                                  {/* Status Counts Pills */}
                                  <div className="grid grid-cols-4 gap-1 pt-1 border-t border-slate-100 dark:border-zinc-800/60 text-center text-[10px]">
                                    <div className="p-1 rounded bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                                      <span className="text-slate-500 block">Done</span>
                                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{proj.completed_tasks}</span>
                                    </div>
                                    <div className="p-1 rounded bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                                      <span className="text-slate-500 block">Prog</span>
                                      <span className="font-extrabold text-sky-600 dark:text-sky-400">{proj.in_progress_tasks}</span>
                                    </div>
                                    <div className="p-1 rounded bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                                      <span className="text-slate-500 block">Pending</span>
                                      <span className="font-extrabold text-amber-600 dark:text-amber-400">{proj.pending_tasks}</span>
                                    </div>
                                    <div className="p-1 rounded bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                                      <span className="text-slate-500 block">Overdue</span>
                                      <span className={`font-extrabold ${proj.overdue_tasks > 0 ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-400 dark:text-slate-500'}`}>
                                        {proj.overdue_tasks}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* PREVIOUS MEMBERS IN WORKLOAD BY PROJECT (WHEN 'PREVIOUS' OR 'ALL' IS SELECTED) */}
          {memberScopeFilter === 'previous' && (
            filteredPreviousMembers.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800 space-y-2 shadow-sm">
                <UserX className="w-8 h-8 text-amber-500/60 mx-auto" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-400">No previous members match your filters.</p>
                <p className="text-xs text-slate-500">When employees are decoupled from projects, their records and deliverables history will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPreviousMembers.map(m => renderPreviousMemberCard(m))}
              </div>
            )
          )}

          {/* If 'all' is selected and there are previous members, display them in a labeled section below */}
          {memberScopeFilter === 'all' && filteredPreviousMembers.length > 0 && (
            <div className="pt-6 space-y-4">
              <div className="flex items-center justify-between px-1 border-t border-slate-200 dark:border-zinc-800 pt-5">
                <div className="flex items-center gap-2">
                  <UserX className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Previous Members Removed from Projects
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    {filteredPreviousMembers.length}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Deliverables & allocation history for removed staff
                </span>
              </div>
              <div className="space-y-4">
                {filteredPreviousMembers.map(m => renderPreviousMemberCard(m))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: OVERALL EMPLOYEE REPORT (Matrix & Scorecard Leaderboard) */}
      {/* ========================================================================= */}
      {viewMode === 'overall_employee' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Overall Employee Performance & Workload Matrix</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700">
                {reports?.tasksByEmployee?.length || 0} Staff
              </span>
            </h2>
            <span className="text-xs text-slate-500">
              Click any employee to inspect their complete individual performance report
            </span>
          </div>

          <div className="rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Department / Role</th>
                    <th className="py-3.5 px-4">Assigned Projects</th>
                    <th className="py-3.5 px-4 text-center">Total Tasks</th>
                    <th className="py-3.5 px-4 text-center">Completed</th>
                    <th className="py-3.5 px-4 text-center">Active Workload</th>
                    <th className="py-3.5 px-4 text-center">Overdue</th>
                    <th className="py-3.5 px-4">Workload Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {reports?.tasksByEmployee?.map((emp) => {
                    const total = emp.total || 1;
                    const completionPct = Math.round((emp.completed / total) * 100);
                    const workload = getWorkloadLevel((emp.in_progress || 0) + (emp.pending || 0), emp.active_estimated_hours || 0);

                    return (
                      <tr key={emp.employee_id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-850/50">
                        {/* Employee Name & Email */}
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-200">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 font-bold flex items-center justify-center text-xs shrink-0 border border-sky-300 dark:border-sky-500/30">
                              {emp.employee_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="text-slate-900 dark:text-slate-100 font-bold block">{emp.employee_name}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{emp.employee_email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Department / Title */}
                        <td className="py-3 px-4">
                          <span className="text-slate-800 dark:text-slate-300 font-medium block">{emp.department_name || 'General'}</span>
                          <span className="text-[10px] text-slate-500">{emp.employee_title}</span>
                        </td>

                        {/* Projects count */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700 font-bold text-xs inline-flex items-center gap-1">
                            <Briefcase className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                            {emp.project_count || 1} {emp.project_count === 1 ? 'Project' : 'Projects'}
                          </span>
                        </td>

                        {/* Total Tasks */}
                        <td className="py-3 px-4 text-center font-extrabold text-slate-900 dark:text-slate-200">
                          {emp.total}
                        </td>

                        {/* Completed with bar */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {emp.completed} <span className="text-[10px] text-slate-500 dark:text-slate-400">({completionPct}%)</span>
                            </span>
                            <div className="w-16 bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div style={{ width: `${completionPct}%` }} className="bg-emerald-500 h-full rounded-full" />
                            </div>
                          </div>
                        </td>

                        {/* Active Workload */}
                        <td className="py-3 px-4 text-center">
                          <span className="font-extrabold text-indigo-600 dark:text-indigo-400 block">{emp.active_estimated_hours || 0}h</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{(emp.in_progress || 0) + (emp.pending || 0)} tasks</span>
                        </td>

                        {/* Overdue */}
                        <td className="py-3 px-4 text-center">
                          {emp.overdue > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 font-black text-xs">
                              {emp.overdue}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 font-medium">0</span>
                          )}
                        </td>

                        {/* Workload Status */}
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold inline-flex items-center gap-1 ${workload.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${workload.dot}`} />
                            {workload.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedEmployeeForModal(emp.employee_id)}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-600/20 hover:bg-sky-600 text-sky-700 dark:text-sky-400 hover:text-white font-bold text-xs border border-sky-200 dark:border-sky-500/30 cursor-pointer flex items-center gap-1 ml-auto shadow-sm"
                            title="Inspect complete scorecard"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Overall Report</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: PROJECTS OVERVIEW & TEAM ASSIGNMENTS */}
      {/* ========================================================================= */}
      {viewMode === 'by_project' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Project Deliverables & Team Allocation</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700">
                {reports?.tasksByProject?.length || 0} Active Projects
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports?.tasksByProject?.map(p => {
              const total = p.count || 1;
              const completedPct = Math.round(((p.completed || 0) / total) * 100);

              return (
                <div key={p.project_id || p.project_name} className="p-4 rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 space-y-3.5 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        <span>{p.project_name}</span>
                      </h3>
                      {p.department_name && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">{p.department_name}</span>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-xs font-bold">
                      {p.count} Tasks
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden flex">
                      <div style={{ width: `${completedPct}%` }} className="bg-emerald-500 h-full" />
                      <div style={{ width: `${Math.round(((p.in_progress || 0) / total) * 100)}%` }} className="bg-sky-500 h-full" />
                      <div style={{ width: `${Math.round(((p.overdue || 0) / total) * 100)}%` }} className="bg-rose-500 h-full" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 gap-1 flex-wrap">
                      <span>{completedPct}% Completed</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{p.assigned_members_count || 1} Assigned Staff</span>
                        {previousMembersList.some(m => m.project_id === p.project_id) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProjectId(String(p.project_id));
                              setViewMode('previous_members');
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 cursor-pointer transition-all"
                            title={`Inspect previous members removed from ${p.project_name}`}
                          >
                            {previousMembersList.filter(m => m.project_id === p.project_id).length} Previous
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-center text-xs">
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                      <span className="text-[10px] text-slate-500 block uppercase">In Progress</span>
                      <span className="font-extrabold text-sky-600 dark:text-sky-400">{p.in_progress || 0}</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                      <span className="text-[10px] text-slate-500 block uppercase">Overdue</span>
                      <span className="font-extrabold text-rose-600 dark:text-rose-400">{p.overdue || 0}</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                      <span className="text-[10px] text-slate-500 block uppercase">Est Hours</span>
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{p.total_estimated_hours || 0}h</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: PREVIOUS MEMBERS (Members removed from projects & their deliverables) */}
      {/* ========================================================================= */}
      {viewMode === 'previous_members' && (
        <div className="space-y-4">
          {/* Top Banner / Explanation */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-300 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-300 dark:border-amber-700/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Previous Project Members & Unassigned Deliverables</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    {filteredPreviousMembers.length} Record{filteredPreviousMembers.length === 1 ? '' : 's'}
                  </span>
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Historical workload, tasks, and deliverables data for members who were removed or unassigned from projects.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={exportToCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm cursor-pointer transition-all"
                title="Export previous members data to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Previous Members CSV</span>
              </button>
            </div>
          </div>

          {/* Previous Members Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Removed Members</span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
                {filteredPreviousMembers.length}
              </span>
              <span className="text-[11px] text-slate-500">Across all projects</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Impacted Projects</span>
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 block">
                {new Set(filteredPreviousMembers.map(m => m.project_id)).size}
              </span>
              <span className="text-[11px] text-slate-500">Projects with removals</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Historical Deliverables</span>
              <span className="text-xl font-black text-sky-600 dark:text-sky-400 mt-1 block">
                {filteredPreviousMembers.reduce((sum, m) => sum + (m.total_tasks || 0), 0)}
              </span>
              <span className="text-[11px] text-slate-500">Tasks assigned prior to removal</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Historical Est. Hours</span>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                {Math.round(filteredPreviousMembers.reduce((sum, m) => sum + Number(m.total_estimated_hours || 0), 0) * 10) / 10}h
              </span>
              <span className="text-[11px] text-slate-500">Tracked work effort</span>
            </div>
          </div>

          {/* Previous Members Cards List */}
          {filteredPreviousMembers.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800 space-y-2 shadow-sm">
              <UserX className="w-8 h-8 text-amber-500/60 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-400">
                No previous removed members match your filters.
              </p>
              <p className="text-xs text-slate-500">
                When employees are decoupled from projects in Reports & Workload, their complete historical data will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPreviousMembers.map(m => renderPreviousMemberCard(m))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: OVERALL EMPLOYEE REPORT SCORECARD */}
      {/* ========================================================================= */}
      {selectedEmployeeForModal && (
        <EmployeeAnalyticsModal
          employeeId={selectedEmployeeForModal}
          onClose={() => setSelectedEmployeeForModal(null)}
          onRefreshList={() => fetchReports(true)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: TASK DETAILS (Clickable deliverable inspection) */}
      {/* ========================================================================= */}
      {selectedTaskIdForModal && (
        <TaskDetailsModal
          taskId={selectedTaskIdForModal}
          onClose={() => setSelectedTaskIdForModal(null)}
          onTaskUpdated={() => fetchReports(true)}
        />
      )}
    </div>
  );
}
