import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  User,
  LogOut,
  LogIn
} from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'Admin';

  return (
    <header className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-zinc-800 px-4 lg:px-6 py-2.5 shadow-xl">
      <div className="flex items-center justify-between">
        {/* Left Brand Title with Call Astro Logo */}
        <div className="flex items-center gap-3.5">
          <img
            src="/Call_Astro_icon.png"
            alt="Call Astro Logo"
            className="h-11 w-auto object-contain shrink-0"
          />
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent flex items-center gap-2 tracking-tight">
              Task Tracker
            </h1>
            <p className="text-[11px] text-neutral-400 font-medium leading-none">
              Enterprise Management System
            </p>
          </div>
        </div>

        {/* Right User State & Sign Out */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {/* User Profile Pill */}
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-sm">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                    isAdmin
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{user.name}</span>
                    <span
                      className={`px-1.5 py-0.2 text-[9px] rounded font-extrabold uppercase border ${
                        isAdmin
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-400 font-normal leading-none mt-0.5">
                    {user.email}
                  </div>
                </div>
              </div>

              {/* Direct Sign Out Button */}
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-rose-950/60 text-neutral-300 hover:text-rose-300 border border-zinc-800 hover:border-rose-800/80 text-xs font-bold transition duration-150 cursor-pointer shadow-sm active:scale-95"
                title="Sign Out of Task Tracker"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {}}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-extrabold transition duration-150 cursor-pointer shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5 text-black" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
