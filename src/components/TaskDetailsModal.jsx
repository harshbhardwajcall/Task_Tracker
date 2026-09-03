import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, getAuthToken } from '../services/api';
import { useAuth } from '../context/AuthContext';
import EditTaskModal from './EditTaskModal';
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
  FileText,
  Trash2,
  ShieldCheck,
  Lock,
  Eye,
  Pencil
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
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments/${att.id}/download`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      let blob;
      if (res.ok) {
        blob = await res.blob();
      } else {
        const fallbackRes = await fetch(`/uploads/${att.file_path}`);
        if (!fallbackRes.ok) throw new Error('Failed to fetch file from server');
        blob = await fallbackRes.blob();
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = att.file_name || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error('Blob download failed, fallback to standard link:', err);
      const link = document.createElement('a');
      link.href = `/uploads/${att.file_path}`;
      link.download = att.file_name || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const isImageFile = (filename) => {
    return /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(filename || '');
  };

  const isPdfFile = (filename) => {
    return /\.pdf$/i.test(filename || '');
  };

  if (!taskId) return null;

  const canUpdateStatus = activeUser?.role === 'Admin' || String(details?.task?.assigned_to) === String(activeUser?.id);

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-4xl rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150 bg-[#0c0c12]/95">
        
        {/* COMPACT TOP HEADER */}
        <div className="px-5 py-3.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 truncate min-w-0">
            <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-zinc-800 text-white border border-zinc-700 shrink-0">
              {details?.task?.task_id || 'TASK-0000'}
            </span>
            <h2 className="text-base font-bold text-white truncate" title={details?.task?.title}>
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

            {/* Admin Edit Task Button */}
            {activeUser?.role === 'Admin' && details?.task && (
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
                  {details.task.assigned_by_name}
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
                <p className="font-semibold text-neutral-200 truncate">{details.task.assigned_to_name}</p>
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
                className={`pb-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                  activeTab === 'comments' ? 'border-white text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Comments ({details.comments?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('attachments')}
                className={`pb-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                  activeTab === 'attachments' ? 'border-white text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Paperclip className="w-3.5 h-3.5" />
                Attachments ({details.attachments?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`pb-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                  activeTab === 'history' ? 'border-white text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Audit Trail ({details.history?.length || 0})
              </button>
            </div>

            {/* TAB CONTENT: Comments */}
            {activeTab === 'comments' && (
              <div className="space-y-3">
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {details.comments?.length === 0 ? (
                    <p className="text-xs text-neutral-500 py-6 text-center">No comments added yet. Be the first to comment!</p>
                  ) : (
                    details.comments.map(c => (
                      <div key={c.id} className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                            {c.user_name}
                            <span className="px-1 py-0.2 rounded text-[9px] bg-zinc-800 text-neutral-400">
                              {c.user_role}
                            </span>
                          </span>
                          <span className="text-neutral-500">{c.created_at}</span>
                        </div>
                        <p className="text-neutral-300 text-xs">{c.comment}</p>
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
                    className="input-field text-xs py-2"
                  />
                  <button
                    type="submit"
                    disabled={postingComment || !newComment.trim()}
                    className="btn-primary text-xs py-2 px-4 shrink-0 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT: Attachments (Interactive Previews & Direct Download) */}
            {activeTab === 'attachments' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="btn-secondary text-xs py-1.5 px-3 cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-white" />
                    {uploadingFile ? 'Uploading...' : 'Upload Attachment'}
                    <input type="file" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
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
        <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-[#0c0c10] border border-white/15 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Lightbox Header */}
            <div className="p-3.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate pr-2">
                <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-white truncate">{previewAttachment.file_name}</span>
                <span className="text-[10px] text-neutral-400 font-mono">({(previewAttachment.file_size / 1024).toFixed(1)} KB)</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleDownloadAttachment(e, previewAttachment)}
                  className="px-3 py-1 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lightbox Content Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/70 min-h-[350px]">
              {isImageFile(previewAttachment.file_name) ? (
                <img
                  src={`/uploads/${previewAttachment.file_path}`}
                  alt={previewAttachment.file_name}
                  className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
                />
              ) : isPdfFile(previewAttachment.file_name) ? (
                <iframe
                  src={`/uploads/${previewAttachment.file_path}`}
                  title={previewAttachment.file_name}
                  className="w-full h-[75vh] rounded-lg border border-zinc-800"
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
                    <span>Download to View</span>
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
