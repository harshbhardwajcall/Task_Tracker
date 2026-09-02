import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
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
  FileText
} from 'lucide-react';

export default function TaskDetailsModal({ taskId, onClose, currentUser, onTaskUpdated }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('comments'); // 'comments' | 'attachments' | 'history'
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      const res = await api.getTaskDetails(taskId);
      setDetails(res);
      setSelectedStatus(res.task.status);
    } catch (err) {
      console.error('Failed to load task details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchTaskDetails();
    }
  }, [taskId]);

  const handleStatusChange = async (e) => {
    const nextStatus = e.target.value;
    setSelectedStatus(nextStatus);
    try {
      await api.updateTaskStatus(taskId, nextStatus);
      fetchTaskDetails();
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      setPostingComment(true);
      await api.addComment(taskId, newComment);
      setNewComment('');
      fetchTaskDetails();
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      alert(err.message);
    } finally {
      setPostingComment(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('attachment', file);

    try {
      setUploadingFile(true);
      await api.uploadAttachment(taskId, formData);
      fetchTaskDetails();
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  if (!taskId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-4xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono font-extrabold text-sm px-2.5 py-1 rounded bg-neutral-800 text-white border border-neutral-700">
              {details?.task?.task_id || 'TASK-0000'}
            </span>
            <h2 className="text-lg font-bold text-slate-100 truncate max-w-lg">
              {details?.task?.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-400">Loading task details...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status & Priority Row */}
            <div className="glass-card p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Priority</span>
                  <PriorityBadge priority={details.task.priority} />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Status</span>
                  <StatusBadge status={details.task.status} />
                </div>
              </div>

              {/* Status Update Control */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300">Update Status:</span>
                <select
                  value={selectedStatus}
                  onChange={handleStatusChange}
                  className="input-field py-1 text-xs font-semibold bg-neutral-900 text-white border-neutral-700"
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Task Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="glass-card p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-400 flex items-center gap-1 font-medium">
                  <User className="w-3.5 h-3.5 text-neutral-300" /> Assigner
                </span>
                <p className="font-semibold text-slate-200">{details.task.assigned_by_name}</p>
              </div>

              <div className="glass-card p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-400 flex items-center gap-1 font-medium">
                  <User className="w-3.5 h-3.5 text-emerald-400" /> Assigned To
                </span>
                <p className="font-semibold text-slate-200">{details.task.assigned_to_name}</p>
              </div>

              <div className="glass-card p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-400 flex items-center gap-1 font-medium">
                  <Briefcase className="w-3.5 h-3.5 text-amber-400" /> Project
                </span>
                <p className="font-semibold text-slate-200">{details.task.project_name}</p>
              </div>

              <div className="glass-card p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-400 flex items-center gap-1 font-medium">
                  <Building className="w-3.5 h-3.5 text-purple-400" /> Department
                </span>
                <p className="font-semibold text-slate-200">{details.task.department_name}</p>
              </div>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assigned Date</span>
                <span className="font-medium text-slate-200">{details.task.assigned_date}</span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Start Date</span>
                <span className="font-medium text-slate-200">{details.task.start_date}</span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Due Date</span>
                <span className={`font-medium ${details.task.status === 'Overdue' ? 'text-rose-400 font-bold' : 'text-slate-200'}`}>
                  {details.task.due_date}
                </span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Completed Date</span>
                <span className="font-medium text-emerald-400">{details.task.completed_date || '—'}</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Task Description</h4>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 text-xs leading-relaxed whitespace-pre-line">
                {details.task.description}
              </div>
            </div>

            {/* Manager Remarks */}
            {details.task.manager_remarks && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  Manager Remarks
                </h4>
                <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-200 text-xs leading-relaxed">
                  {details.task.manager_remarks}
                </div>
              </div>
            )}

            {/* Tabs Header */}
            <div className="border-b border-slate-800 flex items-center gap-6">
              <button
                onClick={() => setActiveTab('comments')}
                className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
                  activeTab === 'comments' ? 'border-white text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Comments ({details.comments?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('attachments')}
                className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
                  activeTab === 'attachments' ? 'border-white text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Paperclip className="w-4 h-4" />
                Attachments ({details.attachments?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`pb-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
                  activeTab === 'history' ? 'border-white text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-4 h-4" />
                Audit Trail ({details.history?.length || 0})
              </button>
            </div>

            {/* TAB CONTENT: Comments */}
            {activeTab === 'comments' && (
              <div className="space-y-4">
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {details.comments?.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">No comments added yet. Be the first to comment!</p>
                  ) : (
                    details.comments.map(c => (
                      <div key={c.id} className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                            {c.user_name}
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400">
                              {c.user_role}
                            </span>
                          </span>
                          <span className="text-slate-500">{c.created_at}</span>
                        </div>
                        <p className="text-slate-300">{c.comment}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Input */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Write a progress comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="input-field"
                  />
                  <button
                    type="submit"
                    disabled={postingComment || !newComment.trim()}
                    className="btn-primary shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT: Attachments */}
            {activeTab === 'attachments' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="btn-secondary text-xs cursor-pointer inline-flex items-center gap-2">
                    <Upload className="w-4 h-4 text-white" />
                    {uploadingFile ? 'Uploading...' : 'Upload Attachment'}
                    <input type="file" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {details.attachments?.length === 0 ? (
                    <div className="col-span-2 text-center py-6 text-xs text-slate-500">
                      No file attachments uploaded for this task.
                    </div>
                  ) : (
                    details.attachments.map(att => (
                      <div key={att.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-neutral-300 shrink-0" />
                          <div className="truncate">
                            <p className="font-semibold text-slate-200 truncate">{att.file_name}</p>
                            <p className="text-[10px] text-slate-500">Uploaded by {att.user_name} • {(att.file_size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <a
                          href={`/uploads/${att.file_path}`}
                          download={att.file_name}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
                          title="Download File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Audit Log History */}
            {activeTab === 'history' && (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {details.history?.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No history events logged.</p>
                ) : (
                  details.history.map(h => (
                    <div key={h.id} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-200">
                          {h.user_name}: <span className="text-white font-bold">{h.action}</span>
                        </div>
                        {h.old_value && (
                          <div className="text-[11px] text-slate-400">
                            Changed from <span className="line-through text-slate-500">{h.old_value}</span> to <span className="text-emerald-400">{h.new_value}</span>
                          </div>
                        )}
                        {!h.old_value && h.new_value && (
                          <div className="text-[11px] text-slate-400">{h.new_value}</div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">{h.created_at}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
