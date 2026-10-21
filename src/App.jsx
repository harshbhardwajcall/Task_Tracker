import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import { Navbar, TopNav, CreateTaskModal, TaskDetailsModal } from './components';
import SideNotificationToasts from './components/ui/SideNotificationToasts';
import { useNotifications } from './context/NotificationContext';
import AdminView from './pages/AdminView';
import AdminSettingsView from './pages/AdminSettingsView';
import EmployeeDashboard from './pages/EmployeeDashboard';
import DirectoryView from './pages/DirectoryView';
import RecycleBinView from './pages/RecycleBinView';
import ManagerView from './pages/ManagerView';
import SelfLogsView from './pages/SelfLogsView';
import AuditLogsView from './pages/AuditLogsView';
import ManagerControlView from './pages/ManagerControlView';
import ReportsView from './pages/ReportsView';
import UserProfileView from './pages/UserProfileView';
import MyTeamView from './pages/MyTeamView';

export default function App() {
  const { user, loading } = useAuth();
  const { selectedTaskId, setSelectedTaskId } = useNotifications();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync default tab when user role changes
  useEffect(() => {
    setCurrentTab('dashboard');
  }, [user?.role, user?.id]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-neutral-400">Loading Task Tracker platform...</p>
      </div>
    );
  }

  // If no authenticated user, render Login page
  if (!user) {
    return <Login />;
  }

  const isAdmin = user.role === 'Admin';
  const isManager = user.role === 'Manager';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-neutral-100 flex flex-col relative overflow-hidden">
      {/* Background Call Astro Watermark */}
      <div
        id="app-ambient-watermark"
        className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden opacity-45 dark:opacity-10 select-none"
      >
        <img
          src="/Call_Astro_icon.png"
          alt="Call Astro Ambient Watermark"
          className="w-[880px] h-[880px] max-w-[92vw] max-h-[88vh] object-contain transition-opacity duration-300"
        />
      </div>

      {/* Top Header Bar with Home, Refresh, Create Task, Profile & Logout */}
      <Navbar
        currentTab={currentTab}
        onNavigateHome={() => setCurrentTab('dashboard')}
        onNavigateAdmin={() => setCurrentTab('admin_settings')}
        onNavigateProfile={() => setCurrentTab('profile')}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onOpenCreateTask={() => setShowCreateModal(true)}
      />

      {/* Horizontal Top Navigation Bar */}
      <TopNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenCreateTask={() => setShowCreateModal(true)}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Full-Width Main Content Viewport */}
      <main className="flex-1 p-4 lg:p-6 w-full max-w-full overflow-y-auto relative z-10 bg-transparent">
        {/* User Profile View (Personal Details & Password Management) */}
        {currentTab === 'profile' && (
          <UserProfileView key={`profile-${refreshTrigger}`} />
        )}

        {/* Dashboard View (Admin Hub for Admin, Personal Dashboard for Employee) */}
        {currentTab === 'dashboard' && (
          isAdmin ? (
            <AdminView key={`dash-admin-${refreshTrigger}`} />
          ) : (
            <EmployeeDashboard key={`dash-emp-${refreshTrigger}`} onOpenCreateTask={() => setShowCreateModal(true)} />
          )
        )}

        {/* Dedicated Admin Settings Tab */}
        {(currentTab === 'admin' || currentTab === 'admin_settings') && isAdmin && (
          <AdminSettingsView key={`admin-settings-${refreshTrigger}`} onNavigateTab={setCurrentTab} />
        )}

        {/* Employee Personal Deliverables: Assigned TO me */}
        {currentTab === 'my_tasks' && (
          <EmployeeDashboard key={`my-${refreshTrigger}`} scope="ASSIGNED_TO_ME" onOpenCreateTask={() => setShowCreateModal(true)} />
        )}

        {/* Employee Delegated Deliverables: Assigned BY me to others */}
        {currentTab === 'assigned_to_others' && (
          <EmployeeDashboard key={`assigned-by-${refreshTrigger}`} scope="ASSIGNED_BY_ME" onOpenCreateTask={() => setShowCreateModal(true)} />
        )}

        {/* Employee Completed Deliverables */}
        {currentTab === 'completed_tasks' && (
          <EmployeeDashboard key={`comp-${refreshTrigger}`} filterCompletedOnly={true} onOpenCreateTask={() => setShowCreateModal(true)} />
        )}

        {/* Teams & Squad Formation (Manager & Admin) */}
        {currentTab === 'teams' && (
          <ManagerView key={`teams-${refreshTrigger}`} />
        )}

        {/* Employee & Intern: My Squad & Project Allocation */}
        {currentTab === 'my_team' && (
          <MyTeamView key={`my-team-${refreshTrigger}`} />
        )}

        {/* Personal Self-Logs & Tests (For Everyone) */}
        {currentTab === 'self_logs' && (
          <SelfLogsView key={`self-logs-${refreshTrigger}`} />
        )}

        {/* System Change History & Audit Logs (Admin or authorized Manager) */}
        {currentTab === 'audit_logs' && (isAdmin || user?.permissions?.can_view_change_history) && (
          <AuditLogsView key={`audit-logs-${refreshTrigger}`} />
        )}

        {/* Directory Views (Admin or Manager with allowed tab) */}
        {currentTab === 'employees' && (isAdmin || user?.permissions?.allowed_tabs?.includes('employees')) && (
          <DirectoryView key={`emp-${refreshTrigger}`} type="employees" />
        )}

        {currentTab === 'projects' && (isAdmin || user?.permissions?.allowed_tabs?.includes('projects')) && (
          <DirectoryView key={`proj-${refreshTrigger}`} type="projects" />
        )}

        {currentTab === 'departments' && (isAdmin || user?.permissions?.allowed_tabs?.includes('departments')) && (
          <DirectoryView key={`dept-${refreshTrigger}`} type="departments" />
        )}

        {currentTab === 'recycle_bin' && (isAdmin || user?.permissions?.can_access_recycle_bin) && (
          <RecycleBinView key={`bin-${refreshTrigger}`} />
        )}

        {/* Reports & Workload (Admin or Manager with allowed tab) */}
        {currentTab === 'reports' && (isAdmin || user?.permissions?.allowed_tabs?.includes('reports')) && (
          <ReportsView key={`reports-${refreshTrigger}`} />
        )}

        {/* Dedicated Manager Control Tab (Admin Only) */}
        {currentTab === 'manager_control' && isAdmin && (
          <ManagerControlView key={`mgr-ctrl-${refreshTrigger}`} />
        )}
      </main>

      {/* Global Task Creation Modal */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onTaskCreated={() => {
            handleRefresh();
            setShowCreateModal(false);
          }}
        />
      )}

      {/* WhatsApp-Style Side Notification Toasts */}
      <SideNotificationToasts />

      {/* Direct Task Details Modal (opened from notification click) */}
      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          currentUser={user}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdated={handleRefresh}
        />
      )}
    </div>
  );
}
