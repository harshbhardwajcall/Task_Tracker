import React, { useEffect, useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import {
  X,
  Bell,
  CheckCircle2,
  PlusCircle,
  MessageSquare,
  FileText,
  Repeat,
  ExternalLink,
  Sparkles
} from 'lucide-react';

function getToastIcon(type) {
  switch (type) {
    case 'TASK_ASSIGNED':
      return <PlusCircle className="w-4 h-4 text-sky-400" />;
    case 'TASK_STATUS_CHANGED':
    case 'TASK_STATUS_CHANGE':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'TASK_COMMENT':
      return <MessageSquare className="w-4 h-4 text-purple-400" />;
    case 'TASK_UPDATED':
      return <FileText className="w-4 h-4 text-amber-400" />;
    case 'TASK_LOOP_RESET':
    case 'SELF_TASK_LOOP_RESET':
      return <Repeat className="w-4 h-4 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />;
    case 'TASK_LOOP_WARNING':
    case 'SELF_TASK_LOOP_WARNING':
      return <Repeat className="w-4 h-4 text-amber-400" />;
    default:
      return <Bell className="w-4 h-4 text-sky-400" />;
  }
}

function ToastItem({ toast, onDismiss, onOpen }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const duration = 7000; // 7 seconds auto-dismiss
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss(toast.toastId || toast.id);
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [toast, onDismiss]);

  const formatToastActualTime = (dateStr) => {
    if (!dateStr) {
      return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    let clean = String(dateStr).trim();
    if (!clean.includes('T') && !clean.endsWith('Z')) {
      clean = clean.replace(' ', 'T') + 'Z';
    } else if (clean.includes('T') && !clean.endsWith('Z') && !clean.includes('+')) {
      clean = clean + 'Z';
    }
    const d = new Date(clean);
    if (isNaN(d.getTime())) {
      return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <div
      onClick={() => onOpen(toast)}
      className="group pointer-events-auto w-84 sm:w-96 rounded-2xl bg-white/95 dark:bg-[#0c0d14]/95 border border-slate-200 dark:border-indigo-500/30 shadow-2xl backdrop-blur-xl p-3.5 transition duration-200 hover:scale-[1.02] cursor-pointer overflow-hidden relative animate-in slide-in-from-right-10 fade-in duration-300"
    >
      {/* Top Accent Gradient Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500" />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shrink-0">
            {getToastIcon(toast.type)}
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-900 dark:text-neutral-200 truncate block">
              {toast.sender_name || 'System Alert'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-neutral-400 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span>{formatToastActualTime(toast.created_at)}</span>
              <span className="text-slate-400 dark:text-neutral-500">• Just now</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(toast.toastId || toast.id);
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:text-neutral-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
          title="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-0.5 pl-9">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
          {toast.title}
        </h4>
        <p className="text-[11px] text-slate-600 dark:text-neutral-300 leading-relaxed line-clamp-2">
          {toast.message}
        </p>
      </div>

      {/* Bottom Actions */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between pl-9 text-[11px]">
        <span className="text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1 group-hover:underline">
          <span>Click to view details</span>
          <ExternalLink className="w-3 h-3" />
        </span>
        <span className="text-[10px] text-slate-400 dark:text-neutral-500">Auto-close in 7s</span>
      </div>

      {/* Progress Bar (countdown timer) */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-200 dark:bg-zinc-800">
        <div
          className="h-full bg-sky-500 dark:bg-sky-400 transition-all duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function SideNotificationToasts() {
  const { browserPermission, requestBrowserPermission, testWindowsNotification } = useNotifications();
  const [dismissedBanner, setDismissedBanner] = useState(false);

  // If permission is already granted or banner was dismissed for this session, render nothing
  if (browserPermission === 'granted' || dismissedBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm sm:max-w-md pointer-events-none">
      {/* WhatsApp-Style Windows Desktop Notifications Banner */}
      {browserPermission === 'default' && (
        <div className="pointer-events-auto p-3.5 rounded-2xl bg-slate-900/95 dark:bg-zinc-900/95 border border-sky-500/40 text-white shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 shrink-0">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div className="min-w-0">
              <h5 className="text-[12px] font-bold text-white leading-tight">
                Enable Windows Notifications
              </h5>
              <p className="text-[10px] text-slate-300 dark:text-neutral-400 mt-0.5 leading-snug">
                Receive real-time desktop alerts like WhatsApp when tasks are updated.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={requestBrowserPermission}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold transition cursor-pointer shadow-md active:scale-95 shrink-0"
            >
              Turn On
            </button>
            <button
              type="button"
              onClick={() => setDismissedBanner(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              title="Later"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
