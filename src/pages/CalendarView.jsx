import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import TaskDetailsModal from '../components/TaskDetailsModal';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

export default function CalendarView() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 1)); // September 2026

  useEffect(() => {
    async function loadTasks() {
      try {
        setLoading(true);
        const res = await api.getTasks({});
        setTasks(res.tasks || []);
      } catch (err) {
        console.error('Failed loading calendar tasks:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTasks();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Helper to match dates in format YYYY-MM-DD
  const getTasksForDay = (dayNum) => {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    return tasks.filter(t => t.due_date === dayStr || t.start_date === dayStr || (t.completed_date && t.completed_date.startsWith(dayStr)));
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-white" />
            Task Deadline Calendar
          </h2>
          <p className="text-xs text-slate-400">Track task start dates, due dates, and completion timelines</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded-lg border border-slate-800">
            <button onClick={prevMonth} className="p-1 text-slate-400 hover:text-white transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-200 min-w-32 text-center">
              {monthNames[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-1 text-slate-400 hover:text-white transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Days Grid */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 shadow-xl overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty slots for previous month offset */}
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-28 rounded-xl bg-slate-950/40 border border-slate-900" />
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dayTasks = getTasksForDay(dayNum);
              const isToday = dayNum === 2 && month === 8 && year === 2026;

              return (
                <div
                  key={dayNum}
                  className={`h-28 p-1.5 rounded-xl border transition flex flex-col justify-between overflow-hidden ${
                    isToday
                      ? 'bg-neutral-800/70 border-neutral-400 shadow-md shadow-white/5'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-extrabold ${isToday ? 'text-white underline decoration-neutral-400 underline-offset-2' : 'text-slate-300'}`}>
                      {dayNum}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-20 mt-1 pr-0.5">
                    {dayTasks.map(t => {
                      const isOverdue = t.status === 'Overdue';
                      const isCompleted = t.status === 'Completed';

                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTaskId(t.id)}
                          className={`p-1 rounded text-[10px] font-medium truncate cursor-pointer transition flex items-center justify-between gap-1 ${
                            isCompleted
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                              : isOverdue
                              ? 'bg-rose-950/90 text-rose-300 border border-rose-800/50'
                              : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
                          }`}
                          title={`${t.task_id}: ${t.title} (${t.status})`}
                        >
                          <span className="truncate">{t.task_id}: {t.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task Details Modal */}
      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
