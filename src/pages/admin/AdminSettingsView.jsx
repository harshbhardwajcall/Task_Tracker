import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import {
  ShieldCheck,
  UserPlus,
  KeyRound,
  ShieldAlert,
  Search,
  Mail,
  Lock,
  User,
  Building,
  CheckCircle2,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Sliders,
  Briefcase,
  Award,
  Crown,
  X,
  BarChart3
} from 'lucide-react';
import { ADMIN_ROLE_OPTIONS } from '@/constants/tasks';
import { ResetPasswordModal, EditUserModal, EmployeeAnalyticsModal, JobTitleSelect } from '@/components';

export default function AdminSettingsView({ onNavigateTab }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL' | 'Admin' | 'Employee'

  // Form states for Quick Creation
  const [activeCreationType, setActiveCreationType] = useState('Employee'); // 'Employee' | 'Intern' | 'Admin'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department_id: '',
    title: '',
    is_manager: false,
    admin_role: 'CTO',
    custom_admin_role: ''
  });
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [creationLoading, setCreationLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Active modal targets
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [editModalUser, setEditModalUser] = useState(null);
  const [analyticsUserId, setAnalyticsUserId] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, deptRes] = await Promise.all([
        api.getUsers().catch(() => ({ users: [] })),
        api.getDepartments().catch(() => ({ departments: [] }))
      ]);
      setUsers(usersRes.users || []);
      setDepartments(deptRes.departments || []);
    } catch (err) {
      console.error('Failed loading users and departments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-dismiss success message after 4 seconds
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Auto-dismiss error message after 6 seconds
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => {
      setErrorMessage('');
    }, 6000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  const handleCreationSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    setCreationLoading(true);

    try {
      if (!formData.password || formData.password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        setCreationLoading(false);
        return;
      }

      if (activeCreationType !== 'Admin' && !formData.title.trim()) {
        setErrorMessage('Job title is required.');
        setCreationLoading(false);
        return;
      }

      const assignedRole = activeCreationType === 'Admin'
        ? 'Admin'
        : (activeCreationType === 'Intern' ? 'Intern' : (formData.is_manager ? 'Manager' : 'Employee'));
      const assignedTitle = activeCreationType === 'Admin'
        ? (formData.admin_role === 'Other' ? (formData.custom_admin_role.trim() || 'Administrator') : formData.admin_role)
        : formData.title.trim();

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password.trim(),
        role: assignedRole,
        department_id: activeCreationType === 'Admin' ? null : (formData.department_id ? Number(formData.department_id) : 1),
        title: assignedTitle
      };

      const res = await api.createAdminUser(payload);
      setSuccessMessage(res.message || `${assignedRole} (${assignedTitle}) created successfully!`);
      setFormData({
        name: '',
        email: '',
        password: '',
        department_id: departments[0]?.id || '',
        title: '',
        is_manager: false,
        admin_role: 'CTO',
        custom_admin_role: ''
      });
      await loadData();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create user account.');
    } finally {
      setCreationLoading(false);
    }
  };

  const handleToggleManager = async (u) => {
    if (u.role === 'Admin') return;
    if (u.role === 'Intern' || u.title === 'Intern') {
      alert('Interns cannot be made managers. Only employees can be managers.');
      return;
    }
    const isCurrentlyManager = u.role === 'Manager' || u.title === 'Manager';
    const newRole = isCurrentlyManager ? 'Employee' : 'Manager';
    const newTitle = isCurrentlyManager ? 'Employee' : 'Manager';
    const actionLabel = isCurrentlyManager ? 'demote this user to standard Employee' : 'make this user a Manager';
    if (window.confirm(`Are you sure you want to ${actionLabel} for "${u.name}"?`)) {
      try {
        await api.updateAdminUser(u.id, {
          role: newRole,
          title: newTitle
        });
        await loadData();
      } catch (err) {
        alert(err.message || 'Failed to update manager status.');
      }
    }
  };


  const handleDeleteUser = async (user) => {
    if (user.id === currentUser?.id) {
      alert('You cannot delete your own currently active administrator account.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${user.role} "${user.name}" (${user.email})? Their user account will be removed, but all assigned tasks will be preserved so they can be reassigned to other team members.`)) {
      try {
        await api.deleteAdminUser(user.id);
        await loadData();
      } catch (err) {
        alert(err.message || 'Failed to delete user.');
      }
    }
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    const isManager = u.role === 'Manager' || u.title === 'Manager';
    const isIntern = (u.role === 'Intern' || u.title === 'Intern') && !isManager;
    const matchesRole =
      roleFilter === 'ALL' ||
      (roleFilter === 'Admin' && u.role === 'Admin') ||
      (roleFilter === 'Manager' && isManager) ||
      (roleFilter === 'Intern' && isIntern) ||
      (roleFilter === 'Employee' && (u.role === 'Employee' || !u.role) && !isIntern && !isManager);

    const matchesSearch =
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const adminCount = users.filter(u => u.role === 'Admin').length;
  const managerCount = users.filter(u => u.role === 'Manager' || u.title === 'Manager').length;
  const internCount = users.filter(u => (u.role === 'Intern' || u.title === 'Intern') && u.role !== 'Manager' && u.title !== 'Manager').length;
  const employeeCount = users.filter(u => (u.role === 'Employee' || !u.role) && u.title !== 'Intern' && u.title !== 'Manager' && u.role !== 'Manager').length;

  return (
    <div className="space-y-5 relative selection:bg-white/20">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 rounded-xl bg-[#0c0c10]/95 border border-white/10 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Admin & Security Settings</h2>
              <span className="px-2 py-0.5 text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                Admin Console
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Provision employee/admin logins, configure executive roles (CEO, CTO, SDE), and reset passwords
            </p>
          </div>
        </div>

        {onNavigateTab && (
          <button
            type="button"
            onClick={() => onNavigateTab('manager_control')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="Configure Manager Navigation Views and Granular Powers"
          >
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>Manager Control & Permissions →</span>
          </button>
        )}
      </div>

      {/* Account Provisioning Panel */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/90 border border-white/10 shadow-xl space-y-4">
        {/* Toggle between Add Employee vs Add Manager vs Add Intern vs Add Another Admin */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-850">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-white" />
            <span className="text-xs font-extrabold text-white">Create New Login Account:</span>
          </div>

          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => {
                setActiveCreationType('Employee');
                setFormData(prev => ({ ...prev, title: '', is_manager: false }));
                setSuccessMessage('');
                setErrorMessage('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeCreationType === 'Employee'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              + Add Employee
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveCreationType('Intern');
                setFormData(prev => ({ ...prev, title: '', is_manager: false }));
                setSuccessMessage('');
                setErrorMessage('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeCreationType === 'Intern'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              + Add Intern
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveCreationType('Admin');
                setFormData(prev => ({ ...prev, admin_role: 'CTO' }));
                setSuccessMessage('');
                setErrorMessage('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeCreationType === 'Admin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              + Add Another Admin
            </button>
          </div>
        </div>

        {/* Success / Error Alerts */}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage('')}
              className="p-1 rounded-lg hover:bg-emerald-900/40 text-emerald-400 hover:text-emerald-200 transition cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage('')}
              className="p-1 rounded-lg hover:bg-rose-900/40 text-rose-400 hover:text-rose-200 transition cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Account Creation Form */}
        <form onSubmit={handleCreationSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 text-xs">
          {/* Full Name */}
          <div>
            <label className="font-semibold text-neutral-300 block mb-1">Full Name *</label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={activeCreationType === 'Admin' ? 'e.g. Sarah Jenkins' : (activeCreationType === 'Intern' ? 'e.g. Alex Rivera' : 'e.g. John Doe')}
                className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 pl-9 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition"
                required
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="font-semibold text-neutral-300 block mb-1">Login Email Address *</label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder={activeCreationType === 'Admin' ? 'cto@company.com' : (activeCreationType === 'Intern' ? 'intern@company.com' : 'employee@company.com')}
                className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 pl-9 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="font-semibold text-neutral-300 block mb-1">Initial Password *</label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
              <input
                type={showFormPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Initial password (min 6 chars)"
                minLength={6}
                className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 pl-9 pr-8 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowFormPassword(!showFormPassword)}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
              >
                {showFormPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* For Admin: Show Role (SDE, CEO, CTO, etc.) / For Employee & Intern: Show Department */}
          {activeCreationType === 'Admin' ? (
            <div>
              <label className="font-semibold text-amber-300 block mb-1 flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" /> Admin Role / Title *
              </label>
              <div className="relative">
                <Briefcase className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-3 pointer-events-none" />
                <select
                  value={formData.admin_role}
                  onChange={(e) => setFormData({ ...formData, admin_role: e.target.value })}
                  className="w-full bg-zinc-900 border border-amber-500/40 rounded-xl px-3 py-2 pl-9 text-xs text-amber-200 font-semibold focus:outline-none focus:border-amber-400 transition"
                >
                  {ADMIN_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white font-normal">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {formData.admin_role === 'Other' && (
                <input
                  type="text"
                  value={formData.custom_admin_role}
                  onChange={(e) => setFormData({ ...formData, custom_admin_role: e.target.value })}
                  placeholder="Enter custom role title..."
                  className="w-full bg-zinc-900 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-amber-200 placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition mt-1.5"
                  required
                />
              )}
            </div>
          ) : (
            <div>
              <label className="font-semibold text-neutral-300 block mb-1">Department</label>
              <div className="relative">
                <Building className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 pl-9 text-xs text-white focus:outline-none focus:border-white transition"
                >
                  <option value="">Select Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Job Title for Employee, Manager, Intern */}
          {activeCreationType !== 'Admin' && (
            <div>
              <label className="font-semibold text-neutral-300 block mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-sky-400" />
                  Job Title *
                </span>
                <span className="text-[10px] text-sky-400/80 font-normal">Select or add with +</span>
              </label>
              <JobTitleSelect
                value={formData.title}
                onChange={(val) => setFormData({ ...formData, title: val })}
                role={activeCreationType === 'Intern' ? 'Intern' : (formData.is_manager ? 'Manager' : 'Employee')}
                placeholder="Select Job Title..."
                required
              />
            </div>
          )}

          {/* Action / Submit Area */}
          <div className="flex items-end gap-2">
            {activeCreationType === 'Employee' && (
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  is_manager: !prev.is_manager
                }))}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                  formData.is_manager
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                    : 'bg-zinc-900 border-zinc-750 text-neutral-400 hover:text-white'
                }`}
                title="Toggle Manager designation for this new employee"
              >
                <ShieldCheck className={`w-3.5 h-3.5 ${formData.is_manager ? 'text-purple-400' : 'text-neutral-500'}`} />
                <span>{formData.is_manager ? 'Manager: Yes' : 'Make Manager'}</span>
              </button>
            )}

            <button
              type="submit"
              disabled={creationLoading}
              className={`w-full py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50 ${
                activeCreationType === 'Admin'
                  ? 'bg-amber-500 hover:bg-amber-400 text-black'
                  : activeCreationType === 'Intern'
                  ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
                  : formData.is_manager
                  ? 'bg-purple-500 hover:bg-purple-400 text-white'
                  : 'bg-white hover:bg-neutral-200 text-black'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{creationLoading ? 'Creating...' : `Create ${activeCreationType === 'Employee' && formData.is_manager ? 'Manager' : activeCreationType}`}</span>
            </button>
          </div>
        </form>
      </div>

      {/* User Accounts & Password Management Registry */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/90 border border-white/10 shadow-xl space-y-3.5">
        {/* Registry Header Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-850">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white">Registered User Logins & Roles</h3>
            <span className="text-[10px] text-neutral-500 font-mono">({users.length} Total)</span>
          </div>

          {/* Role Filter & Search */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
              <button
                type="button"
                onClick={() => setRoleFilter('ALL')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                  roleFilter === 'ALL' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                All ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('Admin')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                  roleFilter === 'Admin' ? 'bg-amber-500/20 text-amber-300' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Admins ({adminCount})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('Manager')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                  roleFilter === 'Manager' ? 'bg-purple-500/20 text-purple-300' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Managers ({managerCount})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('Employee')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                  roleFilter === 'Employee' ? 'bg-emerald-500/20 text-emerald-300' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Employees ({employeeCount})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('Intern')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                  roleFilter === 'Intern' ? 'bg-indigo-500/20 text-indigo-300' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Interns ({internCount})
              </button>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 dark:text-neutral-500 absolute left-3 top-2.5 pointer-events-none z-10" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user, role, email..."
                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-750 rounded-xl py-1.5 pr-3 !pl-10 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-slate-900 dark:focus:border-white transition"
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
          </div>
        </div>

        {/* User Accounts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredUsers.map((u) => {
            const isAdmin = u.role === 'Admin';
            const isManager = u.role === 'Manager' || u.title === 'Manager';
            const isIntern = (u.role === 'Intern' || u.title === 'Intern') && !isManager;
            const isSelf = u.id === currentUser?.id;
            const displayTitle = u.title || (isAdmin ? 'Administrator' : (isManager ? 'Manager' : 'Employee'));

            return (
              <div
                key={u.id}
                className={`p-3.5 rounded-xl border space-y-3 relative group transition shadow-sm ${
                  isAdmin
                    ? 'bg-zinc-950/90 border-amber-500/30 hover:border-amber-500/50'
                    : isManager
                    ? 'bg-zinc-950/90 border-purple-500/30 hover:border-purple-500/50'
                    : 'bg-zinc-950/90 border-zinc-800/90 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isAdmin
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : isManager
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : isIntern
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {isAdmin ? (
                        <Crown className="w-4 h-4 text-amber-400" />
                      ) : isManager ? (
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                      ) : (
                        u.name.substring(0, 2).toUpperCase()
                      )}
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs truncate">{u.name}</span>
                        {isSelf && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-neutral-800 text-neutral-300 border border-neutral-700">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-neutral-500 shrink-0" />
                        <span className="truncate">{u.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Role & Title Badges */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                        isAdmin
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : isManager
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          : isIntern
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {u.role}
                    </span>
                    <span className="text-[10px] font-bold text-neutral-300 px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800">
                      {displayTitle}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>
                    {isAdmin ? (
                      <span className="text-amber-400/90 font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Full Access
                      </span>
                    ) : (
                      <span>Dept: <strong className="text-neutral-200">{u.department_name || 'General'}</strong></span>
                    )}
                  </span>

                  {/* Actions: Toggle Manager, Reset Password, Edit, Delete */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Make Manager / Toggle Manager Button (employees only, not admins or interns) */}
                    {!isAdmin && !isIntern && (
                      <button
                        onClick={() => handleToggleManager(u)}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                          isManager
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40'
                            : 'bg-zinc-900 hover:bg-purple-500/20 text-neutral-300 hover:text-purple-300 border-zinc-750 hover:border-purple-500/40'
                        }`}
                        title={isManager ? 'Demote back to standard Employee' : 'Make this user a Manager'}
                      >
                        <ShieldCheck className={`w-3 h-3 ${isManager ? 'text-purple-300' : 'text-purple-400'}`} />
                        <span>{isManager ? 'Manager' : 'Make Manager'}</span>
                      </button>
                    )}

                    {/* View Analytics Button */}
                    <button
                      onClick={() => setAnalyticsUserId(u.id)}
                      className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 border border-zinc-750 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                      title={`View detailed performance analytics and deliverables for ${u.name}`}
                    >
                      <BarChart3 className="w-3 h-3 text-sky-400" />
                      <span>Analytics</span>
                    </button>

                    {/* Reset Password Button */}
                    <button
                      onClick={() => {
                        setPasswordModalUser(u);
                        setNewPassword('');
                        setModalSuccess('');
                        setModalError('');
                      }}
                      className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-zinc-750 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                      title={`Reset password for ${u.name}`}
                    >
                      <KeyRound className="w-3 h-3 text-amber-400" />
                      <span>Set Password</span>
                    </button>

                    {/* Edit User Button */}
                    <button
                      onClick={() => setEditModalUser(u)}
                      className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-zinc-850 border border-transparent hover:border-zinc-700 transition cursor-pointer"
                      title="Edit user details"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    {/* Delete User Button */}
                    {!isSelf && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition cursor-pointer opacity-70 group-hover:opacity-100"
                        title={`Delete account for ${u.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <div className="col-span-full p-8 text-center text-xs text-neutral-500">
              No user accounts found matching your search.
            </div>
          )}
        </div>
      </div>

      {/* Password Reset Modal */}
      <ResetPasswordModal
        user={passwordModalUser}
        onClose={() => setPasswordModalUser(null)}
        onSuccess={loadData}
      />

      {/* Edit User Profile Modal */}
      <EditUserModal
        user={editModalUser}
        departments={departments}
        onClose={() => setEditModalUser(null)}
        onSuccess={loadData}
      />

      {/* Employee Detailed Performance & Analytics Modal */}
      {analyticsUserId && (
        <EmployeeAnalyticsModal
          employeeId={analyticsUserId}
          onClose={() => setAnalyticsUserId(null)}
          onRefreshList={loadData}
        />
      )}
    </div>
  );
}
