import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { api } from '../../services/api';
import {
  ShieldCheck,
  User,
  LogOut,
  LogIn,
  Sun,
  Moon,
  Home,
  RefreshCw,
  PlusCircle,
  Bell,
  CheckCheck,
  Trash2,
  CheckCircle2,
  MessageSquare,
  Clock,
  Sparkles,
  X,
  FileText,
  Repeat,
  Share2
} from 'lucide-react';

export default function Navbar({
  currentTab,
  onNavigateHome,
  onNavigateProfile,
  onRefresh,
  isRefreshing = false,
  onOpenCreateTask
}) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const isAdmin = user?.role === 'Admin';

  // Notifications from central NotificationContext
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    openTaskFromNotification,
    browserPermission,
    requestBrowserPermission,
    testWindowsNotification
  } = useNotifications();

  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const parseNotificationDate = (dateStr) => {
    if (!dateStr) return null;
    let clean = String(dateStr).trim();
    if (!clean.includes('T') && !clean.endsWith('Z')) {
      clean = clean.replace(' ', 'T') + 'Z';
    } else if (clean.includes('T') && !clean.endsWith('Z') && !clean.includes('+')) {
      clean = clean + 'Z';
    }
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatNotificationTime = (dateStr) => {
    const d = parseNotificationDate(dateStr);
    if (!d) return dateStr || '';

    // Actual local time: e.g. "1:34 AM"
    const actualTime = d.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const diffMs = Math.max(0, now - d);
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    let relative = '';
    if (diffSec < 45) {
      relative = 'Just now';
    } else if (diffMin < 60) {
      relative = `${diffMin}m ago`;
    } else if (diffMin < 24 * 60 && isToday) {
      const diffHour = Math.floor(diffMin / 60);
      relative = `${diffHour}h ago`;
    }

    if (isToday) {
      return relative ? `${actualTime} (${relative})` : `Today at ${actualTime}`;
    }

    if (isYesterday) {
      return `Yesterday, ${actualTime}`;
    }

    const dateFormatted = d.toLocaleDateString([], {
      day: 'numeric',
      month: 'short'
    });

    return `${dateFormatted}, ${actualTime}`;
  };

  const getNotificationIcon = (type) => {
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
        return <Repeat className="w-4 h-4 text-indigo-400" />;
      case 'TASK_LOOP_WARNING':
      case 'SELF_TASK_LOOP_WARNING':
        return <Repeat className="w-4 h-4 text-amber-400" />;
      case 'PROJECT_SHARED':
        return <Share2 className="w-4 h-4 text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-sky-400" />;
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-4 lg:px-6 py-2.5 shadow-sm dark:shadow-xl">
      <div className="flex items-center justify-between gap-3">
        {/* Left Brand Title with Call Astro Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <img
            src="/Call_Astro_icon.png"
            alt="Call Astro Logo"
            className="h-10 sm:h-11 w-auto object-contain shrink-0"
          />
          <div>
            <h1 className="text-base sm:text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:via-neutral-200 dark:to-neutral-400 bg-clip-text text-transparent flex items-center gap-2 tracking-tight">
              Task Tracker
            </h1>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-neutral-400 font-medium leading-none">
              Enterprise Management System
            </p>
          </div>
        </div>

        {/* Center / Action Buttons: Home, Refresh, Create Task (For Everyone) */}
        {user && (
          <div className="flex items-center gap-2">
            {/* Home / Dashboard Button */}
            <button
              type="button"
              onClick={onNavigateHome}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition duration-150 cursor-pointer shadow-sm active:scale-95 ${
                currentTab === 'dashboard'
                  ? 'bg-sky-500/20 text-sky-500 dark:text-sky-400 border-sky-500/40 shadow-sm'
                  : 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Go to Home Dashboard"
            >
              <Home className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              <span className="hidden sm:inline">Home</span>
            </button>

            {/* Refresh Action Button */}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-xs font-bold transition duration-150 cursor-pointer shadow-sm active:scale-95 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white"
                title="Refresh Tasks & Summary"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-500 dark:text-sky-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}

            {/* Create Task Button */}
            {onOpenCreateTask && (user?.role !== 'Manager' || user?.permissions?.can_create_tasks !== false) && (
              <button
                type="button"
                onClick={onOpenCreateTask}
                className="btn-primary text-xs flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl shadow-md shadow-sky-950/40 cursor-pointer font-bold"
                title="Create New Task"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Create Task</span>
              </button>
            )}
          </div>
        )}

        {/* Right User State, Theme Toggle, Notification Bell & Sign Out */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Notification Bell Button & Dropdown Popover */}
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) {
                    fetchNotifications();
                  }
                }}
                className={`relative flex items-center justify-center w-9 h-9 rounded-xl border text-xs font-bold transition duration-150 cursor-pointer shadow-sm active:scale-95 ${
                  showNotifications
                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-400'
                    : 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={`Notifications (${unreadCount} unread)`}
                aria-label="View notifications"
              >
                <Bell className="w-4 h-4 text-slate-700 dark:text-neutral-200" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black shadow-lg animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Floating Notifications Popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Dropdown Header */}
                  <div className="p-3.5 bg-slate-50 dark:bg-zinc-900/90 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-sky-500" />
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Notifications
                      </h3>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAllAsRead(e);
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition cursor-pointer flex items-center gap-1"
                          title="Mark all notifications as read"
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span>Mark all read</span>
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearAll();
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Clear all notifications"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Windows Desktop Notifications Status / Prompt */}
                  <div className="px-3 py-2 bg-slate-50 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs">
                    {browserPermission === 'granted' ? (
                      <>
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Windows Alerts: Active</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            testWindowsNotification();
                          }}
                          className="px-2 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-neutral-300 text-[10px] font-semibold transition cursor-pointer"
                          title="Send a sample Windows notification to test"
                        >
                          Test Windows Alert
                        </button>
                      </>
                    ) : browserPermission === 'denied' ? (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400">
                        ⚠️ Windows alerts blocked in browser site settings.
                      </span>
                    ) : (
                      <>
                        <span className="text-[11px] text-sky-700 dark:text-sky-300">
                          Enable Windows alerts like WhatsApp?
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            requestBrowserPermission();
                          }}
                          className="px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold shrink-0 shadow-xs cursor-pointer"
                        >
                          Enable
                        </button>
                      </>
                    )}
                  </div>

                  {/* Notifications List */}
                  <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {notifications.length === 0 ? (
                      <div className="py-10 px-4 text-center">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-zinc-900 flex items-center justify-center mx-auto mb-2 text-slate-400 dark:text-neutral-500">
                          <Sparkles className="w-5 h-5 text-amber-400" />
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-neutral-300">
                          All caught up!
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-neutral-500 mt-0.5">
                          No notifications yet. You will be alerted when tasks are assigned or changed.
                        </p>
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            openTaskFromNotification(item);
                            setShowNotifications(false);
                          }}
                          className={`p-3 transition flex items-start gap-3 cursor-pointer group ${
                            !item.is_read
                              ? 'bg-sky-50/70 dark:bg-sky-950/20 hover:bg-sky-100/70 dark:hover:bg-sky-950/40'
                              : 'hover:bg-slate-50 dark:hover:bg-zinc-900/60 opacity-80 hover:opacity-100'
                          }`}
                        >
                          {/* Icon */}
                          <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs shrink-0 mt-0.5">
                            {getNotificationIcon(item.type)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-xs leading-snug ${!item.is_read ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-neutral-300'}`}>
                                {item.title}
                              </p>
                              {!item.is_read && (
                                <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-neutral-400 mt-0.5 break-words line-clamp-2">
                              {item.message}
                            </p>
                            <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-slate-400 dark:text-neutral-500">
                              <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400 dark:text-neutral-400" title={formatNotificationTime(item.created_at)}>
                                <Clock className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                                <span>{formatNotificationTime(item.created_at)}</span>
                              </span>
                              {item.sender_name && (
                                <span className="truncate">by {item.sender_name}</span>
                              )}
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                            {!item.is_read && (
                              <button
                                type="button"
                                onClick={(e) => markAsRead(item.id, e)}
                                className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 cursor-pointer"
                                title="Mark as read"
                              >
                                <CheckCheck className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => deleteNotification(item.id, e)}
                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              title="Delete notification"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-xs font-bold transition duration-150 cursor-pointer shadow-sm active:scale-95 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden md:inline">Dark</span>
              </>
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              {/* User Profile Pill - Clickable to open Profile & Password Page */}
              <button
                type="button"
                onClick={onNavigateProfile}
                className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border shadow-sm transition duration-150 cursor-pointer text-left active:scale-95 ${
                  currentTab === 'profile'
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/50 shadow-sm'
                    : 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-sky-500/40 hover:bg-slate-200 dark:hover:bg-zinc-800/80'
                }`}
                title="Click to view & edit Profile / Change Password"
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-7 h-7 rounded-lg object-cover border border-slate-300 dark:border-zinc-700 shrink-0 shadow-xs"
                  />
                ) : (
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      isAdmin
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                )}

                <div className="text-left hidden lg:block">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{user.name}</span>
                    <span
                      className={`px-1.5 py-0.2 text-[9px] rounded font-extrabold uppercase border ${
                        isAdmin
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-neutral-400 font-normal leading-none mt-0.5">
                    {user.email}
                  </div>
                </div>
              </button>

              {/* Direct Sign Out Button */}
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-700 dark:text-neutral-300 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-zinc-800 hover:border-rose-300 dark:hover:border-rose-800/80 text-xs font-bold transition duration-150 cursor-pointer shadow-sm active:scale-95"
                title="Sign Out of Task Tracker"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
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
