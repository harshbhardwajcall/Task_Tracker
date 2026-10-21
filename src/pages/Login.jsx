import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ShieldCheck,
  UserCheck,
  LogIn,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertTriangle,
  X,
  Sun,
  Moon
} from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [loginMode, setLoginMode] = useState('Admin'); // 'Admin' | 'Employee'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleModeChange = (mode) => {
    setLoginMode(mode);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your work email address.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your account password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password.trim(), loginMode);
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.message || 'Wrong email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-neutral-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-white/20">
      {/* Top Floating Theme Switcher */}
      <div className="fixed top-6 right-6 z-40">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs font-bold transition duration-200 cursor-pointer shadow-lg backdrop-blur-md text-neutral-300 hover:text-white active:scale-95"
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-500" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>
      {/* Floating Popup Toast on Error */}
      {error && (
        <div className="fixed top-6 right-6 z-50 max-w-sm w-full bg-rose-950/95 border-2 border-rose-500/80 text-rose-100 p-4 rounded-2xl shadow-2xl shadow-rose-950/90 flex items-start gap-3 backdrop-blur-xl animate-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <div className="font-extrabold text-white text-[13px] mb-0.5">Authentication Error</div>
            <div className="text-rose-200 font-medium leading-relaxed">{error}</div>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-rose-400 hover:text-white p-1 rounded-lg hover:bg-rose-900/50 transition cursor-pointer"
            title="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Background Watermark & Glow Accents */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden opacity-10 select-none">
        <img
          src="/Call_Astro_icon.png"
          alt="Call Astro Ambient Watermark"
          className="w-[780px] h-[780px] object-contain drop-shadow-2xl"
        />
      </div>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-neutral-800/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl shadow-black/80">
            <img
              src="/Call_Astro_icon.png"
              alt="Call Astro Logo"
              className="h-14 w-auto object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent tracking-tight">
              Task Tracker
            </h1>
            <p className="text-xs text-neutral-400 font-medium mt-1">
              Enterprise Task & Team Orchestration Platform
            </p>
          </div>
        </div>

        {/* Login Panel */}
        <div className="bg-[#0c0c10]/95 backdrop-blur-xl p-6 sm:p-8 rounded-2xl border border-white/10 shadow-2xl shadow-black/90 space-y-5">
          {/* Mode Switcher Tabs: Admin vs Employee (includes Interns) */}
          <div className="grid grid-cols-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800 gap-1">
            <button
              type="button"
              onClick={() => handleModeChange('Admin')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${loginMode === 'Admin'
                  ? 'bg-white text-black shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-zinc-900'
                }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Admin Portal</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('Employee')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${loginMode === 'Employee'
                  ? 'bg-white text-black shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-zinc-900'
                }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>Employee Portal</span>
            </button>
          </div>


          {/* In-Card Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/80 text-rose-200 text-xs font-medium animate-in fade-in zoom-in-95 duration-200 flex items-start gap-2.5 shadow-lg shadow-rose-950/50">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold text-white block">Login Error</span>
                <span className="text-rose-200">{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError('')}
                className="text-rose-400 hover:text-white p-0.5"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-neutral-300 block mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={loginMode === 'Admin' ? 'admin@company.com' : 'employee@company.com'}
                  className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-4 py-3 pl-10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-neutral-300 block mb-1.5">
                Account Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your secure password"
                  className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-4 py-3 pl-10 pr-10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-neutral-400 hover:text-white transition"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold text-xs tracking-wide shadow-lg shadow-white/10 transition duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In as {loginMode}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-neutral-500">
          Task Tracker • Call Astro Enterprise Portal
        </p>
      </div>
    </div>
  );
}
