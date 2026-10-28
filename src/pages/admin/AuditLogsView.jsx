import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import {
  History,
  ShieldAlert,
  Search,
  Filter,
  User,
  Clock,
  Layers,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

export default function AuditLogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs({ limit: 500 });
      setLogs(res.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesRole = selectedRole === 'ALL' || log.role === selectedRole;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      String(log.id).includes(q) ||
      (log.user_id && String(log.user_id).includes(q)) ||
      (log.user_name && log.user_name.toLowerCase().includes(q)) ||
      (log.action && log.action.toLowerCase().includes(q)) ||
      (log.entity_type && log.entity_type.toLowerCase().includes(q)) ||
      (log.entity_id && String(log.entity_id).toLowerCase().includes(q)) ||
      (log.details && log.details.toLowerCase().includes(q));
    return matchesRole && matchesSearch;
  });

  const getActionBadgeColor = (action) => {
    if (!action) return 'bg-purple-950/60 text-purple-300 border-purple-800/80';
    if (action.includes('CREATE') || action.includes('ADD')) return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';
    if (action.includes('DELETE') || action.includes('REMOVE') || action.includes('PURGE')) return 'bg-rose-950/60 text-rose-300 border-rose-800/80';
    if (action.includes('STATUS')) return 'bg-sky-950/60 text-sky-300 border-sky-800/80';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'bg-amber-950/60 text-amber-300 border-amber-800/80';
    return 'bg-purple-950/60 text-purple-300 border-purple-800/80';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <History className="w-6 h-6 text-amber-400" />
            <span>System Audit Logs & Change History</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time record of all actions performed by Admins, Managers, and Employees across the organization.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="btn-secondary text-xs flex items-center gap-2 cursor-pointer w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'Admin', 'Manager', 'Employee', 'Intern'].map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                selectedRole === role
                  ? 'bg-amber-600/30 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {role === 'ALL' ? 'All Roles' : role}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Search by Change ID, User ID, action, details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field py-1.5 text-xs w-full"
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-3.5">Change ID</th>
                <th className="py-3 px-3.5">Timestamp</th>
                <th className="py-3 px-3.5">User ID</th>
                <th className="py-3 px-3.5">User Name</th>
                <th className="py-3 px-3.5">Role</th>
                <th className="py-3 px-3.5">Action</th>
                <th className="py-3 px-3.5">Entity</th>
                <th className="py-3 px-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    Loading system change logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    No matching audit logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-mono text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        #{log.id}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {log.user_id ? (
                        <span className="text-slate-300 bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50">
                          #{log.user_id}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-3.5 font-bold text-slate-200 whitespace-nowrap">
                      {log.user_name || 'System'}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {log.role || 'System'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-300 font-medium whitespace-nowrap">
                      {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                    </td>
                    <td className="py-3 px-3.5 text-slate-400 max-w-md truncate" title={log.details}>
                      {log.details || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
