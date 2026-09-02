import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import TopNav from './components/TopNav';
import ManagerDashboard from './pages/ManagerDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import DirectoryView from './pages/DirectoryView';
import RecycleBinView from './pages/RecycleBinView';

export default function App() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewAllTasks, setViewAllTasks] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-neutral-400">Loading Task Tracker platform...</p>
      </div>
    );
  }

  const isManager = user.role === 'Manager';

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

      {/* Top Navbar */}
      <Navbar
        viewAllTasks={viewAllTasks}
        onSelectAllTasksFilter={(val) => setViewAllTasks(val)}
      />

      {/* Horizontal Top Navigation Bar with View Scope Indicator and Refresh Button */}
      <TopNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenCreateTask={() => setShowCreateModal(true)}
        viewAllTasks={viewAllTasks}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Full-Width Main Content Viewport */}
      <main className="flex-1 p-4 lg:p-6 w-full max-w-full overflow-y-auto relative z-10">
        {currentTab === 'dashboard' && (
          isManager ? (
            <ManagerDashboard
              onOpenCreateTask={() => setShowCreateModal(true)}
              showCreateModal={showCreateModal}
              setShowCreateModal={setShowCreateModal}
              viewAllTasks={viewAllTasks}
              refreshTrigger={refreshTrigger}
              onTasksLoaded={() => setIsRefreshing(false)}
            />
          ) : (
            <EmployeeDashboard />
          )
        )}

        {currentTab === 'all_tasks' && (
          <ManagerDashboard
            onOpenCreateTask={() => setShowCreateModal(true)}
            showCreateModal={showCreateModal}
            setShowCreateModal={setShowCreateModal}
            viewAllTasks={true}
            refreshTrigger={refreshTrigger}
            onTasksLoaded={() => setIsRefreshing(false)}
          />
        )}

        {currentTab === 'my_tasks' && (
          <EmployeeDashboard />
        )}

        {currentTab === 'completed_tasks' && (
          <EmployeeDashboard filterCompletedOnly={true} />
        )}

        {currentTab === 'employees' && (
          <DirectoryView type="employees" />
        )}

        {currentTab === 'projects' && (
          <DirectoryView type="projects" />
        )}

        {currentTab === 'departments' && (
          <DirectoryView type="departments" />
        )}

        {currentTab === 'recycle_bin' && (
          <RecycleBinView />
        )}
      </main>
    </div>
  );
}
