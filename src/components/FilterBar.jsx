import React, { useState, useRef } from 'react';
import { Search, X, Calendar as CalendarIcon, RotateCcw } from 'lucide-react';

export default function FilterBar({
  filters,
  setFilters,
  employees = [],
  projects = [],
  departments = [],
  isManager = true
}) {
  const [showCustomDate, setShowCustomDate] = useState(filters.date_filter === 'Custom');
  const dateInputRef = useRef(null);

  const openCalendarPicker = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') {
        try {
          dateInputRef.current.showPicker();
        } catch (e) {
          dateInputRef.current.focus();
        }
      } else {
        dateInputRef.current.focus();
      }
    }
  };

  const handleChange = (field, value) => {
    if (field === 'date_filter') {
      if (value === 'Custom') {
        setShowCustomDate(true);
      } else if (value === 'Calendar') {
        setShowCustomDate(false);
        setTimeout(() => openCalendarPicker(), 50);
      } else {
        setShowCustomDate(false);
      }
    }
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setFilters({
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
    setShowCustomDate(false);
  };

  const hasActiveFilters = Object.values(filters).some(val => val !== '');

  return (
    <div className="glass-panel p-2.5 rounded-xl border border-white/5 shadow-sm space-y-2">
      {/* Top Search & Reset Row */}
      <div className="flex items-center gap-2">
        {/* Search Field */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by Task ID, Title, or description..."
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
            className="input-field pl-8 pr-7 py-1.5 text-xs h-8"
          />
          {filters.search && (
            <button
              onClick={() => handleChange('search', '')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Reset Button */}
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-900/50 transition shrink-0 h-8"
            title="Reset filters"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Select Filters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-6 gap-2">
        {/* Project */}
        <div>
          <select
            value={filters.project_id}
            onChange={(e) => handleChange('project_id', e.target.value)}
            className="input-field py-1 px-2 text-[11px] h-7.5"
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Department */}
        <div>
          <select
            value={filters.department_id}
            onChange={(e) => handleChange('department_id', e.target.value)}
            className="input-field py-1 px-2 text-[11px] h-7.5"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Assigned To (Manager only) */}
        {isManager && (
          <div>
            <select
              value={filters.assigned_to}
              onChange={(e) => handleChange('assigned_to', e.target.value)}
              className="input-field py-1 px-2 text-[11px] h-7.5"
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Priority */}
        <div>
          <select
            value={filters.priority}
            onChange={(e) => handleChange('priority', e.target.value)}
            className="input-field py-1 px-2 text-[11px] h-7.5"
          >
            <option value="">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <select
            value={filters.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="input-field py-1 px-2 text-[11px] h-7.5"
          >
            <option value="">All Statuses</option>
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="On Hold">On Hold</option>
            <option value="Completed">Completed</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>

        {/* Date Filter & Calendar Trigger */}
        <div className="flex items-center gap-1">
          <select
            value={filters.date_filter}
            onChange={(e) => handleChange('date_filter', e.target.value)}
            className="input-field py-1 px-2 text-[11px] h-7.5 flex-1"
          >
            <option value="">All Time Period</option>
            <option value="Today">Today</option>
            <option value="Yesterday">Yesterday</option>
            <option value="Tomorrow">Tomorrow</option>
            <option value="This Week">This Week</option>
            <option value="Last Week">Last Week</option>
            <option value="This Month">This Month</option>
            <option value="Last Month">Last Month</option>
            <option value="Calendar">📅 Calendar / Set Date</option>
            <option value="Custom">Custom Range...</option>
          </select>

          {/* Calendar Icon Button */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={openCalendarPicker}
              className={`p-1.5 h-7.5 rounded-lg border transition flex items-center justify-center ${
                filters.date_filter === 'Calendar' || (filters.from_date && !showCustomDate)
                  ? 'bg-white text-black border-white shadow-sm'
                  : 'bg-black/90 hover:bg-neutral-900 text-neutral-300 hover:text-white border-neutral-800'
              }`}
              title="Open Calendar to Set Date"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={filters.from_date || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  setFilters(prev => ({
                    ...prev,
                    date_filter: 'Calendar',
                    from_date: val,
                    to_date: val
                  }));
                }
              }}
              className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
            />
          </div>
        </div>
      </div>

      {/* Calendar Specific Date Selector Bar */}
      {filters.date_filter === 'Calendar' && (
        <div className="pt-1.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-neutral-300 font-semibold flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-white" /> Set Calendar Date:
            </span>
            <input
              type="date"
              value={filters.from_date || ''}
              onChange={(e) => {
                const val = e.target.value;
                setFilters(prev => ({
                  ...prev,
                  date_filter: 'Calendar',
                  from_date: val,
                  to_date: val
                }));
              }}
              className="input-field py-0.5 px-2 text-[11px] w-36 h-7 [color-scheme:dark]"
            />
            {filters.from_date && (
              <span className="text-xs text-neutral-400 font-mono">
                Filtering for: <strong className="text-white">{filters.from_date}</strong>
              </span>
            )}
          </div>
          {filters.from_date && (
            <button
              type="button"
              onClick={() => {
                setFilters(prev => ({ ...prev, date_filter: '', from_date: '', to_date: '' }));
              }}
              className="text-neutral-400 hover:text-white text-[11px] flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800"
            >
              <X className="w-3 h-3" /> Clear Date
            </button>
          )}
        </div>
      )}

      {/* Inline Custom Date Range (Only when Custom is selected) */}
      {showCustomDate && (
        <div className="pt-1.5 border-t border-white/5 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-neutral-400 font-medium">Range:</span>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filters.from_date || ''}
              onChange={(e) => handleChange('from_date', e.target.value)}
              className="input-field py-0.5 px-2 text-[11px] w-32 h-7 [color-scheme:dark]"
            />
            <span className="text-neutral-500">to</span>
            <input
              type="date"
              value={filters.to_date || ''}
              onChange={(e) => handleChange('to_date', e.target.value)}
              className="input-field py-0.5 px-2 text-[11px] w-32 h-7 [color-scheme:dark]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
