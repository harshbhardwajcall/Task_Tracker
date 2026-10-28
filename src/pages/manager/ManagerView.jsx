import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import {
  CreateTeamModal,
  EditTeamModal,
  ViewTeamModal,
  ProjectDetailsModal,
  AddTeamMemberModal,
  ShareProjectModal,
  TeamCard
} from '@/components';
import {
  Users,
  Briefcase,
  Building,
  Plus,
  Shield,
  Activity,
  FolderKanban,
  Filter,
  Share2
} from 'lucide-react';

export default function ManagerView() {
  const { user } = useAuth();

  // Primary data states
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Admin filter by manager (if Admin viewing)
  const [selectedManagerFilter, setSelectedManagerFilter] = useState('');

  // Modal Visibility States
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [viewingTeam, setViewingTeam] = useState(null);
  const [viewingProjectDetails, setViewingProjectDetails] = useState(null);
  const [selectedTeamForMember, setSelectedTeamForMember] = useState(null);
  const [showShareProjectModal, setShowShareProjectModal] = useState(false);
  const [selectedProjectForShare, setSelectedProjectForShare] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedManagerFilter) {
        params.manager_id = selectedManagerFilter;
      }

      const [teamsRes, empRes, projRes, deptRes] = await Promise.all([
        api.getTeams(params),
        api.getEmployees(),
        api.getProjects(),
        api.getDepartments()
      ]);

      setTeams(teamsRes.teams || []);
      setEmployees(empRes.employees || []);
      setProjects(projRes.projects || []);
      setDepartments(deptRes.departments || []);
    } catch (err) {
      console.error('Failed to load manager portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedManagerFilter]);

  const handleDeleteTeam = async (team) => {
    if (!confirm(`Are you sure you want to delete squad "${team.name}"?`)) return;
    try {
      await api.deleteTeam(team.id);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete squad.');
    }
  };

  // Filter manager accounts for the Admin filter dropdown
  const managerList = employees.filter(e => e.role === 'Manager' || e.role === 'Admin');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-sky-500" />
            <span>
              {user?.role === 'Manager' ? 'My Squads & Deliverables' : 'Team Formation'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {user?.role === 'Manager'
              ? `Welcome, ${user.name}. Manage your assigned squads, team members, and deliverables.`
              : 'Build cross-functional squads, assign engineers & interns, designate team leads, and manage project deliverables.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Admin Manager Filter (Allows Admin to view any manager's view) */}
          {user?.role === 'Admin' && managerList.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedManagerFilter}
                onChange={(e) => setSelectedManagerFilter(e.target.value)}
                className="bg-transparent border-none text-slate-800 dark:text-zinc-200 focus:outline-none text-xs cursor-pointer"
              >
                <option value="">All Managers' Squads</option>
                {managerList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Share Team with other managers */}
          <button
            type="button"
            onClick={() => {
              setSelectedProjectForShare(null);
              setShowShareProjectModal(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-950/20 transition-all"
            title="Share a team with other managers to co-manage"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Team</span>
          </button>

          {(user?.role !== 'Manager' || user?.permissions?.can_create_teams !== false) && (
            <button
              onClick={() => setShowCreateTeamModal(true)}
              className="btn-primary text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-sky-950/40"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Team</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards (Personalized to visible squads) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-slate-100">{teams.length}</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {user?.role === 'Manager' ? 'My Squads' : 'Active Teams'}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-slate-100">
              {teams.reduce((acc, t) => acc + (t.total_projects || 0), 0)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Allocated Projects</div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-slate-100">
              {teams.reduce((acc, t) => acc + (t.total_members || 0), 0)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Squad Members</div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-slate-100">{departments.length}</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Departments</div>
          </div>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-sky-500" />
          <span>
            {user?.role === 'Manager' ? 'Squads Led by You' : 'Formed Squads & Allocations'}
          </span>
        </h2>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading squads...</div>
        ) : teams.length === 0 ? (
          <div className="bg-white dark:bg-zinc-950 p-12 text-center rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3 shadow-sm">
            <Users className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
              {user?.role === 'Manager' ? 'No Squads Assigned Yet' : 'No Squads Formed Yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {user?.role === 'Manager'
                ? 'Create a new squad or contact your admin to be assigned as lead.'
                : 'Create your first squad to assign employees, associate projects, and monitor deliverables.'}
            </p>
            <button
              onClick={() => setShowCreateTeamModal(true)}
              className="btn-primary text-xs mt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Squad</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((team) => {
              const canDeleteSquad = user?.role !== 'Manager' || user?.permissions?.can_delete_teams !== false;
              const canManageSquadMembers = user?.role !== 'Manager' || user?.permissions?.can_manage_members !== false;
              return (
                <TeamCard
                  key={team.id}
                  team={team}
                  onView={(t) => setViewingTeam(t)}
                  onEdit={(t) => setEditingTeam(t)}
                  onDelete={canDeleteSquad ? (t) => handleDeleteTeam(t) : null}
                  onAddMember={canManageSquadMembers ? (t) => setSelectedTeamForMember(t) : null}
                  onShareProject={(t) => {
                    setSelectedProjectForShare(t?.id || null);
                    setShowShareProjectModal(true);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* 1. Modal: Create Team */}
      <CreateTeamModal
        isOpen={showCreateTeamModal}
        onClose={() => setShowCreateTeamModal(false)}
        onSuccess={() => loadData()}
        employees={employees}
        projects={projects}
        departments={departments}
      />

      {/* 2. Modal: Edit Team */}
      <EditTeamModal
        isOpen={!!editingTeam}
        team={editingTeam}
        employees={employees}
        departments={departments}
        projects={projects}
        onClose={() => setEditingTeam(null)}
        onSuccess={() => loadData()}
      />

      {/* 3. Modal: View Team Details */}
      <ViewTeamModal
        isOpen={!!viewingTeam}
        team={viewingTeam}
        onClose={() => setViewingTeam(null)}
        onSeeProjectDetails={(proj) => setViewingProjectDetails(proj)}
        onAddMember={(t) => setSelectedTeamForMember(t)}
        onShareProject={(proj) => {
          setSelectedProjectForShare(proj?.id || null);
          setShowShareProjectModal(true);
        }}
        onRefresh={() => loadData()}
      />

      {/* 4. Modal: Project Details */}
      <ProjectDetailsModal
        isOpen={!!viewingProjectDetails}
        project={viewingProjectDetails}
        onClose={() => setViewingProjectDetails(null)}
      />

      {/* 5. Modal: Add Team Member */}
      <AddTeamMemberModal
        isOpen={!!selectedTeamForMember}
        team={selectedTeamForMember}
        employees={employees}
        onClose={() => setSelectedTeamForMember(null)}
        onSuccess={() => loadData()}
      />

      {/* 6. Modal: Share Project with Co-Managers */}
      <ShareProjectModal
        isOpen={showShareProjectModal}
        onClose={() => {
          setShowShareProjectModal(false);
          setSelectedProjectForShare(null);
        }}
        preselectedProjectId={selectedProjectForShare}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
