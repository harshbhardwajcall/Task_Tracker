import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import AddEmployeeModal from '../components/AddEmployeeModal';
import AddProjectModal from '../components/AddProjectModal';
import AddDepartmentModal from '../components/AddDepartmentModal';
import EmployeeAnalyticsModal from '../components/EmployeeAnalyticsModal';
import {
  Users,
  Briefcase,
  Building,
  Mail,
  Plus,
  Trash2,
  GraduationCap,
  Award,
  FolderPlus,
  BarChart3,
  ChevronRight,
  TrendingUp,
  Activity,
  Layers,
  RefreshCw
} from 'lucide-react';

export default function DirectoryView({ type = 'employees' }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showAddDepartmentModal, setShowAddDepartmentModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      if (type === 'employees') {
        const res = await api.getEmployees();
        setData(res.employees || []);
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

  const handleDeleteEmployee = async (e, emp) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to remove ${emp.title || 'team member'} "${emp.name}"? All tasks assigned to them will be safely moved to the Recycle Bin.`)) {
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
    if (window.confirm(`Are you sure you want to delete project "${proj.name}"? This will also remove tasks associated with this project.`)) {
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
    if (window.confirm(`Are you sure you want to delete department "${dept.name}"? This will unlink it from any users and projects.`)) {
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
          const isIntern = emp.title === 'Intern';

          return (
            <div
              key={emp.id}
              onClick={() => setSelectedEmployeeId(emp.id)}
              className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800 hover:border-zinc-700 hover:shadow-lg space-y-3 relative group transition cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-white text-sm shrink-0 group-hover:border-white/40 transition">
                    {emp.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm group-hover:text-amber-300 transition flex items-center gap-1">
                        <span>{emp.name}</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-amber-300" />
                      </h4>
                      {/* Designation Badge: Intern or Employee */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                        isIntern
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {isIntern ? (
                          <>
                            <GraduationCap className="w-3 h-3 text-amber-400" />
                            <span>Intern</span>
                          </>
                        ) : (
                          <>
                            <Award className="w-3 h-3 text-emerald-400" />
                            <span>Employee</span>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-neutral-500 shrink-0" />
                      <span className="truncate">
                        {emp.email && !emp.email.endsWith('@company.local') ? emp.email : 'No email registered'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Delete Employee Button */}
                <button
                  onClick={(e) => handleDeleteEmployee(e, emp)}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition cursor-pointer opacity-70 group-hover:opacity-100"
                  title={`Delete ${emp.title || 'employee'} ${emp.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Bottom Row: Department & Interactive Analytics Action */}
              <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-xs text-neutral-400">
                <span>Dept: <strong className="text-neutral-200">{emp.department_name || 'General'}</strong></span>

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
          );
        })}

        {/* Projects Card Grid */}
        {type === 'projects' && data.map(proj => (
          <div key={proj.id} className="glass-card p-4 rounded-xl border border-slate-800 space-y-3 relative group hover:border-slate-700 transition">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-100 text-sm">{proj.name}</h4>
                <div className="mt-1">
                  <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">
                    {proj.total_tasks} Tasks
                  </span>
                </div>
              </div>

              {/* Delete Project Button */}
              <button
                onClick={(e) => handleDeleteProject(e, proj)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition cursor-pointer opacity-70 group-hover:opacity-100"
                title={`Delete project "${proj.name}"`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
              {proj.description || 'No description provided for this project.'}
            </p>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Department:</span>
              <span className="font-semibold text-slate-200 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                {proj.department_name || 'Global'}
              </span>
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

              {/* Delete Department Button */}
              <button
                onClick={(e) => handleDeleteDepartment(e, dept)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition cursor-pointer opacity-70 group-hover:opacity-100"
                title={`Delete department "${dept.name}"`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
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

      {/* Employee Detailed Analytics Modal */}
      {selectedEmployeeId && (
        <EmployeeAnalyticsModal
          employeeId={selectedEmployeeId}
          onClose={() => setSelectedEmployeeId(null)}
          onRefreshList={loadData}
        />
      )}
    </div>
  );
}
