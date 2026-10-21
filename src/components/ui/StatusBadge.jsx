import React from 'react';
import { CheckCircle2, Clock, PauseCircle, AlertTriangle, AlertCircle } from 'lucide-react';

export default function StatusBadge({ status }) {
  switch (status) {
    case 'Completed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Completed
        </span>
      );
    case 'In Progress':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          In Progress
        </span>
      );
    case 'On Hold':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
          <PauseCircle className="w-3.5 h-3.5" />
          On Hold
        </span>
      );
    case 'Overdue':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm shadow-rose-950">
          <AlertTriangle className="w-3.5 h-3.5" />
          Overdue
        </span>
      );
    case 'Not Started':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
          <AlertCircle className="w-3.5 h-3.5" />
          Not Started
        </span>
      );
  }
}
