import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import TaskDetailsModal from './TaskDetailsModal';
import CreateTaskModal from './CreateTaskModal';
import PriorityBadge from '../ui/PriorityBadge';
import StatusBadge from '../ui/StatusBadge';
import {
  X,
  User,
  Mail,
  Building,
  Briefcase,
  CheckCircle2,
  Clock,
  PauseCircle,
  AlertTriangle,
  Layers,
  TrendingUp,
  Award,
  GraduationCap,
  ShieldCheck,
  Calendar,
  Zap,
  Activity,
  PlusCircle,
  RefreshCw,
  Search,
  ChevronRight,
  Sparkles,
  PieChart,
  BarChart3,
  Timer,
  Download,
  CalendarRange,
  FileSpreadsheet,
  Filter
} from 'lucide-react';

export default function EmployeeAnalyticsModal({ employeeId, onClose, onRefreshList }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('ALL');

  // Time-based performance filtering states
  const [timeFrame, setTimeFrame] = useState('all'); // 'all' | 'today' | '7d' | '30d' | 'this_month' | '90d' | 'this_year' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getEmployeeAnalytics(employeeId);
      setData(res);
    } catch (err) {
      console.error('Failed loading employee analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) {
      loadAnalytics();
    }
  }, [employeeId]);

  if (!employeeId) return null;

  const employee = data?.employee;
  const rawTasks = data?.tasks || [];

  // Determine active date boundaries based on timeFrame
  const getDateRange = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (timeFrame === 'all') {
      return { start: null, end: null, label: 'All Time' };
    }
    if (timeFrame === 'today') {
      return { start: todayStr, end: todayStr, label: 'Today' };
    }
    if (timeFrame === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { start: d.toISOString().split('T')[0], end: todayStr, label: 'Last 7 Days' };
    }
    if (timeFrame === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { start: d.toISOString().split('T')[0], end: todayStr, label: 'Last 30 Days' };
    }
    if (timeFrame === 'this_month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: d.toISOString().split('T')[0], end: todayStr, label: 'This Month' };
    }
    if (timeFrame === '90d') {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      return { start: d.toISOString().split('T')[0], end: todayStr, label: 'Last 90 Days' };
    }
    if (timeFrame === 'this_year') {
      const d = new Date(today.getFullYear(), 0, 1);
      return { start: d.toISOString().split('T')[0], end: todayStr, label: 'This Year' };
    }
    if (timeFrame === 'custom') {
      const label = customStartDate && customEndDate
        ? `${customStartDate} to ${customEndDate}`
        : customStartDate
        ? `From ${customStartDate}`
        : customEndDate
        ? `Until ${customEndDate}`
        : 'Custom Range';
      return { start: customStartDate || null, end: customEndDate || null, label };
    }
    return { start: null, end: null, label: 'All Time' };
  };

  const dateRange = getDateRange();

  // Filter tasks belonging to the selected time frame
  const timeFilteredTasks = rawTasks.filter(t => {
    if (!dateRange.start && !dateRange.end) return true;
    const taskDate = t.assigned_date || t.start_date || (t.created_at ? t.created_at.substring(0, 10) : null);
    if (!taskDate) return true;
    if (dateRange.start && taskDate < dateRange.start) return false;
    if (dateRange.end && taskDate > dateRange.end) return false;
    return true;
  });

  // Calculate dynamic live statistics for the selected time window
  const todayStr = new Date().toISOString().split('T')[0];
  let completedCount = 0;
  let inProgressCount = 0;
  let onHoldCount = 0;
  let notStartedCount = 0;
  let overdueCount = 0;
  let onTimeCompletedCount = 0;
  let totalTurnaroundHours = 0;
  let completedWithTurnaroundCount = 0;

  const priorityBreakdown = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  const projectMap = {};

  timeFilteredTasks.forEach(t => {
    // Priority
    if (priorityBreakdown[t.priority] !== undefined) {
      priorityBreakdown[t.priority]++;
    }

    // Project breakdown
    const projKey = t.project_name || 'General';
    if (!projectMap[projKey]) {
      projectMap[projKey] = { project_name: projKey, total: 0, completed: 0, in_progress: 0 };
    }
    projectMap[projKey].total++;

    // Status metrics
    if (t.status === 'Completed') {
      completedCount++;
      projectMap[projKey].completed++;
      if (t.completed_date && t.due_date && t.completed_date <= t.due_date) {
        onTimeCompletedCount++;
      } else if (!t.due_date) {
        onTimeCompletedCount++;
      }

      if (t.completed_date) {
        const parseDateSafe = (s) => {
          if (!s) return null;
          const clean = String(s).trim().replace(' ', 'T');
          const d = new Date(clean);
          return isNaN(d.getTime()) ? null : d;
        };

        const end = parseDateSafe(t.completed_date);
        let startTimeStr = t.start_date || t.assigned_date || t.created_at;
        let start = parseDateSafe(startTimeStr);

        // If start_date is set in the future relative to completed_date, fall back to assignment or creation
        if (start && end && start > end) {
          startTimeStr = t.assigned_date || t.created_at || t.start_date;
          start = parseDateSafe(startTimeStr);
        }

        if (start && end) {
          const diffMs = Math.max(0, end - start);
          const diffHours = diffMs / (1000 * 60 * 60);
          if (!isNaN(diffHours)) {
            totalTurnaroundHours += diffHours;
            completedWithTurnaroundCount++;
          }
        }
      }
    } else if (t.status === 'In Progress') {
      inProgressCount++;
      projectMap[projKey].in_progress++;
    } else if (t.status === 'On Hold') {
      onHoldCount++;
    } else if (t.status === 'Not Started') {
      notStartedCount++;
    }

    if (t.status === 'Overdue' || (t.status !== 'Completed' && t.due_date && t.due_date < todayStr)) {
      overdueCount++;
    }
  });

  const totalTasks = timeFilteredTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const onTimeRate = completedCount > 0 ? Math.round((onTimeCompletedCount / completedCount) * 100) : 100;
  const avgCompletionHours = completedWithTurnaroundCount > 0
    ? (totalTurnaroundHours / completedWithTurnaroundCount)
    : (completedCount > 0 ? 24 : null);

  let formattedAvgTime = '—';
  if (avgCompletionHours !== null && !isNaN(avgCompletionHours)) {
    if (avgCompletionHours < 1) {
      const mins = Math.max(1, Math.round(avgCompletionHours * 60));
      formattedAvgTime = `${mins} min${mins === 1 ? '' : 's'}`;
    } else if (avgCompletionHours < 24) {
      formattedAvgTime = `${avgCompletionHours.toFixed(1)} hrs`;
    } else {
      const days = (avgCompletionHours / 24).toFixed(1);
      formattedAvgTime = `${days} Day${days === '1.0' ? '' : 's'}`;
    }
  }

  const stats = {
    totalTasks,
    completedTasks: completedCount,
    inProgressTasks: inProgressCount,
    onHoldTasks: onHoldCount,
    notStartedTasks: notStartedCount,
    overdueTasks: overdueCount,
    completionRate,
    onTimeRate,
    avgCompletionTime: formattedAvgTime,
    avgCompletionDays: formattedAvgTime
  };

  const projectBreakdown = Object.values(projectMap);

  const filteredTasks = timeFilteredTasks.filter(t => {
    const matchesStatus = taskStatusFilter === 'ALL' || t.status === taskStatusFilter;
    const matchesSearch =
      t.title?.toLowerCase().includes(taskSearch.toLowerCase()) ||
      t.task_id?.toLowerCase().includes(taskSearch.toLowerCase()) ||
      t.project_name?.toLowerCase().includes(taskSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate Donut Angles & SVG paths for Status Breakdown
  const totalForDonut = (stats?.completedTasks || 0) + (stats?.inProgressTasks || 0) + (stats?.onHoldTasks || 0) + (stats?.overdueTasks || 0) + (stats?.notStartedTasks || 0);

  const statusSlices = [
    { label: 'Completed', count: stats?.completedTasks || 0, color: '#10b981', bg: 'bg-emerald-500' },
    { label: 'In Progress', count: stats?.inProgressTasks || 0, color: '#0ea5e9', bg: 'bg-sky-500' },
    { label: 'On Hold', count: stats?.onHoldTasks || 0, color: '#f59e0b', bg: 'bg-amber-500' },
    { label: 'Overdue', count: stats?.overdueTasks || 0, color: '#f43f5e', bg: 'bg-rose-500' },
    { label: 'Not Started', count: stats?.notStartedTasks || 0, color: '#71717a', bg: 'bg-zinc-500' }
  ];

  // Priority total for bars
  const totalPriority = priorityBreakdown.Critical + priorityBreakdown.High + priorityBreakdown.Medium + priorityBreakdown.Low;

  // Handle CSV Report Generation & Download
  const handleDownloadCSV = () => {
    try {
      setIsExporting(true);

      const escapeCSV = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const rows = [];
      // Employee & Report Metadata
      rows.push(['EMPLOYEE PERFORMANCE & DELIVERABLES REPORT']);
      rows.push(['Report Generated At', new Date().toLocaleString()]);
      rows.push(['Employee Name', employee?.name || '']);
      rows.push(['Employee Email', employee?.email || '']);
      rows.push(['Role / Title', employee?.title || employee?.role || 'Employee']);
      rows.push(['Department', employee?.department_name || 'General']);
      rows.push(['Selected Time Frame', dateRange.label]);
      rows.push(['Date Window', `${dateRange.start || 'Beginning'} to ${dateRange.end || 'Present'}`]);
      rows.push([]);

      // Summary KPIs
      rows.push(['PERFORMANCE KPI METRICS (FOR SELECTED TIME FRAME)']);
      rows.push(['Total Assigned Deliverables', stats.totalTasks]);
      rows.push(['Completed Deliverables', stats.completedTasks]);
      rows.push(['In Progress Deliverables', stats.inProgressTasks]);
      rows.push(['On Hold Deliverables', stats.onHoldTasks]);
      rows.push(['Not Started Deliverables', stats.notStartedTasks]);
      rows.push(['Overdue Deliverables', stats.overdueTasks]);
      rows.push(['Completion Rate (%)', `${stats.completionRate}%`]);
      rows.push(['On-Time Delivery Rate (%)', `${stats.onTimeRate}%`]);
      rows.push(['Average Time to Complete', stats.avgCompletionTime || stats.avgCompletionDays]);
      rows.push([]);

      // Priority Breakdown
      rows.push(['PRIORITY BREAKDOWN']);
      rows.push(['Critical Priority', priorityBreakdown.Critical]);
      rows.push(['High Priority', priorityBreakdown.High]);
      rows.push(['Medium Priority', priorityBreakdown.Medium]);
      rows.push(['Low Priority', priorityBreakdown.Low]);
      rows.push([]);

      // Project Workload
      rows.push(['PROJECT WORKLOAD BREAKDOWN']);
      rows.push(['Project Name', 'Total Tasks', 'Completed Tasks', 'In Progress Tasks']);
      projectBreakdown.forEach(p => {
        rows.push([p.project_name, p.total, p.completed, p.in_progress]);
      });
      rows.push([]);

      // Detailed Deliverables Table
      rows.push(['DETAILED TASK DELIVERABLES']);
      rows.push([
        'Task ID',
        'Title',
        'Project',
        'Priority',
        'Status',
        'Start Date',
        'Due Date',
        'Completed Date',
        'Delivery Punctuality',
        'Assigned By',
        'Description'
      ]);

      timeFilteredTasks.forEach(t => {
        let onTime = 'N/A';
        if (t.status === 'Completed') {
          if (!t.due_date || (t.completed_date && t.completed_date <= t.due_date)) {
            onTime = 'On-Time';
          } else {
            onTime = 'Late';
          }
        } else if (t.due_date && t.due_date < todayStr) {
          onTime = 'Overdue';
        }

        rows.push([
          t.task_id || '',
          t.title || '',
          t.project_name || '',
          t.priority || '',
          t.status || '',
          t.start_date || '',
          t.due_date || '',
          t.completed_date || '',
          onTime,
          t.assigned_by_name || '',
          t.description ? t.description.replace(/(\r\n|\n|\r)/gm, ' ') : ''
        ]);
      });

      const csvContent = rows.map(r => r.map(escapeCSV).join(',')).join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cleanName = (employee?.name || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateSuffix = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `${cleanName}_Performance_Report_${timeFrame}_${dateSuffix}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export CSV:', e);
    } finally {
      setTimeout(() => setIsExporting(false), 400);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#09090c] w-full max-w-5xl rounded-2xl border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-zinc-950/95 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500/20 to-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-white font-extrabold text-sm shadow-inner">
              {employee?.name ? employee.name.substring(0, 2).toUpperCase() : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">{employee?.name || 'Employee Profile'}</h3>
                {employee?.role === 'Manager' || employee?.title === 'Manager' ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1 bg-purple-500/20 text-purple-300 border-purple-500/30">
                    <ShieldCheck className="w-3 h-3 text-purple-400" />
                    <span>Manager</span>
                  </span>
                ) : (employee?.role === 'Intern' || employee?.title === 'Intern') ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1 bg-amber-500/20 text-amber-300 border-amber-500/30">
                    <GraduationCap className="w-3 h-3 text-amber-400" />
                    <span>Intern</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                    <Award className="w-3 h-3 text-emerald-400" />
                    <span>{employee?.title || 'Employee'}</span>
                  </span>
                )}
                <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-neutral-500" />
                  {employee?.email}
                </span>
              </div>
              <div className="text-xs text-neutral-400 flex items-center gap-2 mt-0.5">
                <span>Department: <strong className="text-neutral-200">{employee?.department_name || 'General'}</strong></span>
                <span>•</span>
                <span className="text-neutral-300 font-semibold flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" /> Active Team Deliverables
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowCreateTaskModal(true)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-3.5 h-3.5 text-black" />
              <span>Assign Task</span>
            </button>

            <button
              onClick={loadAnalytics}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-neutral-300 border border-zinc-750 text-xs font-semibold flex items-center justify-center transition cursor-pointer shadow-sm"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-zinc-850 transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Scrollable Content */}
        {loading ? (
          <div className="p-16 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-9 h-9 border-4 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-neutral-400">Loading performance metrics & task analytics...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Time-Based Filter & CSV Export Toolbar */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Left: Time Frame Presets */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-300 shrink-0">
                  <CalendarRange className="w-4 h-4 text-sky-400" />
                  <span>Time Frame:</span>
                </div>

                <div className="flex items-center gap-1 flex-wrap bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-[11px]">
                  {[
                    { id: 'all', label: 'All Time' },
                    { id: 'today', label: 'Today' },
                    { id: '7d', label: 'Last 7 Days' },
                    { id: '30d', label: 'Last 30 Days' },
                    { id: 'this_month', label: 'This Month' },
                    { id: '90d', label: 'Last 90 Days' },
                    { id: 'this_year', label: 'This Year' },
                    { id: 'custom', label: 'Custom Range' },
                  ].map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setTimeFrame(preset.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        timeFrame === preset.id
                          ? 'bg-white text-black shadow-sm'
                          : 'text-neutral-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Actions (Download CSV & Active Filter Indicator) */}
              <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  disabled={isExporting}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm transition cursor-pointer border border-emerald-500/40"
                  title="Download CSV performance report for the selected time frame"
                >
                  <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                  <span>{isExporting ? 'Exporting CSV...' : 'Download CSV Report'}</span>
                </button>
              </div>
            </div>

            {/* Custom Date Range Picker (shown only when custom is selected) */}
            {timeFrame === 'custom' && (
              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-750 flex flex-wrap items-center gap-3 text-xs">
                <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" /> Custom Window:
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-neutral-400 font-medium">From:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-white transition"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-neutral-400 font-medium">To:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-white transition"
                  />
                </div>
                {(customStartDate || customEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                    className="text-[11px] font-bold text-rose-400 hover:text-rose-300 transition"
                  >
                    Clear Dates
                  </button>
                )}
                <span className="text-[11px] text-neutral-400 ml-auto font-mono">
                  {timeFilteredTasks.length} deliverables match custom window
                </span>
              </div>
            )}

            {/* Active Range Summary Info */}
            {timeFrame !== 'all' && (
              <div className="px-3.5 py-2 rounded-xl bg-sky-950/20 border border-sky-800/30 flex items-center justify-between text-xs text-sky-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span>Showing performance for <strong>{dateRange.label}</strong> ({dateRange.start || 'Start'} to {dateRange.end || 'Present'})</span>
                </div>
                <span className="font-mono text-[11px] text-sky-400 font-bold">{timeFilteredTasks.length} Deliverables</span>
              </div>
            )}

            {/* 1. Key Performance Metric Cards (Active Frames) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {/* Total Tasks */}
              <div className="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800 shadow-sm">
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3 text-neutral-300" /> Total Given
                </div>
                <div className="text-xl font-black text-white mt-1">{stats?.totalTasks || 0}</div>
                <div className="text-[9px] text-neutral-500">Assigned deliverables</div>
              </div>

              {/* Completed */}
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 shadow-sm">
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Completed
                </div>
                <div className="text-xl font-black text-emerald-400 mt-1">{stats?.completedTasks || 0}</div>
                <div className="text-[9px] text-emerald-500/80">{stats?.completionRate || 0}% Completion Rate</div>
              </div>

              {/* In Progress */}
              <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-800/40 shadow-sm">
                <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-sky-400" /> In Progress
                </div>
                <div className="text-xl font-black text-sky-300 mt-1">{stats?.inProgressTasks || 0}</div>
                <div className="text-[9px] text-sky-500/80">Active ongoing work</div>
              </div>

              {/* On Hold */}
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 shadow-sm">
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <PauseCircle className="w-3 h-3 text-amber-400" /> On Hold
                </div>
                <div className="text-xl font-black text-amber-300 mt-1">{stats?.onHoldTasks || 0}</div>
                <div className="text-[9px] text-amber-500/80">Blocked / Waiting</div>
              </div>

              {/* Overdue */}
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 shadow-sm">
                <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400" /> Overdue
                </div>
                <div className="text-xl font-black text-rose-400 mt-1">{stats?.overdueTasks || 0}</div>
                <div className="text-[9px] text-rose-500/80">Needs acceleration</div>
              </div>

              {/* Average Completion Time */}
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40 shadow-sm">
                <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                  <Timer className="w-3 h-3 text-purple-400" /> Avg Time
                </div>
                <div className="text-lg font-black text-purple-300 mt-1">{stats?.avgCompletionTime || stats?.avgCompletionDays || '—'}</div>
                <div className="text-[9px] text-purple-400/80">Per completed task</div>
              </div>

              {/* On-Time Rate */}
              <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 shadow-sm">
                <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-3 h-3 text-cyan-400" /> On-Time %
                </div>
                <div className="text-xl font-black text-cyan-300 mt-1">{stats?.onTimeRate || 100}%</div>
                <div className="text-[9px] text-cyan-400/80">Punctuality index</div>
              </div>
            </div>

            {/* 2. Visual Graphs & Breakdown Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Chart 1: Status Distribution Donut / Visual Breakdown */}
              <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <PieChart className="w-4 h-4 text-sky-400" />
                    <span>Task Status Breakdown</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono">{totalForDonut} Total</span>
                </div>

                {/* Progress Bar & Legend */}
                <div className="space-y-3 pt-1">
                  {/* Multi-segmented Progress Bar */}
                  <div className="h-3.5 w-full bg-zinc-900 rounded-full overflow-hidden flex shadow-inner border border-zinc-800">
                    {statusSlices.map(slice => {
                      const pct = totalForDonut > 0 ? (slice.count / totalForDonut) * 100 : 0;
                      if (pct <= 0) return null;
                      return (
                        <div
                          key={slice.label}
                          style={{ width: `${pct}%`, backgroundColor: slice.color }}
                          className="h-full transition-all duration-300 hover:brightness-125"
                          title={`${slice.label}: ${slice.count} (${pct.toFixed(0)}%)`}
                        />
                      );
                    })}
                  </div>

                  {/* Status List with Percentages */}
                  <div className="space-y-1.5 text-xs">
                    {statusSlices.map(slice => {
                      const pct = totalForDonut > 0 ? ((slice.count / totalForDonut) * 100).toFixed(0) : 0;
                      return (
                        <div key={slice.label} className="flex items-center justify-between text-neutral-300">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                            <span className="text-[11px]">{slice.label}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <strong className="text-white">{slice.count}</strong>
                            <span className="text-neutral-500">({pct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Chart 2: Priority Distribution Bar Chart */}
              <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <BarChart3 className="w-4 h-4 text-purple-400" />
                    <span>Priority Distribution</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono">{totalPriority} Tasks</span>
                </div>

                <div className="space-y-2.5 pt-1 text-xs">
                  {/* Critical */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Critical
                      </span>
                      <span className="font-mono text-white font-bold">{priorityBreakdown.Critical}</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${totalPriority > 0 ? (priorityBreakdown.Critical / totalPriority) * 100 : 0}%` }}
                        className="h-full bg-rose-500 rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>

                  {/* High */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" /> High
                      </span>
                      <span className="font-mono text-white font-bold">{priorityBreakdown.High}</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${totalPriority > 0 ? (priorityBreakdown.High / totalPriority) * 100 : 0}%` }}
                        className="h-full bg-amber-500 rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>

                  {/* Medium */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-sky-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-sky-500" /> Medium
                      </span>
                      <span className="font-mono text-white font-bold">{priorityBreakdown.Medium}</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${totalPriority > 0 ? (priorityBreakdown.Medium / totalPriority) * 100 : 0}%` }}
                        className="h-full bg-sky-500 rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>

                  {/* Low */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Low
                      </span>
                      <span className="font-mono text-white font-bold">{priorityBreakdown.Low}</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${totalPriority > 0 ? (priorityBreakdown.Low / totalPriority) * 100 : 0}%` }}
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart 3: Project Workload Distribution */}
              <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Briefcase className="w-4 h-4 text-emerald-400" />
                    <span>Project Workload</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono">{projectBreakdown.length} Projects</span>
                </div>

                <div className="space-y-2 pt-1 max-h-[160px] overflow-y-auto pr-1 text-xs">
                  {projectBreakdown.map(p => (
                    <div key={p.project_name} className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-white truncate">{p.project_name}</span>
                        <span className="font-mono text-neutral-400 text-[10px]">
                          <strong className="text-emerald-400">{p.completed}</strong>/{p.total} done
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                        <div
                          style={{ width: `${p.total > 0 ? (p.completed / p.total) * 100 : 0}%` }}
                          className="h-full bg-emerald-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                  {projectBreakdown.length === 0 && (
                    <div className="p-4 text-center text-xs text-neutral-500">
                      No project tasks assigned yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Detailed Tasks Assigned to This Employee */}
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-md space-y-3.5">
              {/* Header Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-850">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-white" />
                  <h4 className="text-xs font-bold text-white">
                    All Deliverables Assigned to {employee?.name}
                  </h4>
                  <span className="text-[10px] text-neutral-400 font-mono">({filteredTasks.length} in {dateRange.label})</span>
                </div>

                {/* Filter and Search */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <select
                    value={taskStatusFilter}
                    onChange={(e) => setTaskStatusFilter(e.target.value)}
                    className="bg-zinc-900 border border-zinc-750 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-white transition"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>

                  <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 text-slate-500 dark:text-neutral-500 absolute left-3 top-2.5 pointer-events-none z-10" />
                    <input
                      type="text"
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                      placeholder="Search tasks..."
                      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-750 rounded-lg py-1 pr-3 !pl-10 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-slate-900 dark:focus:border-white transition"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Tasks Table */}
              <div className="overflow-x-auto rounded-xl border border-zinc-850">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-900/90 text-neutral-400 font-semibold border-b border-zinc-800 text-[11px]">
                      <th className="py-2.5 px-3">Task ID</th>
                      <th className="py-2.5 px-3">Task Title</th>
                      <th className="py-2.5 px-3">Project</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Start Date</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3">Completed Date</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850 text-neutral-200">
                    {filteredTasks.map(task => (
                      <tr key={task.id} className="hover:bg-zinc-900/60 transition group">
                        <td className="py-2.5 px-3 font-mono font-bold text-white text-[11px]">
                          {task.task_id}
                        </td>
                        <td className="py-2.5 px-3 max-w-[200px]">
                          <div className="font-semibold text-white truncate" title={task.title}>
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="text-[10px] text-neutral-400 truncate max-w-[180px]">
                              {task.description}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-medium text-neutral-300">
                            {task.project_name || '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <PriorityBadge priority={task.priority} />
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-400">
                          {task.start_date || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <span className={task.status === 'Overdue' ? 'text-rose-400 font-bold' : 'text-neutral-300'}>
                            {task.due_date || '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-emerald-400 font-semibold">
                          {task.completed_date || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setSelectedTaskId(task.id)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-white hover:text-black text-white text-[11px] font-bold transition cursor-pointer shadow-sm active:scale-95"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredTasks.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-xs text-neutral-500">
                          No deliverables found matching the criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Task Details Modal */}
        {selectedTaskId && (
          <TaskDetailsModal
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            onTaskUpdated={() => {
              loadAnalytics();
              if (onRefreshList) onRefreshList();
            }}
          />
        )}

        {/* Create Task Modal */}
        {showCreateTaskModal && (
          <CreateTaskModal
            onClose={() => setShowCreateTaskModal(false)}
            onTaskCreated={() => {
              loadAnalytics();
              setShowCreateTaskModal(false);
              if (onRefreshList) onRefreshList();
            }}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
