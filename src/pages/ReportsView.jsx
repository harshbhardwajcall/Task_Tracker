import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { BarChart3, Users, Building, Briefcase, Calendar as CalendarIcon, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function ReportsView() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('This Month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.getReports({
        date_range: dateRange,
        from_date: fromDate,
        to_date: toDate
      });
      setReports(res);
    } catch (err) {
      console.error('Failed loading reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-400">Loading manager analytics reports...</p>
      </div>
    );
  }

  const summary = reports?.summary || {};

  return (
    <div className="space-y-6">
      {/* Title & Filter Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-400" />
            Manager Analytics & Team Workload Reports
          </h2>
          <p className="text-xs text-slate-400">Comprehensive task metrics, department throughput, and employee performance</p>
        </div>

        {/* Date Filter Bar */}
        <div className="flex items-center gap-2 glass-panel p-1.5 rounded-xl border border-slate-800 text-xs">
          <CalendarIcon className="w-3.5 h-3.5 text-sky-400 ml-1" />
          {['Today', 'This Week', 'This Month', 'All Time'].map(period => (
            <button
              key={period}
              onClick={() => setDateRange(period === 'All Time' ? '' : period)}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                (dateRange === period || (!dateRange && period === 'All Time'))
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase">Total Tasks</span>
          <div className="text-3xl font-extrabold text-slate-100 mt-1">{summary.total_tasks || 0}</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-emerald-800/40 bg-emerald-950/20">
          <span className="text-xs font-semibold text-emerald-400 uppercase">Completed Tasks</span>
          <div className="text-3xl font-extrabold text-emerald-400 mt-1">{summary.completed_tasks || 0}</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-sky-800/40 bg-sky-950/20">
          <span className="text-xs font-semibold text-sky-400 uppercase">In Progress / Pending</span>
          <div className="text-3xl font-extrabold text-sky-400 mt-1">
            {(summary.in_progress_tasks || 0) + (summary.pending_tasks || 0)}
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-rose-800/40 bg-rose-950/20">
          <span className="text-xs font-semibold text-rose-400 uppercase">Overdue Tasks</span>
          <div className="text-3xl font-extrabold text-rose-400 mt-1">{summary.overdue_tasks || 0}</div>
        </div>
      </div>

      {/* Grid: Employee Workload & Department Throughput */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Employee */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Employee Workload & Completion
            </h3>
          </div>

          <div className="space-y-3">
            {reports?.tasksByEmployee?.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No employee task data available.</p>
            ) : (
              reports.tasksByEmployee.map(emp => {
                const total = emp.total || 1;
                const completedPct = Math.round((emp.completed / total) * 100);

                return (
                  <div key={emp.employee_name} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-slate-200">{emp.employee_name}</span>
                      <span className="text-slate-400">
                        {emp.completed}/{emp.total} Completed ({completedPct}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                      <div style={{ width: `${(emp.completed / total) * 100}%` }} className="bg-emerald-500 h-full" title="Completed" />
                      <div style={{ width: `${(emp.in_progress / total) * 100}%` }} className="bg-sky-500 h-full" title="In Progress" />
                      <div style={{ width: `${(emp.overdue / total) * 100}%` }} className="bg-rose-500 h-full" title="Overdue" />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>In Progress: <strong className="text-sky-300">{emp.in_progress}</strong></span>
                      <span>Overdue: <strong className="text-rose-400">{emp.overdue}</strong></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Tasks by Department */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Building className="w-4 h-4 text-purple-400" />
              Tasks by Department
            </h3>
          </div>

          <div className="space-y-3">
            {reports?.tasksByDepartment?.map(dept => {
              const maxCount = Math.max(...(reports.tasksByDepartment.map(d => d.count)), 1);
              const pct = Math.round((dept.count / maxCount) * 100);

              return (
                <div key={dept.department_name} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-200">{dept.department_name}</span>
                    <span className="text-sky-400 font-bold">{dept.count} Tasks</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div style={{ width: `${pct}%` }} className="bg-gradient-to-r from-purple-500 to-sky-500 h-full rounded-full" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid: Tasks by Project & Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Project */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-amber-400" />
            Tasks by Project
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {reports?.tasksByProject?.map(p => (
              <div key={p.project_name} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 truncate">{p.project_name}</span>
                <span className="font-extrabold text-amber-400 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40">
                  {p.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks by Priority */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-400" />
            Tasks by Priority Breakdown
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {reports?.tasksByPriority?.map(p => (
              <div key={p.priority} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">{p.priority}</span>
                <span className="font-extrabold text-sky-400 px-2 py-0.5 rounded bg-sky-950/40 border border-sky-800/40">
                  {p.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
