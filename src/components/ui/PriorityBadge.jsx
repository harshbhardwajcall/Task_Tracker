import React from 'react';
import { Flame, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';

export default function PriorityBadge({ priority }) {
  switch (priority) {
    case 'Critical':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-950/80 text-rose-300 border border-rose-600/40">
          <Flame className="w-3.5 h-3.5 text-rose-400 fill-rose-400/30" />
          Critical
        </span>
      );
    case 'High':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-950/70 text-amber-300 border border-amber-600/30">
          <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
          High
        </span>
      );
    case 'Medium':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-neutral-800 text-neutral-200 border border-neutral-700">
          <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
          Medium
        </span>
      );
    case 'Low':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
          <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
          Low
        </span>
      );
  }
}
