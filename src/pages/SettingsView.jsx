import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, ShieldCheck, Mail, Building, Bell, Lock } from 'lucide-react';

export default function SettingsView() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">Account & Profile Settings</h2>
        <p className="text-xs text-slate-400">View user role permissions and account metadata</p>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center font-black text-2xl text-white shadow-xl">
            {user?.name?.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">{user?.name}</h3>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              {user?.email}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                {user?.role} Role
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {user?.department_name || 'General'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <h4 className="font-bold text-slate-200 text-sm">Role Access Rights & Scope</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="font-semibold text-sky-400">Task Control</span>
              <p className="text-slate-400">
                {user?.role === 'Manager'
                  ? 'Can create, edit, assign, delete, and monitor all organization tasks.'
                  : 'Can view assigned tasks, update progress status, add comments, and upload attachments.'}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="font-semibold text-emerald-400">Security & RBAC</span>
              <p className="text-slate-400">
                Authenticated via JWT bearer tokens with row-level API authorization.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
