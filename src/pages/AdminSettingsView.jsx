import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
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
  X
} from 'lucide-react';

const ADMIN_ROLE_OPTIONS = [
  { value: 'CEO', label: 'CEO (Chief Executive Officer)' },
  { value: 'CTO', label: 'CTO (Chief Technology Officer)' },
  { value: 'COO', label: 'COO (Chief Operating Officer)' },
  { value: 'SDE', label: 'SDE (Software Development Engineer)' },
  { value: 'Lead SDE', label: 'Lead SDE / Architect' },
  { value: 'VP Engineering', label: 'VP of Engineering' },
  { value: 'Head of Product', label: 'Head of Product' },
  { value: 'Operations Lead', label: 'Operations Lead' },
  { value: 'Administrator', label: 'System Administrator' },
  { value: 'Other', label: 'Custom Title...' }
];

export default function AdminSettingsView() {
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
    password: 'password123',
    department_id: '',
    title: 'Employee',
    admin_role: 'CTO',
    custom_admin_role: ''
  });
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [creationLoading, setCreationLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Password Reset Modal state
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [modalSuccess, setModalSuccess] = useState('');
  const [modalError, setModalError] = useState('');

  // Edit User Modal state
  const [editModalUser, setEditModalUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: 'Employee',
    department_id: '',
    title: '',
    admin_role: 'CTO',
    custom_admin_role: ''
  });
  const [editLoading, setEditLoading] = useState(false);

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

  const handleCreationSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    setCreationLoading(true);

    try {
      const assignedRole = activeCreationType === 'Admin' ? 'Admin' : (activeCreationType === 'Intern' ? 'Intern' : 'Employee');
      const assignedTitle = activeCreationType === 'Admin'
        ? (formData.admin_role === 'Other' ? (formData.custom_admin_role.trim() || 'Administrator') : formData.admin_role)
        : (activeCreationType === 'Intern' ? 'Intern' : (formData.title || 'Employee'));

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password.trim(),
        role: assignedRole,
        department_id: activeCreationType === 'Admin' ? null : (formData.department_id ? Number(formData.department_id) : 1),
        title: assignedTitle
      };

      const res = await api.createAdminUser(payload);
      setSuccessMessage(res.message || `${activeCreationType} (${assignedTitle}) created successfully!`);
      setFormData({
        name: '',
        email: '',
        password: 'password123',
        department_id: departments[0]?.id || '',
        title: 'Employee',
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

  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    setModalSuccess('');
    setModalError('');
    setResetLoading(true);

    try {
      const res = await api.resetUserPassword(passwordModalUser.id, newPassword);
      setModalSuccess(res.message || 'Password successfully updated!');
      setTimeout(() => {
        setPasswordModalUser(null);
        setNewPassword('');
        setModalSuccess('');
      }, 1500);
    } catch (err) {
      setModalError(err.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editModalUser) return;
    setEditLoading(true);

    try {
      const finalTitle = editFormData.role === 'Admin'
        ? (editFormData.admin_role === 'Other' ? (editFormData.custom_admin_role.trim() || 'Administrator') : editFormData.admin_role)
        : editFormData.title;

      await api.updateAdminUser(editModalUser.id, {
        name: editFormData.name,
        email: editFormData.email,
        role: editFormData.role,
        department_id: editFormData.role === 'Admin' ? null : (editFormData.department_id ? Number(editFormData.department_id) : null),
        title: finalTitle
      });
      setEditModalUser(null);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to update user.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.id === currentUser?.id) {
      alert('You cannot delete your own currently active administrator account.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${user.role} "${user.name}" (${user.email})? This will permanently delete their account and associated tasks.`)) {
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
    const isIntern = u.role === 'Intern' || u.title === 'Intern';
    const matchesRole =
      roleFilter === 'ALL' ||
      (roleFilter === 'Admin' && u.role === 'Admin') ||
      (roleFilter === 'Intern' && isIntern) ||
      (roleFilter === 'Employee' && (u.role === 'Employee' && !isIntern));

    const matchesSearch =
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const adminCount = users.filter(u => u.role === 'Admin').length;
  const internCount = users.filter(u => u.role === 'Intern' || u.title === 'Intern').length;
  const employeeCount = users.filter(u => u.role === 'Employee' && u.title !== 'Intern').length;

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
      </div>

      {/* Account Provisioning Panel */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/90 border border-white/10 shadow-xl space-y-4">
        {/* Toggle between Add Employee vs Add Another Admin */}
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
                setFormData(prev => ({ ...prev, title: 'Employee' }));
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
                setFormData(prev => ({ ...prev, title: 'Intern' }));
                setSuccessMessage('');
                setErrorMessage('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeCreationType === 'Intern'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
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
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Account Creation Form */}
        <form onSubmit={handleCreationSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
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
                placeholder="password123"
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

          {/* Designation / Submit Button */}
          <div className="flex items-end">
            <button
              type="submit"
              disabled={creationLoading}
              className={`w-full py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50 ${
                activeCreationType === 'Admin'
                  ? 'bg-amber-500 hover:bg-amber-400 text-black'
                  : activeCreationType === 'Intern'
                  ? 'bg-purple-500 hover:bg-purple-400 text-white'
                  : 'bg-white hover:bg-neutral-200 text-black'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{creationLoading ? 'Creating...' : `Create ${activeCreationType}`}</span>
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
                  roleFilter === 'Intern' ? 'bg-purple-500/20 text-purple-300' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Interns ({internCount})
              </button>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user, role, email..."
                className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-1.5 pl-8 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition"
              />
            </div>
          </div>
        </div>

        {/* User Accounts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredUsers.map((u) => {
            const isAdmin = u.role === 'Admin';
            const isIntern = u.title === 'Intern';
            const isSelf = u.id === currentUser?.id;
            const displayTitle = u.title || (isAdmin ? 'Administrator' : 'Employee');

            return (
              <div
                key={u.id}
                className={`p-3.5 rounded-xl border space-y-3 relative group transition shadow-sm ${
                  isAdmin
                    ? 'bg-zinc-950/90 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-zinc-950/90 border-zinc-800/90 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isAdmin
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {isAdmin ? <Crown className="w-4 h-4 text-amber-400" /> : u.name.substring(0, 2).toUpperCase()}
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
                          : isIntern
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
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

                  {/* Actions: Reset Password, Edit, Delete */}
                  <div className="flex items-center gap-1.5">
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
                      onClick={() => {
                        const matchedAdminOpt = ADMIN_ROLE_OPTIONS.find(o => o.value === u.title);
                        setEditModalUser(u);
                        setEditFormData({
                          name: u.name,
                          email: u.email,
                          role: u.role,
                          department_id: u.department_id || '',
                          title: u.title || (u.role === 'Admin' ? 'Administrator' : 'Employee'),
                          admin_role: matchedAdminOpt ? matchedAdminOpt.value : (u.role === 'Admin' ? 'Other' : 'CTO'),
                          custom_admin_role: matchedAdminOpt ? '' : (u.title || '')
                        });
                      }}
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

      {/* MODAL 1: Password Reset Modal */}
      {passwordModalUser && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#0c0c10] border border-white/15 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Reset Account Password</h3>
              </div>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
              <div className="text-neutral-400">Target Account:</div>
              <div className="font-bold text-white">{passwordModalUser.name} ({passwordModalUser.title || passwordModalUser.role})</div>
              <div className="text-[11px] text-neutral-500">{passwordModalUser.email}</div>
            </div>

            {modalSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordResetSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-neutral-300 block mb-1">New Password (Min 4 characters) *</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password..."
                    className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 pl-9 pr-9 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition"
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-850">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-neutral-300 border border-zinc-750 font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{resetLoading ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Edit User Profile Modal */}
      {editModalUser && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#0c0c10] border border-white/15 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-white" />
                <h3 className="text-sm font-bold text-white">Edit User Profile</h3>
              </div>
              <button
                onClick={() => setEditModalUser(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-neutral-300 block mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white transition"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-300 block mb-1">Email Address *</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white transition"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-300 block mb-1">Account Role *</label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white transition"
                >
                  <option value="Employee">Employee</option>
                  <option value="Intern">Intern</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {editFormData.role === 'Admin' ? (
                <div>
                  <label className="font-semibold text-amber-300 block mb-1">Admin Role / Title *</label>
                  <select
                    value={editFormData.admin_role}
                    onChange={(e) => setEditFormData({ ...editFormData, admin_role: e.target.value })}
                    className="w-full bg-zinc-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-200 font-semibold focus:outline-none focus:border-amber-400 transition"
                  >
                    {ADMIN_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white font-normal">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {editFormData.admin_role === 'Other' && (
                    <input
                      type="text"
                      value={editFormData.custom_admin_role}
                      onChange={(e) => setEditFormData({ ...editFormData, custom_admin_role: e.target.value })}
                      placeholder="Enter custom role..."
                      className="w-full bg-zinc-900 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-amber-200 focus:outline-none focus:border-amber-400 transition mt-1.5"
                    />
                  )}
                </div>
              ) : (
                <div>
                  <label className="font-semibold text-neutral-300 block mb-1">Department</label>
                  <select
                    value={editFormData.department_id}
                    onChange={(e) => setEditFormData({ ...editFormData, department_id: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white transition"
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-850">
                <button
                  type="button"
                  onClick={() => setEditModalUser(null)}
                  className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-neutral-300 border border-zinc-750 font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold transition cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
