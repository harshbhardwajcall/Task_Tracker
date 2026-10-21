import React from 'react';
import { Layers, Clock, Activity, CheckCircle, AlertTriangle } from 'lucide-react';

export default function SummaryCards({ summary = {}, activeStatus, onSelectStatus }) {
  const cards = [
    {
      id: 'ALL',
      title: 'Total Tasks',
      count: summary.total || 0,
      icon: Layers,
      color: 'bg-white dark:bg-gradient-to-br dark:from-[#0e0e12] dark:to-black border-slate-200 dark:border-white/5 text-slate-900 dark:text-neutral-100',
      activeColor: 'ring-2 ring-slate-900 dark:ring-white border-slate-900 dark:border-white'
    },
    {
      id: 'Pending',
      title: 'Pending',
      count: summary.pending || 0,
      icon: Clock,
      color: 'bg-amber-50/80 dark:bg-gradient-to-br dark:from-amber-950/20 dark:to-black border-amber-200/80 dark:border-amber-900/30 text-amber-900 dark:text-amber-300',
      activeColor: 'ring-2 ring-amber-500 border-amber-500'
    },
    {
      id: 'In Progress',
      title: 'In Progress',
      count: summary.in_progress || 0,
      icon: Activity,
      color: 'bg-sky-50/80 dark:bg-gradient-to-br dark:from-[#0e0e12] dark:to-black border-sky-200/80 dark:border-white/5 text-sky-900 dark:text-neutral-200',
      activeColor: 'ring-2 ring-sky-500 dark:ring-neutral-400 border-sky-500 dark:border-neutral-400'
    },
    {
      id: 'Completed',
      title: 'Completed',
      count: summary.completed || 0,
      icon: CheckCircle,
      color: 'bg-emerald-50/80 dark:bg-gradient-to-br dark:from-emerald-950/20 dark:to-black border-emerald-200/80 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-300',
      activeColor: 'ring-2 ring-emerald-500 border-emerald-500'
    },
    {
      id: 'Overdue',
      title: 'Overdue',
      count: summary.overdue || 0,
      icon: AlertTriangle,
      color: 'bg-rose-50/80 dark:bg-gradient-to-br dark:from-rose-950/20 dark:to-black border-rose-200/80 dark:border-rose-900/30 text-rose-900 dark:text-rose-300',
      activeColor: 'ring-2 ring-rose-500 border-rose-500'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
      {cards.map(card => {
        const Icon = card.icon;
        const isActive = activeStatus === card.id || (card.id === 'ALL' && !activeStatus);

        return (
          <button
            key={card.id}
            onClick={() => onSelectStatus(card.id === 'ALL' ? '' : card.id)}
            className={`p-2.5 px-3.5 rounded-xl border transition duration-150 text-left shadow-sm cursor-pointer flex items-center justify-between gap-2 ${card.color} ${isActive ? card.activeColor : 'hover:border-slate-300 dark:hover:border-zinc-700 hover:scale-[1.01]'
              }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 block leading-tight">
                {card.title}
              </span>
              <div className="text-xl font-extrabold tracking-tight mt-0.5 leading-none">
                {card.count}
              </div>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-black/80 border border-slate-200 dark:border-zinc-800 shrink-0">
              <Icon className="w-4 h-4 opacity-90" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
