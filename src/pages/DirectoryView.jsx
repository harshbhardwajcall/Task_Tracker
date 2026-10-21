import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  AddEmployeeModal,
  AddProjectModal,
  EditProjectModal,
  ViewProjectModal,
  AddDepartmentModal,
  EditDepartmentModal,
  EmployeeAnalyticsModal,
  EditUserModal
} from '../components';
import {
  Users,
  Briefcase,
  Building,
  Mail,
  Plus,
  Trash2,
  Pencil,
  Eye,
  GraduationCap,
  Award,
  ShieldCheck,
  FolderPlus,
  BarChart3,
  ChevronRight,
  TrendingUp,
  Activity,
  Layers,
  RefreshCw,
  Link2,
  Image as ImageIcon
} from 'lucide-react';

export default function DirectoryView({ type = 'employees' }) {
  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showAddDepartmentModal, setShowAddDepartmentModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [viewingProject, setViewingProject] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editingDepartment, setEditingDepartment] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      if (type === 'employees') {
        const [empRes, deptRes] = await Promise.all([
          api.getEmployees(),
          api.getDepartments().catch(() => ({ departments: [] }))
        ]);
        setData(empRes.employees || []);
        if (deptRes?.departments) setDepartments(deptRes.departments);
      } else if (type === 'projects') {
        const res = await api.getProjects();
        setData(res.projects || []);
      } else if (type === 'departments') {
        const res = await api.getDepartments();
        setData(res.departments || []);
      }
    } catch (err) {
      console.error(`Failed loading ${type}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [type]);

  const handleToggleManager = async (emp) => {
    if (emp.role === 'Intern' || emp.title === 'Intern') {
      alert('Interns cannot be made managers. Only employees can be managers.');
      return;
    }
    const isCurrentlyManager = emp.role === 'Manager' || emp.title === 'Manager';
    const newRole = isCurrentlyManager ? 'Employee' : 'Manager';
    const newTitle = isCurrentlyManager ? 'Employee' : 'Manager';
    const actionLabel = isCurrentlyManager ? 'demote this user to standard Employee' : 'make this user a Manager';
    if (window.confirm(`Are you sure you want to ${actionLabel} for "${emp.name}"?`)) {
      try {
        await api.updateAdminUser(emp.id, {
          role: newRole,
          title: newTitle
        });
        loadData();
      } catch (err) {
        alert(err.message || 'Failed to update manager status.');
      }
    }
  };

  const handleDeleteEmployee = async (e, emp) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to permanently delete ${emp.title || 'team member'} "${emp.name}" from the database? This will permanently delete their account and all associated tasks.`)) {
      try {
        await api.deleteEmployee(emp.id);
        loadData();
      } catch (err) {
        alert(err.message || 'Failed to delete employee.');
      }
    }
  };

  const handleDeleteProject = async (e, proj) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to permanently delete project "${proj.name}" from the database? This will permanently delete the project and all tasks under it.`)) {
      try {
        await api.deleteProject(proj.id);
        loadData();
      } catch (err) {
        alert(err.message || 'Failed to delete project.');
      }
    }
  };

  const handleDeleteDepartment = async (e, dept) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to permanently delete department "${dept.name}" from the database? This will delete the department, all projects & tasks under it, and unlink assigned users.`)) {
      try {
        await api.deleteDepartment(dept.id);
        loadData();
      } catch (err) {
        alert(err.message || 'Failed to delete department.');
      }
    }
  };

  const titles = {
    employees: {
      title: 'Employee Directory & Performance',
      desc: 'Active team members, interns, and click any employee to view full performance statistics & charts',
      icon: Users
    },
    projects: {
      title: 'Projects Registry',
      desc: 'Active organization projects and task distribution',
      icon: Briefcase
    },
    departments: {
      title: 'Departments Overview',
      desc: 'Organizational divisions and team assignments',
      icon: Building
    }
  };

  const currentInfo = titles[type] || titles.employees;
  const Icon = currentInfo.icon;

  if (loading) {
    return (
      <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-400">Loading {type} directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Icon className="w-5 h-5 text-white" />
            {currentInfo.title}
          </h2>
          <p className="text-xs text-slate-400">{currentInfo.desc}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Action Button: Add Employee, Add Project, or Add Department */}
          {type === 'employees' && (
            <button
              onClick={() => setShowAddEmployeeModal(true)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-white/5 transition cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Team Member</span>
            </button>
          )}

          {type === 'projects' && (
            <button
              onClick={() => setShowAddProjectModal(true)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-white/5 transition cursor-pointer active:scale-95"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Add Project</span>
            </button>
          )}

          {type === 'departments' && (
            <button
              onClick={() => setShowAddDepartmentModal(true)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-white/5 transition cursor-pointer active:scale-95"
            >
              <Building className="w-4 h-4" />
              <span>Add Department</span>
            </button>
          )}

          {/* Refresh Action Button */}
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-neutral-300 border border-zinc-750 text-xs font-semibold flex items-center justify-center transition cursor-pointer shadow-sm active:scale-95"
            title={`Refresh ${type} directory`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Employees Card Grid */}
        {type === 'employees' && data.map(emp => {
          const isManager = emp.role === 'Manager' || emp.title === 'Manager';
          const isIntern = (emp.role === 'Intern' || emp.title === 'Intern') && !isManager;

          return (
            <div
              key={emp.id}
              onClick={() => setSelectedEmployeeId(emp.id)}
              className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800 hover:border-zinc-700 hover:shadow-lg space-y-3 relative group transition cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0 transition ${
                      isManager
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 group-hover:border-purple-400'
                        : isIntern
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 group-hover:border-amber-400'
                        : 'bg-zinc-900 border-zinc-700 text-white group-hover:border-white/40'
                    }`}
                  >
                    {isManager ? (
                      <ShieldCheck className="w-5 h-5 text-purple-400" />
                    ) : (
                      emp.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm group-hover:text-amber-300 transition flex items-center gap-1">
                        <span>{emp.name}</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-amber-300" />
                      </h4>
                      {/* Designation Badge: Manager, Intern or Employee */}
                      {isManager ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 bg-purple-500/20 text-purple-300 border-purple-500/30">
                          <ShieldCheck className="w-3 h-3 text-purple-400" />
                          <span>Manager</span>
                        </span>
                      ) : isIntern ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 bg-amber-500/20 text-amber-300 border-amber-500/30">
                          <GraduationCap className="w-3 h-3 text-amber-400" />
                          <span>Intern</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                          <Award className="w-3 h-3 text-emerald-400" />
                          <span>Employee</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-neutral-500 shrink-0" />
                      <span className="truncate">
                        {emp.email && !emp.email.endsWith('@company.local') ? emp.email : 'No email registered'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Actions: Edit Role/Profile and Delete Employee */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingUser(emp);
                    }}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition cursor-pointer opacity-70 group-hover:opacity-100"
                    title={`Edit ${emp.name}'s role and details`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => handleDeleteEmployee(e, emp)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition cursor-pointer opacity-70 group-hover:opacity-100"
                    title={`Delete ${emp.title || 'employee'} ${emp.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Bottom Row: Department & Interactive Actions */}
              <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-xs text-neutral-400 gap-2">
                <span className="truncate">Dept: <strong className="text-neutral-200">{emp.department_name || 'General'}</strong></span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Make Manager / Toggle Manager Button (Only for employees, not interns) */}
                  {!isIntern && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleManager(emp);
                      }}
                      className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shadow-sm ${
                        isManager
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800'
                          : 'bg-zinc-900 hover:bg-purple-500/20 text-neutral-300 hover:text-purple-300 border-zinc-800 hover:border-purple-500/40'
                      }`}
                      title={isManager ? 'Demote back to standard Employee' : 'Make this employee a Manager'}
                    >
                      <ShieldCheck className={`w-3 h-3 ${isManager ? 'text-purple-300' : 'text-purple-400'}`} />
                      <span>{isManager ? 'Manager' : 'Make Manager'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEmployeeId(emp.id);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-white hover:text-black text-neutral-300 border border-zinc-800 text-[11px] font-bold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-sky-400 group-hover:text-black" />
                    <span>View Analytics</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Projects Card Grid */}
        {type === 'projects' && data.map(proj => (
          <div
            key={proj.id}
            onClick={() => setViewingProject(proj)}
            className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 hover:border-sky-500/40 bg-white dark:bg-zinc-900/60 hover:bg-slate-50 dark:hover:bg-zinc-900/80 transition-all duration-200 flex flex-col justify-between group cursor-pointer shadow-sm hover:shadow-md space-y-3"
          >
            <div className="space-y-3">
              {/* Header: Project Title + Action Icons (View, Edit, Delete) */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 text-sky-600 dark:text-sky-400 group-hover:scale-105 transition shrink-0">
                      <Briefcase className="w-4 h-4" />
                    </span>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-wide truncate group-hover:text-sky-600 dark:group-hover:text-sky-300 transition">
                      {proj.name}
                    </h4>
                  </div>
                </div>

                {/* Card Action Icons: View, Edit, Delete */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setViewingProject(proj)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 border border-transparent hover:border-sky-200 dark:hover:border-sky-500/30 transition cursor-pointer"
                    title={`View project "${proj.name}" details`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProject(proj)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 border border-transparent hover:border-amber-200 dark:hover:border-amber-500/30 transition cursor-pointer"
                    title={`Edit project "${proj.name}"`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteProject(e, proj)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/30 transition cursor-pointer"
                    title={`Delete project "${proj.name}"`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {proj.description || 'No description provided for this project.'}
              </p>

              {/* Tasks Breakdown (In Progress, On Hold, Completed, Not Started) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="uppercase tracking-wider">Project Tasks Status</span>
                  <span className="text-slate-800 dark:text-slate-200 font-extrabold">{proj.total_tasks || 0} Total</span>
                </div>

                {/* Multi-segment progress bar */}
                {(proj.total_tasks || 0) > 0 && (
                  <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${Math.round(((proj.completed_tasks || 0) / proj.total_tasks) * 100)}%` }}
                      className="bg-emerald-500 h-full"
                      title={`Completed: ${proj.completed_tasks || 0}`}
                    />
                    <div
                      style={{ width: `${Math.round(((proj.in_progress_tasks || 0) / proj.total_tasks) * 100)}%` }}
                      className="bg-sky-500 h-full"
                      title={`In Progress: ${proj.in_progress_tasks || 0}`}
                    />
                    <div
                      style={{ width: `${Math.round(((proj.on_hold_tasks || 0) / proj.total_tasks) * 100)}%` }}
                      className="bg-amber-500 h-full"
                      title={`On Hold: ${proj.on_hold_tasks || 0}`}
                    />
                    <div
                      style={{ width: `${Math.round(((proj.not_started_tasks || 0) / proj.total_tasks) * 100)}%` }}
                      className="bg-slate-300 dark:bg-zinc-600 h-full"
                      title={`Not Started: ${proj.not_started_tasks || 0}`}
                    />
                  </div>
                )}

                {/* 4 Status Pills */}
                <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                  {/* In Progress */}
                  <div className="p-1 rounded-md bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50">
                    <span className="text-slate-500 dark:text-zinc-400 block text-[9px] uppercase font-semibold">Prog</span>
                    <span className="font-extrabold text-sky-700 dark:text-sky-300 text-xs">{proj.in_progress_tasks || 0}</span>
                  </div>

                  {/* On Hold */}
                  <div className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
                    <span className="text-slate-500 dark:text-zinc-400 block text-[9px] uppercase font-semibold">Hold</span>
                    <span className="font-extrabold text-amber-700 dark:text-amber-300 text-xs">{proj.on_hold_tasks || 0}</span>
                  </div>

                  {/* Completed */}
                  <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                    <span className="text-slate-500 dark:text-zinc-400 block text-[9px] uppercase font-semibold">Done</span>
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-xs">{proj.completed_tasks || 0}</span>
                  </div>

                  {/* Not Started */}
                  <div className="p-1 rounded-md bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-500 dark:text-zinc-400 block text-[9px] uppercase font-semibold">New</span>
                    <span className="font-extrabold text-slate-700 dark:text-zinc-300 text-xs">{proj.not_started_tasks || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer: Dept Name & Extra Indicators */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] text-slate-500 font-medium">Dept:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 truncate max-w-[130px]" title={proj.department_name || 'Global'}>
                  {proj.department_name || 'Global'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {proj.links && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-800/60 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700/40" title="Has external resource links">
                    <Link2 className="w-2.5 h-2.5 text-sky-600 dark:text-sky-400" />
                  </span>
                )}
                {proj.media && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-800/60 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700/40" title="Has attached project media">
                    <ImageIcon className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                  </span>
                )}
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-300 px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                  {proj.total_tasks || 0} Tasks
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingProject(proj);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-500/20 border border-sky-200 dark:border-sky-500/30 flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-2xs"
                  title="View full project details (description, links, remarks)"
                >
                  <Eye className="w-3 h-3" />
                  <span>View</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Departments Card Grid */}
        {type === 'departments' && data.map(dept => (
          <div key={dept.id} className="glass-card p-4 rounded-xl border border-slate-800 space-y-3 relative group hover:border-slate-700 transition">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-100 text-sm">{dept.name}</h4>
                <div className="mt-1">
                  <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">
                    {dept.total_users || 0} Members
                  </span>
                </div>
              </div>

              {/* Department Action Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDepartment(dept);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/30 transition cursor-pointer"
                  title={`Edit department "${dept.name}"`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteDepartment(e, dept)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition cursor-pointer opacity-70 group-hover:opacity-100"
                  title={`Delete department "${dept.name}"`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
              {dept.description || 'No description provided for this department.'}
            </p>
          </div>
        ))}
      </div>

      {/* Creation Modals */}
      {showAddEmployeeModal && (
        <AddEmployeeModal
          onClose={() => setShowAddEmployeeModal(false)}
          onEmployeeAdded={() => {
            loadData();
            setShowAddEmployeeModal(false);
          }}
        />
      )}

      {showAddProjectModal && (
        <AddProjectModal
          onClose={() => setShowAddProjectModal(false)}
          onProjectAdded={() => {
            loadData();
            setShowAddProjectModal(false);
          }}
        />
      )}

      {showAddDepartmentModal && (
        <AddDepartmentModal
          onClose={() => setShowAddDepartmentModal(false)}
          onDepartmentAdded={() => {
            loadData();
            setShowAddDepartmentModal(false);
          }}
        />
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onProjectUpdated={() => {
            loadData();
            setEditingProject(null);
          }}
        />
      )}

      {/* Edit Department Modal */}
      {editingDepartment && (
        <EditDepartmentModal
          department={editingDepartment}
          onClose={() => setEditingDepartment(null)}
          onDepartmentUpdated={() => {
            loadData();
            setEditingDepartment(null);
          }}
        />
      )}

      {/* View Project Details Modal */}
      {viewingProject && (
        <ViewProjectModal
          project={viewingProject}
          onClose={() => setViewingProject(null)}
          onEdit={(proj) => {
            setViewingProject(null);
            setEditingProject(proj);
          }}
        />
      )}

      {/* Employee Detailed Analytics Modal */}
      {selectedEmployeeId && (
        <EmployeeAnalyticsModal
          employeeId={selectedEmployeeId}
          onClose={() => setSelectedEmployeeId(null)}
          onRefreshList={loadData}
        />
      )}

      {/* Edit User / Role Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          departments={departments}
          onClose={() => setEditingUser(null)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
