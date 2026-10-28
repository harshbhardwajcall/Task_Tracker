import React from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Briefcase,
  Building,
  FileText,
  Link2,
  ExternalLink,
  Image as ImageIcon,
  MessageSquare,
  Pencil,
  Layers,
  Download,
  Calendar,
  Eye,
  CheckCircle2,
  Info
} from 'lucide-react';

export default function ViewProjectModal({ project, onClose, onEdit }) {
  if (!project) return null;

  // Parse links (supports JSON array of {url, remark} or legacy newline/comma-delimited text)
  const parsedLinks = React.useMemo(() => {
    if (!project?.links) return [];
    try {
      const parsed = JSON.parse(project.links);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => {
            if (typeof item === 'string') return { url: item.trim(), remark: '' };
            return {
              url: (item.url || '').trim(),
              remark: (item.remark || item.title || '').trim()
            };
          })
          .filter(l => l.url || l.remark);
      }
    } catch {
      // Fallback for legacy plain text links
      return project.links
        .split(/[\r\n,]+/)
        .map(l => l.trim())
        .filter(Boolean)
        .map(url => ({ url, remark: '' }));
    }
    return [];
  }, [project?.links]);

  const isImage = (url) => {
    if (!url) return false;
    return /\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i.test(url) || url.startsWith('data:image/');
  };

  const projectIdFormatted = project.id ? `PRJ-${String(project.id).padStart(3, '0')}` : 'PRJ';

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#09090c] text-slate-900 dark:text-neutral-100 w-full max-w-xl rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50/90 dark:bg-zinc-950/95 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 font-extrabold text-sm shadow-inner shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-neutral-300">
                  {projectIdFormatted}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {project.name}
                </h3>
                {project.department_name && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30">
                    {project.department_name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400 flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3 text-sky-500" />
                  <span>{project.total_tasks || 0} Total Deliverables</span>
                </span>
                {project.completed_tasks !== undefined && (
                  <span className="text-emerald-500 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{project.completed_tasks} Completed</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(project);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-sky-600 dark:text-sky-400 border border-slate-200 dark:border-zinc-750 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                title="Edit this project"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px] font-bold">Edit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* 1. Project Scope & Description */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-850 space-y-2">
            <div className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>Project Scope & Description</span>
            </div>
            <p className="text-slate-800 dark:text-neutral-200 text-xs leading-relaxed whitespace-pre-wrap">
              {project.description || 'No detailed scope or description provided for this project.'}
            </p>
          </div>

          {/* 2. Reference & Past Links (with Remarks) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-850 space-y-2.5">
            <div className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Reference Links & Past Project Links ({parsedLinks.length})</span>
              </span>
            </div>

            {parsedLinks.length > 0 ? (
              <div className="flex flex-col gap-2">
                {parsedLinks.map((link, idx) => {
                  const href = link.url
                    ? (link.url.startsWith('http://') || link.url.startsWith('https://') ? link.url : `https://${link.url}`)
                    : null;

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-emerald-500/40 text-xs transition space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          {link.remark ? (
                            <span className="font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px]">
                              {link.remark}
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-600 dark:text-neutral-300 text-[11px]">
                              Resource #{idx + 1}
                            </span>
                          )}
                        </div>

                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-600 dark:text-sky-400 text-[10px] font-bold border border-sky-200 dark:border-sky-800/60 transition shrink-0"
                            title="Open link in new tab"
                          >
                            <span>Open Link</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {link.url && (
                        <div className="font-mono text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline hover:text-sky-500"
                            >
                              {link.url}
                            </a>
                          ) : (
                            link.url
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-400 dark:text-neutral-500 text-xs italic">
                No external links or past references attached to this project.
              </p>
            )}
          </div>

          {/* 3. Remarks & Management Directives */}
          {project.remarks && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/40 space-y-1.5">
              <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                <span>Remarks & Project Notes</span>
              </div>
              <p className="text-amber-900 dark:text-amber-200/90 text-xs leading-relaxed whitespace-pre-wrap font-medium">
                {project.remarks}
              </p>
            </div>
          )}

          {/* 4. Project Media & Screenshots */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-850 space-y-2">
            <div className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-cyan-500" />
              <span>Project Media & Attached Assets</span>
            </div>

            {project.media ? (
              <div className="space-y-2">
                {isImage(project.media) ? (
                  <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 max-h-64 flex items-center justify-center p-2">
                    <img
                      src={project.media}
                      alt="Project preview"
                      className="max-h-60 w-auto object-contain rounded-xl"
                    />
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                    <span className="text-xs text-slate-700 dark:text-neutral-300 font-mono truncate mr-2">
                      {project.media}
                    </span>
                    <a
                      href={project.media}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 dark:text-neutral-500 text-xs italic">
                No screenshots or media assets uploaded.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-zinc-950/95 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold transition cursor-pointer shadow-sm active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
