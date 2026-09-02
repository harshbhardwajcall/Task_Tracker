import React from 'react';
import { Layers, Clock, Activity, CheckCircle, AlertTriangle } from 'lucide-react';

export default function SummaryCards({ summary = {}, activeStatus, onSelectStatus }) {
  const cards = [
    {
      id: 'ALL',
      title: 'Total Tasks',
      count: summary.total || 0,
      icon: Layers,
      color: 'from-[#0e0e12] to-black border-white/5 text-neutral-100',
      activeColor: 'ring-2 ring-white border-white'
    },
    {
      id: 'Pending',
      title: 'Pending',
      count: summary.pending || 0,
      icon: Clock,
      color: 'from-amber-950/20 to-black border-amber-900/30 text-amber-300',
      activeColor: 'ring-2 ring-amber-500 border-amber-500'
    },
    {
      id: 'In Progress',
      title: 'In Progress',
      count: summary.in_progress || 0,
      icon: Activity,
      color: 'from-[#0e0e12] to-black border-white/5 text-neutral-200',
      activeColor: 'ring-2 ring-neutral-400 border-neutral-400'
    },
    {
      id: 'Completed',
      title: 'Completed',
      count: summary.completed || 0,
      icon: CheckCircle,
      color: 'from-emerald-950/20 to-black border-emerald-900/30 text-emerald-300',
      activeColor: 'ring-2 ring-emerald-500 border-emerald-500'
    },
    {
      id: 'Overdue',
      title: 'Overdue',
      count: summary.overdue || 0,
      icon: AlertTriangle,
      color: 'from-rose-950/20 to-black border-rose-900/30 text-rose-300',
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
            className={`p-2.5 px-3.5 rounded-xl bg-gradient-to-br border transition duration-150 text-left shadow-sm cursor-pointer flex items-center justify-between gap-2 ${card.color} ${isActive ? card.activeColor : 'hover:border-zinc-700 hover:scale-[1.01]'
              }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block leading-tight">
                {card.title}
              </span>
              <div className="text-xl font-extrabold tracking-tight mt-0.5 leading-none">
                {card.count}
              </div>
            </div>
            <div className="p-1.5 rounded-lg bg-black/80 border border-zinc-800 shrink-0">
              <Icon className="w-4 h-4 opacity-90" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
