import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import {
  FolderKanban,
  NotebookPen,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Search,
  CheckSquare,
  FileCode2,
  StickyNote,
  ListTodo,
  X,
  Edit2,
  Eye,
  Copy,
  Check,
  Calendar as CalendarIcon,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Repeat,
  Bell,
  Briefcase
} from 'lucide-react';

export default function SelfLogsView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'notes' | 'calendar'
  const [logs, setLogs] = useState([]);
  const [companyTasks, setCompanyTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Copy Feedback State
  const [copiedId, setCopiedId] = useState(null);

  const handleCopyText = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleCopyItem = (title, description, id) => {
    const cleanTitle = (title || '').trim();
    const cleanDesc = (description || '').trim();
    let textToCopy = '';
    if (cleanTitle && cleanDesc) {
      textToCopy = `${cleanTitle}\n\n${cleanDesc}`;
    } else {
      textToCopy = cleanTitle || cleanDesc || '';
    }
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // View Task & Note Modal State
  const [viewingTask, setViewingTask] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);

  // Task Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    log_id: '',
    title: '',
    description: '',
    project_id: '',
    project_name: '',
    custom_project: false,
    status: 'Not Started',
    start_date: new Date().toISOString().split('T')[0],
    due_date: '',
    completed_date: '',
    is_loop: false,
    loop_interval_hours: 24,
    links: [{ title: '', url: '' }]
  });

  // Note Modal State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteForm, setNoteForm] = useState({
    log_id: '',
    title: '',
    description: ''
  });

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [logsRes, tasksRes, projectsRes] = await Promise.all([
        api.getSelfLogs(),
        api.getTasks().catch(() => ({ tasks: [] })),
        api.getProjects().catch(() => ({ projects: [] }))
      ]);
      const rawLogs = logsRes.logs || [];
      const sanitizedLogs = rawLogs.map((l) => {
        let parsedLinks = [];
        if (Array.isArray(l.links)) {
          parsedLinks = l.links;
        } else if (typeof l.links === 'string') {
          try {
            parsedLinks = JSON.parse(l.links);
          } catch (e) {
            parsedLinks = [];
          }
        }
        return {
          ...l,
          links: Array.isArray(parsedLinks) ? parsedLinks : []
        };
      });
      setLogs(sanitizedLogs);
      setCompanyTasks(tasksRes.tasks || []);
      setProjects(projectsRes.projects || []);
    } catch (err) {
      console.error('Failed loading personal hub data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filter personal tasks vs quick notes
  const personalTasks = logs.filter(
    (l) =>
      (!l.type || l.type === 'task') &&
      (!searchQuery ||
        l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (l.project_name && l.project_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (l.log_id && l.log_id.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const quickNotes = logs.filter(
    (l) =>
      l.type === 'note' &&
      (!searchQuery ||
        l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (l.log_id && l.log_id.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  // -------------------------------------------------------------
  // Task Handlers
  // -------------------------------------------------------------
  const handleOpenCreateTask = () => {
    setEditingTask(null);
    setTaskForm({
      log_id: '',
      title: '',
      description: '',
      project_id: '',
      project_name: '',
      custom_project: false,
      status: 'Not Started',
      start_date: new Date().toISOString().split('T')[0],
      due_date: '',
      completed_date: '',
      is_loop: false,
      loop_interval_hours: 24,
      links: [{ title: '', url: '' }]
    });
    setShowTaskModal(true);
  };

  const handleOpenCreateTaskForDate = (dateStr) => {
    setEditingTask(null);
    setTaskForm({
      log_id: '',
      title: '',
      description: '',
      project_id: '',
      project_name: '',
      custom_project: false,
      status: 'Not Started',
      start_date: dateStr,
      due_date: dateStr,
      completed_date: '',
      is_loop: false,
      loop_interval_hours: 24,
      links: [{ title: '', url: '' }]
    });
    setShowTaskModal(true);
  };

  const handleOpenEditTask = (task) => {
    setEditingTask(task);
    let parsedLinks = [];
    if (Array.isArray(task.links)) {
      parsedLinks = task.links;
    } else if (typeof task.links === 'string') {
      try {
        parsedLinks = JSON.parse(task.links);
      } catch (e) {
        parsedLinks = [];
      }
    }

    const normalizedLinks = Array.isArray(parsedLinks) && parsedLinks.length > 0
      ? parsedLinks.map((l) => (typeof l === 'string' ? { title: '', url: l } : { title: l.title || '', url: l.url || '' }))
      : [{ title: '', url: '' }];

    const isCustom = !task.project_id && Boolean(task.project_name);

    setTaskForm({
      log_id: task.log_id || '',
      title: task.title || '',
      description: task.description || task.content || '',
      project_id: task.project_id ? String(task.project_id) : (isCustom ? '__custom__' : ''),
      project_name: task.project_name || '',
      custom_project: isCustom,
      status: task.status || 'Not Started',
      start_date: task.start_date || '',
      due_date: task.due_date || '',
      completed_date: task.completed_date || '',
      is_loop: Boolean(task.is_loop),
      loop_interval_hours: task.loop_interval_hours || 24,
      links: normalizedLinks
    });
    setShowTaskModal(true);
  };

  const handleAddLinkInput = () => {
    setTaskForm((prev) => ({
      ...prev,
      links: [...(prev.links || []), { title: '', url: '' }]
    }));
  };

  const handleUpdateLink = (index, field, value) => {
    setTaskForm((prev) => {
      const updated = [...(prev.links || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, links: updated };
    });
  };

  const handleRemoveLink = (index) => {
    setTaskForm((prev) => {
      const updated = (prev.links || []).filter((_, i) => i !== index);
      return {
        ...prev,
        links: updated.length > 0 ? updated : [{ title: '', url: '' }]
      };
    });
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    // Filter out empty rows and format URLs
    const validLinks = (taskForm.links || [])
      .filter((l) => l && l.url && l.url.trim())
      .map((l) => {
        const trimmedUrl = l.url.trim();
        const cleanUrl = trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
          ? trimmedUrl
          : `https://${trimmedUrl}`;
        const cleanTitle = (l.title && l.title.trim()) || trimmedUrl.replace(/^https?:\/\//i, '');
        return { title: cleanTitle, url: cleanUrl };
      });

    // Auto-compute completed date based on status
    let autoCompletedDate = null;
    if (taskForm.status === 'Completed') {
      autoCompletedDate = taskForm.completed_date || new Date().toISOString().split('T')[0];
    }

    let finalProjId = null;
    let finalProjName = null;

    if (taskForm.project_id === '__custom__' || taskForm.custom_project) {
      finalProjId = null;
      finalProjName = taskForm.project_name ? taskForm.project_name.trim() : null;
    } else if (taskForm.project_id) {
      finalProjId = Number(taskForm.project_id);
      const matched = projects.find(p => String(p.id) === String(taskForm.project_id));
      finalProjName = matched ? matched.name : (taskForm.project_name || null);
    }

    try {
      const payload = {
        type: 'task',
        log_id: taskForm.log_id || undefined,
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        project_id: finalProjId,
        project_name: finalProjName,
        status: taskForm.status,
        start_date: taskForm.start_date || null,
        due_date: taskForm.due_date || null,
        completed_date: autoCompletedDate,
        is_loop: taskForm.is_loop ? 1 : 0,
        loop_interval_hours: Math.max(0.1, Number(taskForm.loop_interval_hours) || 24),
        links: validLinks
      };

      if (editingTask) {
        await api.updateSelfLog(editingTask.id, payload);
      } else {
        await api.createSelfLog(payload);
      }

      setShowTaskModal(false);
      loadAllData();
    } catch (err) {
      alert(err.message || 'Failed to save task.');
    }
  };

  // -------------------------------------------------------------
  // Note Handlers
  // -------------------------------------------------------------
  const handleOpenCreateNote = () => {
    setEditingNote(null);
    setNoteForm({
      log_id: '',
      title: '',
      description: ''
    });
    setShowNoteModal(true);
  };

  const handleOpenEditNote = (note) => {
    setEditingNote(note);
    setNoteForm({
      log_id: note.log_id || '',
      title: note.title || '',
      description: note.description || note.content || ''
    });
    setShowNoteModal(true);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteForm.title.trim()) return;

    try {
      const payload = {
        type: 'note',
        log_id: noteForm.log_id || undefined,
        title: noteForm.title.trim(),
        description: noteForm.description.trim()
      };

      if (editingNote) {
        await api.updateSelfLog(editingNote.id, payload);
      } else {
        await api.createSelfLog(payload);
      }

      setShowNoteModal(false);
      loadAllData();
    } catch (err) {
      alert(err.message || 'Failed to save note.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await api.deleteSelfLog(id);
      loadAllData();
    } catch (err) {
      alert(err.message || 'Failed to delete item.');
    }
  };

  // Quick status toggle on card
  const handleToggleTaskStatus = async (task) => {
    const statusCycle = ['Not Started', 'In Progress', 'On Hold', 'Completed'];
    const currentIndex = statusCycle.indexOf(task.status || 'Not Started');
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
    const completedDate = nextStatus === 'Completed' ? new Date().toISOString().split('T')[0] : null;

    try {
      await api.updateSelfLog(task.id, {
        ...task,
        status: nextStatus,
        completed_date: completedDate
      });
      loadAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // -------------------------------------------------------------
  // Calendar Helpers & Logic
  // -------------------------------------------------------------
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Map dates to tasks (aggregating personal tasks and company tasks)
  const getTasksForDate = (dateStr) => {
    const isDateMatch = (dateVal) => {
      if (!dateVal) return false;
      return String(dateVal).slice(0, 10) === dateStr;
    };

    const personal = logs.filter(
      (l) =>
        (!l.type || l.type === 'task') &&
        (isDateMatch(l.due_date) || isDateMatch(l.start_date) || isDateMatch(l.completed_date))
    );
    const company = companyTasks.filter(
      (t) =>
        isDateMatch(t.due_date) || isDateMatch(t.start_date) || isDateMatch(t.completed_date)
    );
    return { personal, company, all: [...personal, ...company] };
  };

  // Monthly statistics for calendar header & indicators
  const monthStats = useMemo(() => {
    let notStarted = 0;
    let inProgress = 0;
    let completed = 0;
    let onHold = 0;
    let total = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const { all } = getTasksForDate(dateStr);
      total += all.length;
      all.forEach((t) => {
        if (t.status === 'Completed' || (t.completed_date && String(t.completed_date).slice(0, 10) === dateStr)) {
          completed++;
        } else if (t.status === 'In Progress') {
          inProgress++;
        } else if (t.status === 'On Hold') {
          onHold++;
        } else {
          notStarted++;
        }
      });
    }

    return { notStarted, inProgress, completed, onHold, total };
  }, [year, month, logs, companyTasks, daysInMonth]);

  return (
    <div className="space-y-3.5 animate-in fade-in duration-300">
      {/* Row 1: Unified Header (Title + Tabs + Search/Action Buttons) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
        {/* Left: Page Title */}
        <div className="shrink-0">
          <h1 className="text-lg md:text-xl font-black text-slate-100 flex items-center gap-2">
            <NotebookPen className="w-5 h-5 text-purple-400" />
            <span>Personal Workspace & Self-Logs</span>
          </h1>
        </div>

        {/* Right: Tabs, Search Bar, and Action Buttons in one row */}
        <div className="flex items-center gap-2.5 flex-wrap lg:flex-nowrap">
          {/* Tabs Group */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-slate-800/80 shrink-0">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>Personal Tasks ({personalTasks.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'notes'
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <StickyNote className="w-3.5 h-3.5" />
              <span>Quick Notes ({quickNotes.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-sky-600/30 text-sky-300 border border-sky-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Schedule Calendar</span>
            </button>
          </div>

          {/* Search bar when on tasks or notes */}
          {activeTab !== 'calendar' && (
            <div className="relative w-48 sm:w-56 hidden sm:block shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field py-1 text-xs w-full"
                style={{ paddingLeft: '2.5rem' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  title="Clear Search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Action Button */}
          {activeTab === 'tasks' && (
            <button
              onClick={handleOpenCreateTask}
              className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 cursor-pointer shadow-md shadow-purple-950/40 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </button>
          )}

          {activeTab === 'notes' && (
            <button
              onClick={handleOpenCreateNote}
              className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 cursor-pointer shadow-md shadow-amber-950/40 bg-amber-600 hover:bg-amber-500 border-amber-500 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Note</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 1. PERSONAL TASKS TAB */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading tasks...</div>
          ) : personalTasks.length === 0 ? (
            <div className="glass-card p-12 text-center rounded-2xl border border-slate-800 space-y-3">
              <ListTodo className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">No Personal Tasks Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Create self-assigned tasks with due dates, descriptions, and reference links.
              </p>
              <button onClick={handleOpenCreateTask} className="btn-primary text-xs mt-2">
                <Plus className="w-3.5 h-3.5" />
                <span>Create Task</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {personalTasks.map((task) => (
                <div
                  key={task.id}
                  className="glass-card p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/80">
                          {task.log_id || `PTASK-${task.id}`}
                        </span>
                        {task.project_name && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/80 max-w-[130px] truncate"
                            title={`Project: ${task.project_name}`}
                          >
                            <Briefcase className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{task.project_name}</span>
                          </span>
                        )}
                        {Boolean(task.is_loop) && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-950/70 text-indigo-300 border border-indigo-800"
                            title={`Repeat Task: Every ${task.loop_interval_hours || 24}h • Cycle #${task.loop_count || 0}${task.next_run_at ? ` • Next reset: ${new Date(task.next_run_at).toLocaleString()}` : ''}`}
                          >
                            <Repeat className="w-2.5 h-2.5 text-indigo-400" />
                            <span>Every {task.loop_interval_hours || 24}h</span>
                            {task.loop_count > 0 && <span className="text-[9px] opacity-80">#{task.loop_count}</span>}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleToggleTaskStatus(task)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                          task.status === 'Completed'
                            ? 'bg-blue-950/70 text-blue-300 border-blue-800'
                            : task.status === 'In Progress'
                            ? 'bg-sky-950/70 text-sky-300 border-sky-800'
                            : task.status === 'On Hold'
                            ? 'bg-rose-950/70 text-rose-300 border-rose-800'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                        title="Click to cycle status"
                      >
                        {task.status || 'Not Started'}
                      </button>
                    </div>

                    {/* Task Title */}
                    <h3 className="text-sm font-bold text-slate-100 break-words [overflow-wrap:anywhere]">{task.title}</h3>

                    {/* Description */}
                    {task.description && (
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {task.description}
                      </p>
                    )}

                    {/* Links */}
                    {task.links && task.links.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Links ({task.links.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {task.links.map((link, idx) => (
                            <a
                              key={idx}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-700/80 truncate max-w-[200px]"
                            >
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{link.title || link.url}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dates & Progress Bar Section */}
                  <div className="pt-2.5 border-t border-slate-800/80 space-y-2 text-[11px]">
                    <div className="grid grid-cols-2 gap-1 text-slate-400">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase font-bold">Start:</span>
                        <span>{task.start_date || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase font-bold">Due Date:</span>
                        <span className={task.due_date ? 'text-amber-400 font-semibold' : 'text-slate-500'}>
                          {task.due_date || 'No Due Date'}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar with View Icon and Completed Date on Left Side */}
                    <div className="space-y-1.5 pt-1">
                      {/* Visual progress bar track */}
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            task.status === 'Completed'
                              ? 'w-full bg-blue-500'
                              : task.status === 'In Progress'
                              ? 'w-1/2 bg-sky-500'
                              : task.status === 'On Hold'
                              ? 'w-1/2 bg-rose-500'
                              : 'w-0 bg-slate-700'
                          }`}
                        />
                      </div>

                      {/* Bar controls: Left side has View icon & completed date; Right side has Edit & Delete */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        {/* Left Side: View Icon, Copy Button & Completion Date (when completed) */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => setViewingTask(task)}
                            className="p-1 rounded-md text-slate-400 hover:text-purple-400 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 shrink-0"
                            title="View Task Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold text-slate-400 hover:text-purple-300">View</span>
                          </button>

                          {(task.description || task.title) && (
                            <button
                              type="button"
                              onClick={() => handleCopyItem(task.title, task.description, `task-${task.id}`)}
                              className="p-1 rounded-md text-slate-400 hover:text-purple-400 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 shrink-0"
                              title="Copy Title & Description"
                            >
                              {copiedId === `task-${task.id}` ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-[10px] text-emerald-400 font-semibold">Copied</span>
                                </>
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          {task.status === 'Completed' && (
                            <span className="text-[10px] font-bold text-blue-400 bg-blue-950/70 px-1.5 py-0.5 rounded border border-blue-800/80 truncate">
                              ✓ {task.completed_date || 'Done'}
                            </span>
                          )}
                        </div>

                        {/* Right Side: Edit & Delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTask(task)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition cursor-pointer"
                            title="Edit Task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(task.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. QUICK NOTES TAB (Minimal Note Cards) */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading notes...</div>
          ) : quickNotes.length === 0 ? (
            <div className="glass-card p-12 text-center rounded-2xl border border-slate-800 space-y-3">
              <StickyNote className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">No Quick Notes</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Add simple scratchpad cards with only Note ID, Title, Description, and Actions.
              </p>
              <button
                onClick={handleOpenCreateNote}
                className="btn-primary text-xs mt-2 bg-amber-600 hover:bg-amber-500 border-amber-500"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Note</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickNotes.map((note) => (
                <div
                  key={note.id}
                  className="glass-card p-4 rounded-xl border border-amber-900/30 bg-amber-950/10 hover:border-amber-700/50 transition flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    {/* Note ID Header */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/80">
                        {note.log_id || `NOTE-${note.id}`}
                      </span>
                      <StickyNote className="w-3.5 h-3.5 text-amber-400/70" />
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-slate-100 break-words [overflow-wrap:anywhere]">{note.title}</h3>

                    {/* Description (Contained with line-clamp so big text doesn't spill out) */}
                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed line-clamp-4 break-words [overflow-wrap:anywhere]">
                      {note.description || note.content}
                    </p>
                  </div>

                  {/* Actions: View & Copy on Left, Edit & Delete on Right */}
                  <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewingNote(note)}
                        className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                        title="View Full Note"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold text-slate-400 hover:text-amber-300">View</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyItem(note.title, note.description || note.content, `note-${note.id}`)}
                        className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                        title="Copy Title & Note Content"
                      >
                        {copiedId === `note-${note.id}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[10px] text-emerald-400 font-semibold">Copied</span>
                          </>
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditNote(note)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition cursor-pointer"
                        title="Edit Note"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                        title="Delete Note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. CALENDAR OPTION (With Yellow, Blue, Red Dots + Legends) */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'calendar' && (
        <div className="space-y-3">
          {/* Unified Header & Legends Bar (Single Row) */}
          <div className="flex flex-wrap items-center justify-between gap-3 glass-card px-4 py-2.5 rounded-2xl border border-slate-800 shadow-lg">
            {/* Left: Month Title & Stats */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500/20 to-purple-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-sm">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1.5 leading-tight">
                  <span>{monthNames[month]} {year}</span>
                </h2>
                <p className="text-[10px] text-slate-400 leading-tight">
                  {monthStats.total} {monthStats.total === 1 ? 'task' : 'tasks'} scheduled this month
                </p>
              </div>
            </div>

            {/* Center: Status Legends */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
              {/* Not Started (🟡) */}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-950/40 border border-amber-900/50 text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-500/50"></span>
                <span className="font-semibold text-[11px]">Not Started</span>
              </div>

              {/* In Progress (🔷) */}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-950/40 border border-sky-900/50 text-sky-300">
                <span className="w-2 h-2 rounded-full bg-sky-400 inline-block shadow-sm shadow-sky-500/50"></span>
                <span className="font-semibold text-[11px]">In Progress</span>
              </div>

              {/* Completed (🔵) */}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-950/40 border border-blue-900/50 text-blue-300">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block shadow-sm shadow-blue-500/50"></span>
                <span className="font-semibold text-[11px]">Completed</span>
              </div>

              {/* On Hold (🔴) */}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-950/40 border border-rose-900/50 text-rose-300">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shadow-sm shadow-rose-500/50"></span>
                <span className="font-semibold text-[11px]">On Hold</span>
              </div>

              {/* Multiple Tasks on Date (●+) */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-purple-950/40 border border-purple-900/50 text-purple-300">
                <span className="text-[10px] font-black text-amber-300 px-1 py-0.2 rounded bg-amber-950/90 border border-amber-800/90 leading-none shadow-sm">
                  ●+
                </span>
                <span className="font-semibold text-[11px] text-purple-300">Multiple Tasks on Date</span>
              </div>
            </div>

            {/* Right: Month Navigation Controls */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex items-center justify-center"
                title="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCurrentDate(now);
                  setSelectedCalendarDate(now.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-800 hover:border-slate-700 transition cursor-pointer shadow-sm"
              >
                Today
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex items-center justify-center"
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Monthly Grid (Compact to fit single window frame) */}
          <div className="glass-panel rounded-2xl border border-slate-800 p-2.5 sm:p-3.5 shadow-xl">
            {/* Days of week with different colors, Dark Red for Sun */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[11px] font-bold uppercase tracking-wider mb-1.5">
              {[
                { name: 'Sun', style: 'bg-red-900/90 text-red-100 border border-red-700 shadow-sm font-black' },
                { name: 'Mon', style: 'bg-blue-950/60 text-blue-300 border border-blue-900/50' },
                { name: 'Tue', style: 'bg-cyan-950/60 text-cyan-300 border border-cyan-900/50' },
                { name: 'Wed', style: 'bg-purple-950/60 text-purple-300 border border-purple-900/50' },
                { name: 'Thu', style: 'bg-emerald-950/60 text-emerald-300 border border-emerald-900/50' },
                { name: 'Fri', style: 'bg-amber-950/60 text-amber-300 border border-amber-900/50' },
                { name: 'Sat', style: 'bg-orange-950/60 text-orange-300 border border-orange-900/50' }
              ].map((dayObj) => (
                <div
                  key={dayObj.name}
                  className={`py-1 rounded-md transition ${dayObj.style}`}
                >
                  {dayObj.name}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {/* Empty leading cells */}
              {Array.from({ length: firstDayIndex }).map((_, idx) => {
                const isSundayCol = idx % 7 === 0;
                return (
                  <div
                    key={`empty-${idx}`}
                    className={`min-h-[50px] sm:min-h-[56px] md:min-h-[60px] rounded-xl border ${
                      isSundayCol
                        ? 'border-red-900/40 bg-red-950/25'
                        : 'border-slate-800/80 bg-slate-900/40'
                    }`}
                  />
                );
              })}

              {/* Day Cells */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isToday = new Date().toISOString().split('T')[0] === dateStr;
                const isSelected = selectedCalendarDate === dateStr;
                const isSunday = (firstDayIndex + idx) % 7 === 0;
                const { all } = getTasksForDate(dateStr);

                // Check indicators for each status
                const notStartedTasks = all.filter((t) => t.status === 'Not Started' || (!t.status && !t.completed_date));
                const inProgressTasks = all.filter((t) => t.status === 'In Progress');
                const completedTasks = all.filter((t) => t.status === 'Completed' || (t.completed_date && String(t.completed_date).slice(0, 10) === dateStr));
                const onHoldTasks = all.filter((t) => t.status === 'On Hold');

                const hasNotStarted = notStartedTasks.length > 0;
                const hasInProgress = inProgressTasks.length > 0;
                const hasCompleted = completedTasks.length > 0;
                const hasOnHold = onHoldTasks.length > 0;
                const isMultiple = all.length > 1;

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedCalendarDate(isSelected ? null : dateStr)}
                    className={`min-h-[50px] sm:min-h-[56px] md:min-h-[60px] p-1.5 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col justify-between group relative select-none ${
                      isSelected
                        ? 'border-purple-500/90 bg-purple-950/40 shadow-md shadow-purple-950/30 ring-2 ring-purple-500/40'
                        : isToday
                        ? 'border-sky-500/80 bg-sky-950/25 shadow-sm shadow-sky-950/30 ring-1 ring-sky-500/40'
                        : isSunday
                        ? 'border-red-900/50 bg-red-950/30 hover:border-red-700/60 hover:bg-red-950/45'
                        : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-855 hover:shadow-sm'
                    }`}
                  >
                    {/* Top Row: Day Number + Total Task Count */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] sm:text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center transition ${
                          isToday
                            ? 'bg-sky-500 text-white font-black shadow-sm shadow-sky-500/50'
                            : isSelected
                            ? 'bg-purple-600 text-white font-black'
                            : isSunday
                            ? 'text-red-300 font-extrabold group-hover:text-red-200'
                            : 'text-slate-300 group-hover:text-white'
                        }`}
                      >
                        {dayNum}
                      </span>

                      {all.length > 0 && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full leading-none transition ${
                            isSelected
                              ? 'bg-purple-900/80 text-purple-200 border border-purple-700'
                              : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                          }`}
                        >
                          {all.length}
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Status Indicator Dots & Multiple Tasks Badge */}
                    <div className="flex items-center gap-1 flex-wrap pt-0.5 min-h-[12px]">
                      {/* Multiple Tasks Indicator (●+) */}
                      {isMultiple && (
                        <span
                          className="text-[8px] sm:text-[9px] font-black text-amber-300 px-0.5 py-0.2 rounded bg-amber-950/90 border border-amber-800/90 leading-none shadow-sm"
                          title={`${all.length} tasks on this date`}
                        >
                          ●+
                        </span>
                      )}

                      {/* Not Started Dot (🟡) */}
                      {hasNotStarted && (
                        <span
                          className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50 inline-block"
                          title={`${notStartedTasks.length} Not Started`}
                        />
                      )}

                      {/* In Progress Dot (🔷) */}
                      {hasInProgress && (
                        <span
                          className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50 inline-block"
                          title={`${inProgressTasks.length} In Progress`}
                        />
                      )}

                      {/* Completed Dot (🔵) */}
                      {hasCompleted && (
                        <span
                          className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50 inline-block"
                          title={`${completedTasks.length} Completed`}
                        />
                      )}

                      {/* On Hold Dot (🔴) */}
                      {hasOnHold && (
                        <span
                          className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50 inline-block"
                          title={`${onHoldTasks.length} On Hold`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Empty trailing cells to complete the last week */}
              {Array.from({ length: (7 - ((firstDayIndex + daysInMonth) % 7)) % 7 }).map((_, idx) => {
                const colIdx = (firstDayIndex + daysInMonth + idx) % 7;
                const isSundayCol = colIdx === 0;
                return (
                  <div
                    key={`empty-trailing-${idx}`}
                    className={`min-h-[50px] sm:min-h-[56px] md:min-h-[60px] rounded-xl border ${
                      isSundayCol
                        ? 'border-red-900/40 bg-red-950/25'
                        : 'border-slate-800/80 bg-slate-900/40'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Selected Date Inspector Panel */}
          {selectedCalendarDate && (
            <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-purple-500/40 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header with Date title, Add Task button, and Close */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-800/60 text-purple-400">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-100">
                      {new Date(selectedCalendarDate + 'T00:00:00').toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {(() => {
                        const { all } = getTasksForDate(selectedCalendarDate);
                        return all.length === 0
                          ? 'No tasks scheduled'
                          : `${all.length} ${all.length === 1 ? 'task' : 'tasks'} found`;
                      })()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenCreateTaskForDate(selectedCalendarDate)}
                    className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 cursor-pointer shadow-md shadow-purple-950/30"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Task for this Date</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCalendarDate(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    title="Close Panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tasks List for Selected Date */}
              {(() => {
                const { all } = getTasksForDate(selectedCalendarDate);
                if (all.length === 0) {
                  return (
                    <div className="py-8 text-center space-y-2">
                      <p className="text-xs text-slate-400">No tasks scheduled, assigned, or completed on this date.</p>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateTaskForDate(selectedCalendarDate)}
                        className="text-xs text-purple-400 hover:text-purple-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add personal task now</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-800/80 mt-2">
                    {all.map((t, idx) => {
                      const isPersonal = !t.type || t.type === 'task';
                      const desc = t.description || t.content || '';
                      return (
                        <div key={idx} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs group">
                          {/* Left: Task Info */}
                          <div className="space-y-1.5 min-w-0 max-w-xl">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Status Badge */}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                  t.status === 'Completed'
                                    ? 'bg-blue-950/70 text-blue-300 border-blue-800'
                                    : t.status === 'In Progress'
                                    ? 'bg-sky-950/70 text-sky-300 border-sky-800'
                                    : t.status === 'On Hold'
                                    ? 'bg-rose-950/70 text-rose-300 border-rose-800'
                                    : 'bg-amber-950/70 text-amber-300 border-amber-800'
                                }`}
                              >
                                {t.status || 'Not Started'}
                              </span>

                              {/* Log ID */}
                              <span className="font-mono text-[10px] font-semibold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                {t.log_id || t.task_id || `#${t.id}`}
                              </span>

                              {/* Origin Badge */}
                              <span
                                className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                                  isPersonal
                                    ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                              >
                                {isPersonal ? 'Personal' : 'Company'}
                              </span>

                              {t.project_name && (
                                <span
                                  className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 inline-flex items-center gap-1 max-w-[120px] truncate"
                                  title={`Project: ${t.project_name}`}
                                >
                                  <Briefcase className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                  <span className="truncate">{t.project_name}</span>
                                </span>
                              )}

                              {/* Title */}
                              <span className="font-bold text-slate-100 text-sm truncate">
                                {t.title}
                              </span>
                            </div>

                            {/* Description Snippet with Copy */}
                            {(desc || t.title) && (
                              <div className="flex items-center gap-2 text-slate-400 text-xs">
                                <p className="truncate max-w-md text-slate-400">{desc || t.title}</p>
                                <button
                                  type="button"
                                  onClick={() => handleCopyItem(t.title, desc, `cal-desc-${idx}`)}
                                  className="text-slate-500 hover:text-purple-300 transition cursor-pointer p-0.5 rounded hover:bg-slate-800 flex-shrink-0"
                                  title="Copy title & description"
                                >
                                  {copiedId === `cal-desc-${idx}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Links preview if any */}
                            {Array.isArray(t.links) && t.links.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                {t.links.map((link, lIdx) => (
                                  <a
                                    key={lIdx}
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 bg-sky-950/40 border border-sky-850 px-2 py-0.5 rounded-md hover:border-sky-700 transition"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                    <span className="truncate max-w-[140px]">{link.title || link.url}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Right: Action Buttons */}
                          <div className="flex items-center gap-1.5 flex-shrink-0 self-end md:self-center">
                            {/* View Task Button */}
                            <button
                              type="button"
                              onClick={() => setViewingTask(t)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                              title="View Task Details"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="hidden sm:inline">View</span>
                            </button>

                            {/* Edit / Delete only if Personal task */}
                            {isPersonal && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditTask(t)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition cursor-pointer"
                                  title="Edit Task"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(t.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                                  title="Delete Task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: CREATE / EDIT PERSONAL TASK (No Separate Header / Footer Bars) */}
      {/* ------------------------------------------------------------------ */}
      {showTaskModal && createPortal(
        <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md overflow-y-auto p-3 sm:p-5 flex justify-center items-start sm:items-center animate-in fade-in duration-150">
          <div className="w-full max-w-2xl sm:max-w-3xl rounded-2xl bg-[#0c0c12] dark:bg-[#0c0c12] text-slate-100 border border-slate-700/80 shadow-2xl shadow-black/90 overflow-hidden relative max-h-[88vh] my-auto flex flex-col shrink-0">
            
            {/* Top-Right Close Button */}
            <button
              type="button"
              onClick={() => setShowTaskModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer z-20"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveTask} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Form Title Heading Inside Form Body */}
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-800/80 pr-10">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingTask ? 'Edit Personal Task' : 'Create Personal Task'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Track deliverables, deadlines, optional project & repeat loops
                  </p>
                </div>
              </div>
              {/* Task Name */}
              <div>
                <label className="font-semibold text-slate-200 block mb-1.5">
                  Task Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="input-field py-2 text-xs font-medium w-full"
                  placeholder="e.g. Write integration tests for payment module"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="font-semibold text-slate-200 block mb-1.5">
                  Description <span className="text-[11px] text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="input-field py-2 text-xs leading-relaxed w-full resize-none"
                  placeholder="Task scope, instructions, or notes..."
                />
              </div>

              {/* Grid Row: Project & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Optional Project */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Project <span className="text-[10px] text-slate-400 font-normal">(Optional)</span></span>
                    </label>
                    {(taskForm.project_id || taskForm.project_name) && (
                      <button
                        type="button"
                        onClick={() => setTaskForm(prev => ({ ...prev, project_id: '', project_name: '', custom_project: false }))}
                        className="text-[10px] text-slate-400 hover:text-rose-400 cursor-pointer transition"
                      >
                        Clear Project
                      </button>
                    )}
                  </div>

                  <select
                    value={taskForm.custom_project ? '__custom__' : (taskForm.project_id || '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        setTaskForm(prev => ({
                          ...prev,
                          project_id: '__custom__',
                          custom_project: true,
                          project_name: prev.project_name || ''
                        }));
                      } else if (val === '') {
                        setTaskForm(prev => ({
                          ...prev,
                          project_id: '',
                          custom_project: false,
                          project_name: ''
                        }));
                      } else {
                        const matched = projects.find(p => String(p.id) === String(val));
                        setTaskForm(prev => ({
                          ...prev,
                          project_id: val,
                          custom_project: false,
                          project_name: matched ? matched.name : ''
                        }));
                      }
                    }}
                    className="input-field py-1.5 text-xs font-medium w-full"
                  >
                    <option value="">-- No Project (Optional) --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        📁 {p.name}
                      </option>
                    ))}
                    <option value="__custom__">✨ + Custom / Personal Project...</option>
                  </select>

                  {(taskForm.custom_project || taskForm.project_id === '__custom__') && (
                    <input
                      type="text"
                      placeholder="Type custom project name..."
                      value={taskForm.project_name || ''}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, project_name: e.target.value }))}
                      className="input-field py-1.5 text-xs border-emerald-500/50 focus:border-emerald-400 w-full animate-in fade-in"
                      autoFocus
                    />
                  )}
                </div>

                {/* Status */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <label className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                    <span>Status</span>
                  </label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="input-field py-1.5 text-xs font-semibold w-full"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <p className="text-[10px] text-slate-400">
                    Marking as Completed moves it to completed records.
                  </p>
                </div>
              </div>

              {/* Grid Row: Start Date & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-sky-400" />
                    <span>Start Date</span>
                  </label>
                  <input
                    type="date"
                    value={taskForm.start_date}
                    onChange={(e) => setTaskForm({ ...taskForm, start_date: e.target.value })}
                    className="input-field py-1.5 text-xs [color-scheme:dark] w-full"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Due Date</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-400 hover:text-slate-200 select-none">
                      <input
                        type="checkbox"
                        checked={!taskForm.due_date}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTaskForm({ ...taskForm, due_date: '' });
                          } else {
                            setTaskForm({ ...taskForm, due_date: new Date().toISOString().split('T')[0] });
                          }
                        }}
                        className="rounded border-slate-700 text-purple-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                      />
                      <span>No Due Date</span>
                    </label>
                  </div>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    disabled={!taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    className="input-field py-1.5 text-xs [color-scheme:dark] disabled:opacity-30 disabled:cursor-not-allowed w-full"
                  />
                </div>
              </div>

              {/* Reference Links Section (No Icon / Placeholder Overlap) */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-sky-400" />
                    <span>Reference Links</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({(taskForm.links || []).filter(l => l && l.url).length})
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLinkInput}
                    className="px-2.5 py-1 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 font-medium text-[11px] flex items-center gap-1 cursor-pointer transition shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Link Line</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(taskForm.links || [{ title: '', url: '' }]).map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {/* Integrated Input Group with Icon Outside Placeholder */}
                      <div className="flex-1 min-w-0 flex items-center bg-black/95 dark:bg-black/95 rounded-lg border border-neutral-800 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500 transition duration-150">
                        <div className="pl-3 pr-2 text-sky-400 pointer-events-none shrink-0 flex items-center justify-center">
                          <LinkIcon className="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="text"
                          placeholder="https://... or documentation link"
                          value={link.url || ''}
                          onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                          className="w-full bg-transparent border-0 outline-none py-2 pr-3 text-xs text-neutral-100 placeholder-neutral-500 font-normal"
                        />
                      </div>

                      <input
                        type="text"
                        placeholder="Label / Title (opt)"
                        value={link.title || ''}
                        onChange={(e) => handleUpdateLink(idx, 'title', e.target.value)}
                        className="input-field py-1.5 text-xs w-32 sm:w-44 shrink-0"
                      />

                      {taskForm.links.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(idx)}
                          className="p-2 rounded-lg bg-slate-900 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 border border-slate-800 hover:border-rose-800 transition cursor-pointer shrink-0 active:scale-95"
                          title="Remove this link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Repeat / Loop Personal Task Section */}
              <div className="p-3.5 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-950/40 border border-indigo-800/40 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      <Repeat className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        Repeat Task Loop (Auto-Reset)
                        {editingTask?.loop_count > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-200 font-bold border border-indigo-500/40">
                            Cycle #{editingTask.loop_count}
                          </span>
                        )}
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Automatically resets this task in-place for a new cycle after timer duration completes.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTaskForm(prev => ({ ...prev, is_loop: !prev.is_loop }))}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${taskForm.is_loop ? 'bg-indigo-600' : 'bg-slate-800'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${taskForm.is_loop ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>
                </div>

                {taskForm.is_loop && (
                  <div className="pt-2 border-t border-indigo-800/30 space-y-2.5 animate-in fade-in">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-300">Repeat Interval:</span>
                      {[
                        { label: 'Every 12h', hours: 12 },
                        { label: 'Every 24h', hours: 24 },
                        { label: 'Every 48h', hours: 48 },
                        { label: 'Every 7 Days', hours: 168 }
                      ].map(preset => (
                        <button
                          type="button"
                          key={preset.hours}
                          onClick={() => setTaskForm(prev => ({ ...prev, loop_interval_hours: preset.hours }))}
                          className={`px-2.5 py-1 text-[11px] rounded-lg font-medium border transition cursor-pointer ${
                            Number(taskForm.loop_interval_hours) === preset.hours
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                              : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}

                      <div className="flex items-center gap-1 ml-1">
                        <span className="text-[10px] text-slate-400">or</span>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={taskForm.loop_interval_hours}
                          onChange={(e) => setTaskForm(prev => ({ ...prev, loop_interval_hours: e.target.value }))}
                          className="input-field py-1 px-2 text-xs w-16 text-center font-bold"
                          placeholder="24"
                        />
                        <span className="text-[10px] text-slate-400 font-medium">hrs</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-indigo-300/80 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1">
                        <Bell className="w-3 h-3 shrink-0 text-indigo-400" />
                        <span>In-app notifications trigger before cycle completion and upon reset.</span>
                      </div>
                      {editingTask?.next_run_at && taskForm.is_loop && (
                        <span className="text-[10px] text-indigo-300 font-mono">
                          Next reset: {new Date(editingTask.next_run_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Direct Save Button Inside Form */}
              <button
                type="submit"
                className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-2 cursor-pointer font-bold shadow-lg shadow-purple-950/40 mt-3"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{editingTask ? 'Update Task' : 'Save Task'}</span>
              </button>
            </form>

          </div>
        </div>,
        document.body
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: CREATE / EDIT QUICK NOTE */}
      {/* ------------------------------------------------------------------ */}
      {showNoteModal && createPortal(
        <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md overflow-y-auto p-4 sm:p-6 flex justify-center items-start sm:items-center animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-[#0c0c12] dark:bg-[#0c0c12] text-slate-100 border border-slate-700/80 shadow-2xl shadow-black/90 flex flex-col max-h-[88vh] my-auto overflow-hidden shrink-0">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <StickyNote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingNote ? 'Edit Personal Note' : 'Create Quick Note'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Scratchpad for ideas, snippets, and temporary logs.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="self-note-form" onSubmit={handleSaveNote} className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div>
                <label className="font-semibold text-slate-200 block mb-1.5">Note Title *</label>
                <input
                  type="text"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                  className="input-field py-2 text-xs font-medium w-full"
                  placeholder="e.g. Architecture ideas for deployment"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-200 block mb-1.5">Description / Content *</label>
                <textarea
                  rows={6}
                  value={noteForm.description}
                  onChange={(e) => setNoteForm({ ...noteForm, description: e.target.value })}
                  className="input-field py-2 text-xs leading-relaxed w-full resize-none"
                  placeholder="Write your note here..."
                  required
                />
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                * Required field • Saved to your personal scratchpad
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="self-note-form"
                  className="btn-primary px-5 py-2 text-xs bg-amber-600 hover:bg-amber-500 border-amber-500 flex items-center gap-1.5 cursor-pointer font-bold shadow-md shadow-amber-950/30"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingNote ? 'Update Note' : 'Save Note'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: VIEW PERSONAL TASK DETAILS (Only Title, Description, Links) */}
      {/* ------------------------------------------------------------------ */}
      {viewingTask && createPortal(
        <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md overflow-y-auto p-4 sm:p-6 flex justify-center items-start sm:items-center animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl bg-[#0c0c12] dark:bg-[#0c0c12] text-slate-100 border border-slate-700/80 shadow-2xl shadow-black/90 overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative my-auto shrink-0">
            {/* Top-Right Close Button */}
            <button
              type="button"
              onClick={() => setViewingTask(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer z-10"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Direct Content: Title, Description, Links Only (No Header Bar, No Footer, No Edit Button) */}
            <div className="p-6 space-y-4 text-xs max-h-[85vh] overflow-y-auto min-w-0 w-full">
              {/* Title */}
              <div className="min-w-0 pr-8">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Title
                </span>
                <h2 className="text-base font-bold text-white leading-snug break-words [overflow-wrap:anywhere]">
                  {viewingTask.title}
                </h2>
              </div>

              {/* Repeat Loop Info Banner */}
              {Boolean(viewingTask.is_loop) && (
                <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-800/50 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold text-indigo-200">
                      Repeat Task: Resets Every {viewingTask.loop_interval_hours || 24} hours
                    </span>
                    {viewingTask.loop_count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                        Cycle #{viewingTask.loop_count}
                      </span>
                    )}
                  </div>
                  {viewingTask.next_run_at && (
                    <span className="text-[11px] text-indigo-300 font-mono font-medium">
                      Next reset: {new Date(viewingTask.next_run_at).toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {/* Optional Project Badge */}
              {viewingTask.project_name && (
                <div className="flex items-center gap-2 text-xs bg-emerald-950/40 border border-emerald-800/50 px-3 py-1.5 rounded-xl w-fit">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-slate-400 font-semibold text-[11px]">Project:</span>
                  <span className="font-bold text-emerald-300">{viewingTask.project_name}</span>
                </div>
              )}

              {/* Description */}
              <div className="min-w-0 w-full">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Description
                  </span>
                  {(viewingTask.description || viewingTask.content || viewingTask.title) && (
                    <button
                      type="button"
                      onClick={() => handleCopyItem(viewingTask.title, viewingTask.description || viewingTask.content, 'view-task-modal')}
                      className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-purple-300 transition cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800"
                      title="Copy title & description to clipboard"
                    >
                      {copiedId === 'view-task-modal' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-300 text-xs leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-72 overflow-y-auto w-full">
                  {viewingTask.description || viewingTask.content || (
                    <span className="italic text-slate-500">No description provided.</span>
                  )}
                </div>
              </div>

              {/* Links Only */}
              <div className="min-w-0 w-full">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Links
                </span>
                {viewingTask.links && viewingTask.links.length > 0 ? (
                  <div className="space-y-2 min-w-0">
                    {viewingTask.links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 transition group min-w-0"
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <LinkIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span className="font-semibold text-slate-200 group-hover:text-sky-300 truncate">
                            {link.title || link.url}
                          </span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 shrink-0" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-slate-500 italic text-xs">
                    No links attached.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: VIEW QUICK NOTE DETAILS (No Header/Footer, Big Text Containment) */}
      {/* ------------------------------------------------------------------ */}
      {viewingNote && createPortal(
        <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md overflow-y-auto p-4 sm:p-6 flex justify-center items-start sm:items-center animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-[#0c0c12] dark:bg-[#0c0c12] text-slate-100 border border-amber-900/40 shadow-2xl shadow-black/90 overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative my-auto shrink-0">
            {/* Top-Right Close Button */}
            <button
              type="button"
              onClick={() => setViewingNote(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer z-10"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 space-y-4 text-xs max-h-[85vh] overflow-y-auto min-w-0 w-full">
              {/* Note ID & Title */}
              <div className="min-w-0 pr-8">
                {viewingNote.log_id && (
                  <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/80 mb-1.5 inline-block">
                    {viewingNote.log_id}
                  </span>
                )}
                <h2 className="text-base font-bold text-white leading-snug break-words [overflow-wrap:anywhere]">
                  {viewingNote.title}
                </h2>
              </div>

              {/* Note Description / Content */}
              <div className="min-w-0 w-full">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Note Content
                  </span>
                  {(viewingNote.description || viewingNote.content || viewingNote.title) && (
                    <button
                      type="button"
                      onClick={() => handleCopyItem(viewingNote.title, viewingNote.description || viewingNote.content, 'view-note-modal')}
                      className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-amber-300 transition cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800"
                      title="Copy title & content to clipboard"
                    >
                      {copiedId === 'view-note-modal' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/80 text-slate-200 text-xs leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-80 overflow-y-auto w-full">
                  {viewingNote.description || viewingNote.content || (
                    <span className="italic text-slate-500">No content in this note.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
