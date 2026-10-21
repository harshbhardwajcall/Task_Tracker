import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api, getAuthToken } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import EditTaskModal from './EditTaskModal';
import StatusBadge from '../ui/StatusBadge';
import PriorityBadge from '../ui/PriorityBadge';
import {
  X,
  User,
  Calendar,
  Building,
  Briefcase,
  MessageSquare,
  Paperclip,
  History,
  Send,
  Upload,
  Download,
  CheckCircle,
  Timer,
  FileText,
  Trash2,
  ShieldCheck,
  Lock,
  Eye,
  Pencil,
  Users,
  Link as LinkIcon,
  ExternalLink,
  Repeat,
  CheckCheck,
  Image as ImageIcon,
  ZoomIn
} from 'lucide-react';

export default function TaskDetailsModal({ taskId, onClose, currentUser, onTaskUpdated }) {
  const { user: authUser } = useAuth();
  const activeUser = currentUser || authUser;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('comments'); // 'comments' | 'attachments' | 'history'
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // WhatsApp-Style Chat State
  const [chatImageFile, setChatImageFile] = useState(null);
  const [chatImagePreview, setChatImagePreview] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const messagesEndRef = useRef(null);
  const chatFileInputRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  const fetchTaskDetails = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.getTaskDetails(taskId);
      setDetails(res);
      setSelectedStatus(res.task.status);
    } catch (err) {
      console.error('Failed to load task details:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchTaskDetails();
    }
  }, [taskId]);

  // Auto-scroll when switching to comments tab or when comments change
  useEffect(() => {
    if (activeTab === 'comments' && details?.comments) {
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [activeTab, details?.comments?.length]);

  // Live polling for chat messages every 4 seconds when in comments tab
  useEffect(() => {
    if (!taskId || activeTab !== 'comments') return;
    const interval = setInterval(async () => {
      try {
        const res = await api.getTaskDetails(taskId);
        if (res && res.comments) {
          setDetails(prev => {
            if (!prev) return res;
            if (JSON.stringify(prev.comments) !== JSON.stringify(res.comments)) {
              setTimeout(() => scrollToBottom(true), 50);
              return { ...prev, comments: res.comments };
            }
            return prev;
          });
        }
      } catch (err) {
        // silent fail on poll
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [taskId, activeTab]);

  const handleStatusChange = async (e) => {
    const nextStatus = e.target.value;
    setSelectedStatus(nextStatus);
    try {
      await api.updateTaskStatus(taskId, nextStatus);
      fetchTaskDetails(true);
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSelectedImageFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Only image files (PNG, JPG, WebP, GIF) are allowed in chat.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert(`Image "${file.name}" exceeds the 10MB limit.`);
      return;
    }
    setChatImageFile(file);
    setChatImagePreview(URL.createObjectURL(file));
  };

  const handleClearChatImage = () => {
    if (chatImagePreview) {
      URL.revokeObjectURL(chatImagePreview);
    }
    setChatImageFile(null);
    setChatImagePreview(null);
    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = '';
    }
  };

  const handleChatPaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleSelectedImageFile(file);
          break;
        }
      }
    }
  };

  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newComment.trim() && !chatImageFile) return;

    try {
      setPostingComment(true);
      let payload;
      if (chatImageFile) {
        payload = new FormData();
        if (newComment.trim()) {
          payload.append('comment', newComment.trim());
        }
        payload.append('image', chatImageFile);
      } else {
        payload = newComment.trim();
      }

      const res = await api.addComment(taskId, payload);
      setNewComment('');
      handleClearChatImage();
      if (res && res.comments) {
        setDetails(prev => ({ ...prev, comments: res.comments }));
      } else {
        fetchTaskDetails(true);
      }
      if (onTaskUpdated) onTaskUpdated();
      setTimeout(() => scrollToBottom(true), 60);
    } catch (err) {
      alert(err.message || 'Failed to send message.');
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      const res = await api.deleteComment(taskId, commentId);
      if (res && res.comments) {
        setDetails(prev => ({ ...prev, comments: res.comments }));
      } else {
        fetchTaskDetails(true);
      }
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      alert(err.message || 'Failed to delete message.');
    }
  };

  const getSenderColor = (name) => {
    const colors = [
      'text-amber-400',
      'text-emerald-400',
      'text-sky-400',
      'text-violet-400',
      'text-pink-400',
      'text-cyan-400',
      'text-orange-400',
      'text-teal-400'
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const formatChatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  const formatChatDateGroup = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return dateStr;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.round((today - target) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert(`File "${file.name}" exceeds the 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please upload a file under 10MB.`);
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('attachment', file);

    try {
      setUploadingFile(true);
      await api.uploadAttachment(taskId, formData);
      fetchTaskDetails();
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      alert(err.message || 'Failed to upload attachment.');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (att) => {
    if (window.confirm(`Delete attachment "${att.file_name}"? The file will be permanently deleted from the database and disk.`)) {
      try {
        await api.deleteAttachment(taskId, att.id);
        fetchTaskDetails();
        if (onTaskUpdated) onTaskUpdated();
      } catch (err) {
        alert(err.message || 'Failed to delete attachment.');
      }
    }
  };

  const handleDownloadAttachment = async (e, att) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const cleanPath = (att.file_path || '').replace(/^\/?uploads\//, '');
    const filename = att.file_name && /\.[a-z0-9]+$/i.test(att.file_name)
      ? att.file_name
      : (cleanPath.split('/').pop() || 'download.png');

    try {
      if (att.id) {
        const res = await fetch(`/api/tasks/${taskId}/attachments/${att.id}/download`, {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`
          }
        });
        if (res.ok) {
          const blob = await res.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
          return;
        }
      }

      // Direct fallback for chat images or files
      const fallbackUrl = att.url || `/uploads/${cleanPath}`;
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) {
        const blob = await fallbackRes.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      } else {
        const link = document.createElement('a');
        link.href = fallbackUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Download failed, using direct anchor fallback:', err);
      const link = document.createElement('a');
      link.href = att.url || `/uploads/${cleanPath}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const isImageFile = (filename, filepath) => {
    return /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(filename || '') ||
      /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(filepath || '');
  };

  const isPdfFile = (filename, filepath) => {
    return /\.pdf$/i.test(filename || '') || /\.pdf$/i.test(filepath || '');
  };

  const handleOpenChatImage = (c) => {
    const cleanPath = (c.image_url || '').replace(/^\/?uploads\//, '');
    const filename = cleanPath.split('/').pop() || 'image.png';
    setPreviewAttachment({
      file_name: c.comment ? c.comment : filename,
      file_path: cleanPath,
      url: c.image_url,
      is_image: true,
      user_name: c.user_name,
      uploaded_at: c.created_at
    });
  };

  if (!taskId) return null;

  const isAssigner = Number(details?.task?.assigned_by) === Number(activeUser?.id);
  const isAssignee = Number(details?.task?.assigned_to) === Number(activeUser?.id);
  const isAdmin = activeUser?.role === 'Admin';
  const isManager = activeUser?.role === 'Manager';
  const isDependency = details?.task?.dependencies && details.task.dependencies.some(d => Number(d.id || d.user_id) === Number(activeUser?.id));

  // Edit/Reassign permission: assigner, admin, manager
  const canEdit = isAdmin || isManager || isAssigner;

  // Attachment permission: assigner, assign to, admin, manager (and dependency employees)
  const canAttach = isAssigner || isAssignee || isAdmin || isManager || isDependency;

  // Status update permission: admin, assignee, or dependency collaborator
  const canUpdateStatus = isAdmin || isAssignee || isDependency;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/50 dark:bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#0c0c12]/95 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">

        {/* COMPACT TOP HEADER */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-zinc-900/90 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 truncate min-w-0">
            <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white border border-slate-300 dark:border-zinc-700 shrink-0">
              {details?.task?.task_id || 'TASK-0000'}
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate" title={details?.task?.title}>
              {details?.task?.title}
            </h2>
            {details?.task && (
              <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                <PriorityBadge priority={details.task.priority} />
                <StatusBadge status={details.task.status} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status Selector Dropdown */}
            {canUpdateStatus ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-neutral-400 hidden sm:inline">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={handleStatusChange}
                  className="bg-zinc-950 hover:bg-zinc-900 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 focus:outline-none focus:border-white transition cursor-pointer appearance-auto leading-normal"
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-neutral-400 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800">
                <Lock className="w-3 h-3 text-neutral-500" />
                <span className="hidden sm:inline">Status locked</span>
              </div>
            )}

            {/* Edit Task Button (Admin, Manager, or Task Assigner) */}
            {canEdit && details?.task && (
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-zinc-700 hover:border-amber-400/50"
                title="Edit Task Details"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit Task</span>
              </button>
            )}

            {/* Delete Task Button (Admin or Task Assigner) */}
            {(activeUser?.role === 'Admin' || Number(details?.task?.assigned_by) === Number(activeUser?.id)) && details?.task && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm(`Are you sure you want to delete task ${details.task.task_id}?`)) {
                    try {
                      await api.deleteTask(details.task.id);
                      if (onTaskUpdated) onTaskUpdated();
                      onClose();
                    } catch (err) {
                      alert(err.message || 'Failed to delete task.');
                    }
                  }
                }}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/80 text-rose-400 hover:text-rose-300 transition cursor-pointer border border-zinc-700 hover:border-rose-500/50"
                title="Delete Task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-medium text-neutral-400">Loading task details...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

            {/* COMPACT UNIFIED METADATA BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                  {details.task.assigned_by_role === 'Admin' ? <ShieldCheck className="w-3 h-3 text-amber-400" /> : <User className="w-3 h-3 text-neutral-400" />}
                  Assigner
                </span>
                <p className="font-semibold text-neutral-200 truncate flex items-center gap-1">
                  {details.task.assigned_by_name || 'Administrator'}
                  {details.task.assigned_by_role === 'Admin' && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      Admin
                    </span>
                  )}
                </p>
              </div>

              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                  <User className="w-3 h-3 text-emerald-400" /> Assigned To
                </span>
                <p className="font-semibold text-neutral-200 truncate">{details.task.assigned_to_name || 'Unassigned (Pending Reassignment)'}</p>
              </div>

              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-amber-400" /> Project
                </span>
                <p className="font-semibold text-neutral-200 truncate">{details.task.project_name}</p>
              </div>

              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                  <Building className="w-3 h-3 text-purple-400" /> Department
                </span>
                <p className="font-semibold text-neutral-200 truncate">{details.task.department_name}</p>
              </div>

              {/* Row 2 of Metadata */}
              <div className="space-y-0.5 pt-2 border-t border-zinc-800/80 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-neutral-400" /> Start Date
                </span>
                <p className="font-medium text-neutral-300 text-[11px] truncate">{details.task.start_date || 'N/A'}</p>
              </div>

              <div className="space-y-0.5 pt-2 border-t border-zinc-800/80 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-neutral-400" /> Due Date
                </span>
                <p className={`font-medium text-[11px] truncate ${details.task.status === 'Overdue' ? 'text-rose-400 font-bold' : (details.task.due_date ? 'text-neutral-300' : 'text-neutral-500 italic')}`}>
                  {details.task.due_date || 'No Due Date'}
                </p>
              </div>

              <div className="space-y-0.5 pt-2 border-t border-zinc-800/80 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-neutral-400" /> Assigned Date
                </span>
                <p className="font-medium text-neutral-300 text-[11px] truncate">{details.task.assigned_date || 'N/A'}</p>
              </div>

              <div className="space-y-0.5 pt-2 border-t border-zinc-800/80 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" /> Completed
                </span>
                <p className="font-medium text-emerald-400 text-[11px] truncate">{details.task.completed_date || '—'}</p>
              </div>

              {/* Repeat Loop Info Banner */}
              {Boolean(details?.task?.is_loop) && (
                <div className="col-span-full pt-2 border-t border-indigo-800/40 min-w-0">
                  <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-800/50 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="text-xs font-bold text-indigo-200">
                        Repeat Task: Resets Every {details.task.loop_interval_hours || 24} hours
                      </span>
                      {details.task.loop_count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                          Cycle #{details.task.loop_count}
                        </span>
                      )}
                    </div>
                    {details.task.next_run_at && (
                      <span className="text-[11px] text-indigo-300 font-mono font-medium">
                        Next reset: {new Date(details.task.next_run_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Row 3: Dependencies if any */}
              {details?.task?.dependencies && details.task.dependencies.length > 0 && (
                <div className="col-span-full pt-2 border-t border-zinc-800/80 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Dependencies / Co-Employees:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {details.task.dependencies.map(dep => (
                      <span
                        key={dep.id}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-cyan-950/60 text-cyan-200 border border-cyan-800/60"
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-cyan-800 text-cyan-100 flex items-center justify-center text-[9px] font-bold">
                          {dep.name ? dep.name.charAt(0).toUpperCase() : 'U'}
                        </span>
                        <span>{dep.name}</span>
                        <span className="text-[9px] text-cyan-400 font-normal">({dep.department_name || dep.title || 'Co-Worker'})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>


            {/* COMPACT TASK DESCRIPTION & REMARKS */}
            <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                <FileText className="w-3 h-3 text-neutral-400" /> Task Description
              </span>
              <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {details.task.description || <span className="text-neutral-600 italic">No description provided.</span>}
              </p>
              {details.task.manager_remarks && (
                <div className="mt-2 pt-2 border-t border-zinc-800 text-amber-300/90 text-xs">
                  <span className="font-bold text-amber-400 text-[10px] uppercase block mb-0.5">Manager Remarks:</span>
                  <p>{details.task.manager_remarks}</p>
                </div>
              )}
            </div>

            {/* REFERENCE LINKS (If reference links exist) */}
            {(() => {
              const raw = details?.task?.links;
              let taskLinks = [];
              if (raw) {
                if (Array.isArray(raw)) {
                  taskLinks = raw.filter(l => l && (l.url || l.title));
                } else if (typeof raw === 'string') {
                  try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) taskLinks = parsed.filter(l => l && (l.url || l.title));
                  } catch (e) { }
                }
              }
              if (taskLinks.length === 0) return null;
              return (
                <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5" /> Reference Links ({taskLinks.length})
                  </span>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {taskLinks.map((link, idx) => {
                      const rawUrl = (link.url || '').trim();
                      const href = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`;
                      const displayTitle = (link.title || '').trim() || rawUrl.replace(/^https?:\/\//i, '');
                      return (
                        <a
                          key={idx}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-950/50 text-sky-300 border border-sky-800/60 hover:bg-sky-900/60 hover:text-white transition shadow-sm group"
                          title={rawUrl}
                        >
                          <ExternalLink className="w-3 h-3 text-sky-400 group-hover:scale-110 transition shrink-0" />
                          <span className="truncate max-w-[260px]">{displayTitle}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* QUICK ATTACHMENTS PREVIEW CHIPS (If attachments exist) */}
            {details.attachments?.length > 0 && activeTab !== 'attachments' && (
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <Paperclip className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="text-neutral-400 text-[11px] font-semibold shrink-0">
                    Attachments ({details.attachments.length}):
                  </span>
                  <div className="flex items-center gap-1.5 truncate">
                    {details.attachments.slice(0, 3).map(att => (
                      <button
                        key={att.id}
                        type="button"
                        onClick={() => setPreviewAttachment(att)}
                        className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[10px] text-neutral-200 hover:text-white flex items-center gap-1 truncate cursor-pointer"
                        title={`Click to preview ${att.file_name}`}
                      >
                        <Eye className="w-2.5 h-2.5 text-neutral-400" />
                        <span className="truncate max-w-[120px]">{att.file_name}</span>
                      </button>
                    ))}
                    {details.attachments.length > 3 && (
                      <span className="text-[10px] text-neutral-500">+{details.attachments.length - 3} more</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('attachments')}
                  className="text-[10px] font-bold text-neutral-300 hover:text-white underline shrink-0 cursor-pointer"
                >
                  View All
                </button>
              </div>
            )}

            {/* TABS HEADER */}
            <div className="border-b border-zinc-800 flex items-center gap-6 pt-1">
              <button
                onClick={() => setActiveTab('comments')}
                className={`pb-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${activeTab === 'comments' ? 'border-emerald-500 text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                Chat ({details.comments?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('attachments')}
                className={`pb-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${activeTab === 'attachments' ? 'border-white text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
              >
                <Paperclip className="w-3.5 h-3.5" />
                Attachments ({details.attachments?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`pb-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${activeTab === 'history' ? 'border-white text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
              >
                <History className="w-3.5 h-3.5" />
                Audit Trail ({details.history?.length || 0})
              </button>
            </div>

            {/* TAB CONTENT: WhatsApp-Style Task Chat */}
            {activeTab === 'comments' && (
              <div
                className="space-y-2.5"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleSelectedImageFile(file);
                }}
                onPaste={handleChatPaste}
              >
                {/* Chat Top Info Banner */}
                <div className="flex items-center justify-between text-[11px] text-neutral-400 bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-zinc-800/80">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>WhatsApp-Style Chat</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 hidden sm:inline">
                    Paste screenshots directly with <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-neutral-300 font-mono text-[9px] border border-zinc-700">Ctrl + V</kbd> or drag images
                  </span>
                </div>

                {/* Messages Stream Container */}
                <div className="space-y-2.5 min-h-[260px] max-h-[340px] overflow-y-auto px-3 py-3 rounded-xl bg-zinc-950/85 border border-zinc-800/90 shadow-inner">
                  {details.comments?.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 flex items-center justify-center mx-auto shadow-md">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-neutral-300">No messages in this task yet</p>
                      <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                        Type a message below, click the paperclip, or press <kbd className="px-1 py-0.2 rounded bg-zinc-800 text-neutral-300 font-mono text-[10px]">Ctrl + V</kbd> to paste a screenshot!
                      </p>
                    </div>
                  ) : (
                    details.comments.map((c, idx) => {
                      const isMe = Number(c.user_id) === Number(activeUser?.id);
                      const prevComment = idx > 0 ? details.comments[idx - 1] : null;
                      const currentDateGroup = formatChatDateGroup(c.created_at);
                      const prevDateGroup = prevComment ? formatChatDateGroup(prevComment.created_at) : null;
                      const showDateBadge = currentDateGroup && currentDateGroup !== prevDateGroup;

                      return (
                        <React.Fragment key={c.id}>
                          {/* Date Badge Divider */}
                          {showDateBadge && (
                            <div className="flex justify-center my-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 text-neutral-400 border border-zinc-800 shadow-sm">
                                {currentDateGroup}
                              </span>
                            </div>
                          )}

                          {isMe ? (
                            /* OUTGOING MESSAGE BUBBLE (ME) - Right Aligned Emerald WhatsApp Style */
                            <div className="flex justify-end mb-2 group">
                              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs px-3 py-2 bg-emerald-700 text-white shadow-md border border-emerald-600/40 relative">
                                {c.image_url && (
                                  <div
                                    onClick={() => handleOpenChatImage(c)}
                                    className="rounded-lg overflow-hidden mb-1.5 cursor-pointer relative group/img max-h-60 bg-black/40 border border-emerald-600/60"
                                    title="Click to expand"
                                  >
                                    <img
                                      src={c.image_url}
                                      alt="chat attachment"
                                      className="w-full h-auto max-h-60 object-contain rounded-lg hover:scale-[1.02] transition duration-200"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-xs font-semibold backdrop-blur-[2px]">
                                      <ZoomIn className="w-3.5 h-3.5" /> View full image
                                    </div>
                                  </div>
                                )}
                                {c.comment && (
                                  <p className="text-xs sm:text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                                    {c.comment}
                                  </p>
                                )}
                                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-emerald-200/90 font-medium">
                                  <span>{formatChatTime(c.created_at)}</span>
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-300 inline" />
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(c.id)}
                                    title="Delete message"
                                    className="opacity-0 group-hover:opacity-100 transition p-0.5 hover:text-red-200 ml-1.5 cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* INCOMING MESSAGE BUBBLE (OTHERS) - Left Aligned Dark Slate Style */
                            <div className="flex items-end gap-2 mb-2 group">
                              {c.user_avatar ? (
                                <img
                                  src={c.user_avatar}
                                  alt={c.user_name}
                                  className="w-7 h-7 rounded-full object-cover shrink-0 border border-zinc-700 shadow-sm"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-zinc-800 text-neutral-300 font-bold text-[11px] flex items-center justify-center shrink-0 border border-zinc-700 shadow-sm">
                                  {c.user_name ? c.user_name.charAt(0).toUpperCase() : 'U'}
                                </div>
                              )}
                              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tl-xs px-3 py-2 bg-zinc-800 text-neutral-100 shadow-md border border-zinc-700/60 relative">
                                <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold">
                                  <span className={getSenderColor(c.user_name)}>{c.user_name}</span>
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-700 text-neutral-300 font-normal">
                                    {c.user_role}
                                  </span>
                                </div>
                                {c.image_url && (
                                  <div
                                    onClick={() => handleOpenChatImage(c)}
                                    className="rounded-lg overflow-hidden mb-1.5 cursor-pointer relative group/img max-h-60 bg-black/40 border border-zinc-700"
                                    title="Click to expand"
                                  >
                                    <img
                                      src={c.image_url}
                                      alt="chat attachment"
                                      className="w-full h-auto max-h-60 object-contain rounded-lg hover:scale-[1.02] transition duration-200"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-xs font-semibold backdrop-blur-[2px]">
                                      <ZoomIn className="w-3.5 h-3.5" /> View full image
                                    </div>
                                  </div>
                                )}
                                {c.comment && (
                                  <p className="text-xs sm:text-[13px] leading-relaxed break-words whitespace-pre-wrap text-neutral-200">
                                    {c.comment}
                                  </p>
                                )}
                                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-neutral-400 font-medium">
                                  <span>{formatChatTime(c.created_at)}</span>
                                  {activeUser?.role === 'Admin' && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(c.id)}
                                      title="Admin: Delete message"
                                      className="opacity-0 group-hover:opacity-100 transition p-0.5 hover:text-red-400 ml-1.5 cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}

                  {/* Drag-over indicator */}
                  {isDraggingOver && (
                    <div className="p-4 border-2 border-dashed border-emerald-500 rounded-xl bg-emerald-500/10 text-emerald-400 text-center font-bold text-xs flex items-center justify-center gap-2 animate-pulse">
                      <ImageIcon className="w-5 h-5" /> Drop image here to attach to chat
                    </div>
                  )}

                  {/* Dummy scroll anchor */}
                  <div ref={messagesEndRef} />
                </div>

                {/* Floating Preview Drawer for Pasted/Attached Image */}
                {chatImagePreview && (
                  <div className="flex items-center gap-3 p-2.5 bg-zinc-900 border border-emerald-500/40 rounded-xl shadow-lg backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative group shrink-0">
                      <img
                        src={chatImagePreview}
                        alt="Pasted attachment"
                        className="w-14 h-14 object-cover rounded-lg border border-emerald-500/60 shadow-sm"
                      />
                      <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-black text-[9px] font-extrabold px-1 rounded-full">
                        Ready
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5" /> Image attached
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          ({(chatImageFile.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-300 truncate mt-0.5">
                        {newComment.trim() ? `Caption: "${newComment}"` : 'Add an optional caption below or press Enter to send.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearChatImage}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-neutral-400 hover:text-white transition cursor-pointer"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* WhatsApp Chat Input Bar */}
                <form onSubmit={handleSendChatMessage} className="flex items-end gap-2 pt-1">
                  <input
                    type="file"
                    ref={chatFileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSelectedImageFile(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => chatFileInputRef.current?.click()}
                    className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-neutral-400 hover:text-emerald-400 hover:border-emerald-500/40 transition shrink-0 cursor-pointer"
                    title="Attach image from device"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <div className="flex-1 relative">
                    <textarea
                      rows={1}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onPaste={handleChatPaste}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChatMessage();
                        }
                      }}
                      placeholder={
                        chatImageFile
                          ? "Add a caption... (Press Enter to send)"
                          : "Type a message... (Press Ctrl+V to paste image, Enter to send)"
                      }
                      className="input-field text-xs sm:text-[13px] py-2.5 px-3.5 resize-none w-full rounded-xl focus:ring-1 focus:ring-emerald-500 max-h-24"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={postingComment || (!newComment.trim() && !chatImageFile)}
                    className="p-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white shadow-lg shadow-emerald-950/50 transition shrink-0 cursor-pointer"
                    title="Send message (Enter)"
                  >
                    {postingComment ? (
                      <Timer className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT: Attachments (Interactive Previews & Direct Download) */}
            {activeTab === 'attachments' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {canAttach ? (
                    <label className="btn-secondary text-xs py-1.5 px-3 cursor-pointer inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-white" />
                      {uploadingFile ? 'Uploading...' : 'Upload Attachment'}
                      <input type="file" onChange={handleFileUpload} className="hidden" />
                    </label>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-800">
                      <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      <span>Attachment upload restricted to assigner, assignee, dependencies, manager, or administrator</span>
                    </div>
                  )}
                  <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 shrink-0 self-start sm:self-auto">
                    Max 10MB
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {details.attachments?.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-xs text-neutral-500 bg-zinc-950/40 rounded-xl border border-dashed border-zinc-800">
                      No file attachments uploaded for this task.
                    </div>
                  ) : (
                    details.attachments.map(att => {
                      const isImg = isImageFile(att.file_name);
                      const isPdf = isPdfFile(att.file_name);

                      return (
                        <div
                          key={att.id}
                          className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition space-y-2 group"
                        >
                          {/* File Preview Thumbnail / Badge */}
                          {isImg ? (
                            <div
                              onClick={() => setPreviewAttachment(att)}
                              className="relative h-28 w-full rounded-lg overflow-hidden bg-black border border-zinc-800 cursor-pointer group/img"
                            >
                              <img
                                src={`/uploads/${att.file_path}`}
                                alt={att.file_name}
                                className="w-full h-full object-cover group-hover/img:scale-105 transition duration-200"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center gap-1 text-white text-[11px] font-bold">
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview</span>
                              </div>
                            </div>
                          ) : isPdf ? (
                            <div
                              onClick={() => setPreviewAttachment(att)}
                              className="h-20 w-full rounded-lg bg-rose-950/20 border border-rose-900/30 flex items-center justify-center gap-2 text-rose-300 text-xs font-semibold cursor-pointer hover:bg-rose-950/40 transition"
                            >
                              <FileText className="w-5 h-5 text-rose-400" />
                              <div className="text-left">
                                <span className="block font-bold text-xs">PDF File</span>
                                <span className="text-[9px] text-rose-400/80 underline">Click to Preview</span>
                              </div>
                            </div>
                          ) : null}

                          {/* File Info & Action Buttons */}
                          <div className="flex items-center justify-between gap-1.5 pt-0.5">
                            <div className="flex items-center gap-1.5 truncate min-w-0">
                              {!isImg && !isPdf && <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />}
                              <div className="truncate">
                                <p className="font-semibold text-white text-xs truncate" title={att.file_name}>
                                  {att.file_name}
                                </p>
                                <p className="text-[9px] text-neutral-500">
                                  {(att.file_size / 1024).toFixed(1)} KB • {att.user_name}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewAttachment(att)}
                                className="p-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-neutral-300 hover:text-white transition cursor-pointer"
                                title="Preview Attachment"
                              >
                                <Eye className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleDownloadAttachment(e, att)}
                                className="p-1 rounded-md bg-white hover:bg-neutral-200 text-black transition cursor-pointer"
                                title="Download Attachment"
                              >
                                <Download className="w-3 h-3" />
                              </button>

                              {/* Only Admin or the user who attached this file can delete it */}
                              {(activeUser?.role === 'Admin' || String(att.user_id) === String(activeUser?.id)) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment(att)}
                                  className="p-1 rounded-md bg-rose-950/50 hover:bg-rose-900/80 text-rose-400 border border-rose-900/40 hover:border-rose-700 transition cursor-pointer"
                                  title="Delete Attachment"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Audit Log History */}
            {activeTab === 'history' && (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {details.history?.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-6 text-center">No history events logged.</p>
                ) : (
                  details.history.map(h => (
                    <div key={h.id} className="p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800/80 text-xs flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-neutral-200">
                          {h.user_name}: <span className="text-white font-bold">{h.action}</span>
                        </div>
                        {h.old_value && (
                          <div className="text-[10px] text-neutral-400">
                            Changed from <span className="line-through text-neutral-500">{h.old_value}</span> to <span className="text-emerald-400">{h.new_value}</span>
                          </div>
                        )}
                        {!h.old_value && h.new_value && (
                          <div className="text-[10px] text-neutral-400">{h.new_value}</div>
                        )}
                      </div>
                      <span className="text-[9px] text-neutral-500 whitespace-nowrap">{h.created_at}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FULL PREVIEW LIGHTBOX MODAL */}
      {previewAttachment && createPortal(
        <div
          onClick={() => setPreviewAttachment(null)}
          className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0c0c10] border border-white/15 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] cursor-default"
          >
            {/* Lightbox Header */}
            <div className="p-3.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate pr-2">
                {previewAttachment.is_image || isImageFile(previewAttachment.file_name, previewAttachment.file_path) ? (
                  <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                )}
                <span className="text-xs font-bold text-white truncate">{previewAttachment.file_name}</span>
                {previewAttachment.file_size && (
                  <span className="text-[10px] text-neutral-400 font-mono">
                    ({(previewAttachment.file_size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleDownloadAttachment(e, previewAttachment)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-zinc-700"
                  title="Download Image"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                  title="Close Preview (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lightbox Content Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/85 min-h-[350px]">
              {previewAttachment.is_image || isImageFile(previewAttachment.file_name, previewAttachment.file_path) ? (
                <img
                  src={previewAttachment.url || `/uploads/${(previewAttachment.file_path || '').replace(/^\/?uploads\//, '')}`}
                  alt={previewAttachment.file_name || 'Preview'}
                  className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl transition duration-200"
                />
              ) : isPdfFile(previewAttachment.file_name, previewAttachment.file_path) ? (
                <iframe
                  src={previewAttachment.url || `/uploads/${(previewAttachment.file_path || '').replace(/^\/?uploads\//, '')}`}
                  title={previewAttachment.file_name || 'Document'}
                  className="w-full h-[78vh] rounded-lg border border-zinc-800"
                />
              ) : (
                <div className="text-center space-y-3 py-12">
                  <FileText className="w-12 h-12 text-neutral-500 mx-auto" />
                  <p className="text-xs text-neutral-300 font-semibold">{previewAttachment.file_name}</p>
                  <p className="text-[11px] text-neutral-500">Preview not supported directly in browser for this file type.</p>
                  <button
                    type="button"
                    onClick={(e) => handleDownloadAttachment(e, previewAttachment)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download File</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Admin Edit Task Modal */}
      {showEditModal && details?.task && (
        <EditTaskModal
          task={details.task}
          onClose={() => setShowEditModal(false)}
          onTaskUpdated={() => {
            fetchTaskDetails();
            if (onTaskUpdated) onTaskUpdated();
          }}
        />
      )}
    </div>,
    document.body
  );
}
