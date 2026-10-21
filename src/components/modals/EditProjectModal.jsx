import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import {
  X,
  Pencil,
  Briefcase,
  Building,
  FileText,
  Link2,
  Image,
  MessageSquare,
  Upload,
  CheckCircle2,
  Paperclip,
  Trash2,
  Plus
} from 'lucide-react';

export default function EditProjectModal({ project, onClose, onProjectUpdated }) {
  const [name, setName] = useState(project?.name || '');
  const [departmentId, setDepartmentId] = useState(project?.department_id || '');
  const [description, setDescription] = useState(project?.description || '');
  const [linksList, setLinksList] = useState([{ url: '', remark: '' }]);
  const [remarks, setRemarks] = useState(project?.remarks || '');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaUrl, setMediaUrl] = useState(project?.media || '');
  const [mediaPreview, setMediaPreview] = useState(project?.media || null);

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDepartmentId(project.department_id || '');
      setDescription(project.description || '');
      
      let parsedLinks = [{ url: '', remark: '' }];
      if (project.links) {
        try {
          const parsed = JSON.parse(project.links);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsedLinks = parsed.map(item => {
              if (typeof item === 'string') return { url: item, remark: '' };
              return { url: item.url || '', remark: item.remark || item.title || '' };
            });
          }
        } catch (e) {
          const lines = project.links.split(/[\r\n,]+/).map(l => l.trim()).filter(Boolean);
          if (lines.length > 0) {
            parsedLinks = lines.map(url => ({ url, remark: '' }));
          }
        }
      }
      setLinksList(parsedLinks.length > 0 ? parsedLinks : [{ url: '', remark: '' }]);
      setRemarks(project.remarks || '');
      setMediaUrl(project.media || '');
      setMediaPreview(project.media || null);
    }
  }, [project]);

  useEffect(() => {
    async function loadDepts() {
      try {
        const res = await api.getDepartments();
        setDepartments(res.departments || []);
      } catch (err) {
        console.error('Failed loading departments:', err);
      }
    }
    loadDepts();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setMediaPreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setMediaPreview(null);
      }
    }
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaUrl('');
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddLink = () => {
    setLinksList((prev) => [...prev, { url: '', remark: '' }]);
  };

  const handleUpdateLink = (index, field, value) => {
    setLinksList((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveLink = (index) => {
    setLinksList((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.length > 0 ? filtered : [{ url: '', remark: '' }];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) return setError('Project name is required.');

    try {
      setLoading(true);

      const validLinks = linksList
        .map(l => ({ url: (l.url || '').trim(), remark: (l.remark || '').trim() }))
        .filter(l => l.url || l.remark);
      const serializedLinks = validLinks.length > 0 ? JSON.stringify(validLinks) : '';

      if (mediaFile) {
        const formData = new FormData();
        formData.append('name', name.trim());
        if (departmentId) formData.append('department_id', departmentId);
        formData.append('description', description.trim());
        formData.append('links', serializedLinks);
        formData.append('remarks', remarks.trim());
        formData.append('media_file', mediaFile);

        const res = await api.updateProject(project.id, formData);
        if (onProjectUpdated) onProjectUpdated(res.project);
      } else {
        const payload = {
          name: name.trim(),
          department_id: departmentId ? Number(departmentId) : null,
          description: description.trim(),
          links: serializedLinks,
          media: mediaUrl.trim(),
          remarks: remarks.trim()
        };
        const res = await api.updateProject(project.id, payload);
        if (onProjectUpdated) onProjectUpdated(res.project);
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update project.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-[#09090c] w-full max-w-xl rounded-2xl border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-zinc-950/95 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 text-white font-bold text-base">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-inner">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <span>Edit Project Details</span>
              <p className="text-[11px] font-normal text-neutral-400">Modify title, department, links, media assets or remarks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* 1. Project Name */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-200 block text-xs flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-sky-400" />
              Project Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Enterprise CRM 2.0"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition"
              autoFocus
              required
            />
          </div>

          {/* 2. Department */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-200 block text-xs flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-purple-400" />
              Department
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white transition"
            >
              <option value="">No Specific Department (Global)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* 3. Description */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-200 block text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Project Description
              </span>
              <span className="text-[10px] text-neutral-500 font-normal">Scope & Goals</span>
            </label>
            <textarea
              rows={3}
              placeholder="Summarize project goals, scope, and target deliverables..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition"
            />
          </div>

          {/* 4. Project Links (Paste link + Remark + Add More) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-neutral-200 block text-xs flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                Project Links & Resources
              </label>
              <button
                type="button"
                onClick={handleAddLink}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition cursor-pointer active:scale-95"
                title="Add link row"
              >
                <Plus className="w-3 h-3" />
                <span>Add Link</span>
              </button>
            </div>

            <div className="space-y-2">
              {linksList.length === 0 ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-neutral-400 text-xs">
                  <span>No resource links added yet.</span>
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Link</span>
                  </button>
                </div>
              ) : (
                linksList.map((linkItem, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-zinc-900/90 p-2 sm:p-2 rounded-xl border border-zinc-800 focus-within:border-emerald-500/50 transition shadow-inner"
                  >
                    {/* Paste link URL */}
                    <div className="relative flex-1">
                      <Link2 className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Link URL (e.g. https://... or website.com)"
                        value={linkItem.url}
                        onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                        className="w-full bg-zinc-900 sm:bg-transparent border border-zinc-800 sm:border-0 rounded-lg sm:rounded-none pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition font-mono"
                        style={{ paddingLeft: '2.25rem' }}
                      />
                    </div>

                    {/* Desktop divider */}
                    <div className="hidden sm:block w-px h-5 bg-zinc-800" />

                    {/* Add remark */}
                    <div className="sm:w-44 shrink-0">
                      <input
                        type="text"
                        placeholder="Title / Remark (e.g. Figma, Docs)"
                        value={linkItem.remark}
                        onChange={(e) => handleUpdateLink(idx, 'remark', e.target.value)}
                        className="w-full bg-zinc-900 sm:bg-transparent border border-zinc-800 sm:border-0 rounded-lg sm:rounded-none px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition"
                      />
                    </div>

                    {/* Action buttons (+ to add more, trash to remove) */}
                    <div className="flex items-center gap-1.5 shrink-0 justify-end">
                      <button
                        type="button"
                        onClick={handleAddLink}
                        className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition cursor-pointer active:scale-95 flex items-center justify-center"
                        title="Add another link"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      {linksList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(idx)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/60 hover:text-rose-400 text-neutral-400 border border-zinc-800 hover:border-rose-800/80 transition cursor-pointer active:scale-95 flex items-center justify-center"
                          title="Remove link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 5. Project Media */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-200 block text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-cyan-400" />
                Project Media & Assets
              </span>
              <span className="text-[10px] text-neutral-500 font-normal">File upload or URL</span>
            </label>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.zip"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-neutral-200 border border-zinc-750 text-xs font-semibold flex items-center gap-2 transition cursor-pointer active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{mediaFile ? 'Replace File' : (mediaUrl ? 'Replace Current Media' : 'Upload File / Image')}</span>
                </button>

                {(mediaFile || mediaUrl) && (
                  <button
                    type="button"
                    onClick={handleRemoveMedia}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    <span>Remove Media</span>
                  </button>
                )}
              </div>

              {!mediaFile && (
                <input
                  type="text"
                  placeholder="Or paste direct media/screenshot URL (https://...)"
                  value={mediaUrl}
                  onChange={(e) => {
                    setMediaUrl(e.target.value);
                    setMediaPreview(e.target.value);
                  }}
                  className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition"
                />
              )}

              {/* Media Preview */}
              {(mediaPreview || (mediaUrl && (mediaUrl.startsWith('http') || mediaUrl.startsWith('/uploads')))) && (
                <div className="mt-2 p-2 rounded-xl bg-zinc-950 border border-zinc-800 max-w-[220px]">
                  <img
                    src={mediaPreview || mediaUrl}
                    alt="Media preview"
                    className="w-full h-24 object-cover rounded-lg"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 6. Remarks */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-200 block text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
                Remarks & Notes
              </span>
              <span className="text-[10px] text-neutral-500 font-normal">Internal notes / Directives</span>
            </label>
            <textarea
              rows={2}
              placeholder="Important notes, client preferences, or milestone directives..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-750 rounded-xl p-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-neutral-300 border border-zinc-750 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-black flex items-center gap-2 shadow-md transition cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4 text-black" />
              <span>{loading ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
