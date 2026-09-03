import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Navbar from './components/Navbar';
import TopNav from './components/TopNav';
import AdminView from './pages/AdminView';
import AdminSettingsView from './pages/AdminSettingsView';
import EmployeeDashboard from './pages/EmployeeDashboard';
import DirectoryView from './pages/DirectoryView';
import RecycleBinView from './pages/RecycleBinView';
import CreateTaskModal from './components/CreateTaskModal';

export default function App() {
  const { user, loading } = useAuth();
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

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col relative overflow-hidden">
      {/* Background Call Astro Watermark */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden opacity-[0.10] select-none">
        <img
          src="/Call_Astro_icon.png"
          alt="Call Astro Ambient Watermark"
          className="w-[720px] h-[720px] object-contain drop-shadow-2xl brightness-90"
        />
      </div>

      {/* Top Navbar with Profile & Logout */}
      <Navbar
        onNavigateAdmin={() => setCurrentTab('admin_settings')}
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
      <main className="flex-1 p-4 lg:p-6 w-full max-w-full overflow-y-auto relative z-10">
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
          <AdminSettingsView key={`admin-settings-${refreshTrigger}`} />
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

        {/* Directory Views (Admin) */}
        {currentTab === 'employees' && isAdmin && (
          <DirectoryView key={`emp-${refreshTrigger}`} type="employees" />
        )}

        {currentTab === 'projects' && isAdmin && (
          <DirectoryView key={`proj-${refreshTrigger}`} type="projects" />
        )}

        {currentTab === 'departments' && isAdmin && (
          <DirectoryView key={`dept-${refreshTrigger}`} type="departments" />
        )}

        {currentTab === 'recycle_bin' && isAdmin && (
          <RecycleBinView key={`bin-${refreshTrigger}`} />
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
    </div>
  );
}
