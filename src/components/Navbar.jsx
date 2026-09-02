import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import AddManagerModal from './AddManagerModal';
import { ChevronDown, Check, UserCheck, Plus, Globe, Shield, Trash2 } from 'lucide-react';

export default function Navbar({ onSelectAllTasksFilter, viewAllTasks }) {
  const { user, availableUsers, switchProfile, refreshUsers } = useAuth();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showAddManagerModal, setShowAddManagerModal] = useState(false);

  const handleManagerAdded = async (newManager) => {
    await refreshUsers();
    if (newManager && newManager.id) {
      await switchProfile(newManager.id);
    }
  };

  const handleDeleteManager = async (e, manager) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete manager "${manager.name}"?`)) {
      try {
        await api.deleteManager(manager.id);
        await refreshUsers();

        // If the deleted manager was active, switch to another manager
        if (user?.id === manager.id) {
          const remaining = availableUsers.filter(u => u.role === 'Manager' && u.id !== manager.id);
          if (remaining.length > 0) {
            await switchProfile(remaining[0].id);
          }
        }
      } catch (err) {
        alert(err.message || 'Failed to delete manager.');
      }
    }
  };

  const managers = availableUsers.filter(u => u.role === 'Manager');

  return (
    <header className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-zinc-800 px-4 lg:px-6 py-2.5 shadow-xl">
      <div className="flex items-center justify-between">
        {/* Left Brand Title with Call Astro Logo (Borderless & Large) */}
        <div className="flex items-center gap-3.5">
          <img
            src="/Call_Astro_icon.png"
            alt="Call Astro Logo"
            className="h-12 w-auto object-contain shrink-0"
          />
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent flex items-center gap-2 tracking-tight">
              Task Tracker
            </h1>
            <p className="text-[11px] text-neutral-400 font-medium leading-none">Enterprise Management System</p>
          </div>
        </div>

        {/* Right Active Profile Selector */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-neutral-200 flex items-center gap-2.5 transition shadow-sm cursor-pointer"
              title="Select active manager or view all tasks"
            >
              <UserCheck className="w-4 h-4 text-neutral-300" />
              <div className="text-left hidden sm:block">
                <div className="text-[10px] text-neutral-400 font-normal leading-none mb-0.5">Active Scope:</div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{viewAllTasks ? '🌐 All Managers' : user?.name}</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                    {viewAllTasks ? 'Global' : 'Manager'}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            </button>

            {showProfileDropdown && (
              <div className="absolute right-0 mt-2 w-80 glass-panel rounded-xl shadow-2xl border border-zinc-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Header & Add Manager Action */}
                <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> Managers
                  </p>
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      setShowAddManagerModal(true);
                    }}
                    className="text-[11px] text-neutral-200 hover:text-white font-bold flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 transition hover:bg-zinc-750 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add New Manager
                  </button>
                </div>

                {/* Option: View All Tasks (Global View) */}
                <div className="p-1 border-b border-zinc-800/80">
                  <button
                    onClick={() => {
                      if (onSelectAllTasksFilter) onSelectAllTasksFilter(true);
                      setShowProfileDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between hover:bg-zinc-850 transition cursor-pointer ${
                      viewAllTasks ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Globe className="w-4 h-4 text-neutral-400 shrink-0" />
                      <div>
                        <div className="font-bold">🌐 View All Tasks (All Managers)</div>
                        <div className="text-[10px] text-neutral-400">Display all organization tasks</div>
                      </div>
                    </div>
                    {viewAllTasks && <Check className="w-4 h-4 text-white" />}
                  </button>
                </div>

                {/* Manager List with Delete Option */}
                <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
                  {managers.map(m => (
                    <div
                      key={m.id}
                      onClick={() => {
                        if (onSelectAllTasksFilter) onSelectAllTasksFilter(false);
                        switchProfile(m.id);
                        setShowProfileDropdown(false);
                      }}
                      className={`w-full px-3 py-2 rounded-lg text-xs flex items-center justify-between hover:bg-zinc-850 transition cursor-pointer group ${
                        !viewAllTasks && user?.id === m.id ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate pr-2">
                        <div className="w-2 h-2 rounded-full bg-neutral-400 shrink-0" />
                        <div className="truncate">
                          <div className="font-semibold truncate">{m.name}</div>
                          <div className="text-[10px] text-neutral-400 truncate">
                            {m.email && !m.email.endsWith('@company.local') ? m.email : 'No email registered'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!viewAllTasks && user?.id === m.id && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                        {/* Delete Button (Allowed if more than 1 manager exists) */}
                        {managers.length > 1 && (
                          <button
                            onClick={(e) => handleDeleteManager(e, m)}
                            className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-rose-950/50 transition opacity-60 group-hover:opacity-100"
                            title={`Delete manager ${m.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Manager Modal */}
      {showAddManagerModal && (
        <AddManagerModal
          onClose={() => setShowAddManagerModal(false)}
          onManagerAdded={handleManagerAdded}
        />
      )}
    </header>
  );
}
