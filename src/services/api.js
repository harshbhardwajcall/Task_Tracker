const API_BASE = '/api';

export function getActiveUserId() {
  return localStorage.getItem('active_user_id') || '';
}

export function setActiveUserId(userId) {
  if (userId) {
    localStorage.setItem('active_user_id', String(userId));
  } else {
    localStorage.removeItem('active_user_id');
  }
}

export function getAuthToken() {
  return localStorage.getItem('auth_token') || '';
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function clearAuth() {
  localStorage.removeItem('active_user_id');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('active_user');
}

async function request(endpoint, options = {}) {
  const activeUserId = getActiveUserId();
  const token = getAuthToken();
  const headers = { ...options.headers };

  if (activeUserId) {
    headers['X-User-Id'] = activeUserId;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If body is not FormData, add JSON header
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  // Authentication & Profiles
  login: (credentials) => request('/auth/login', {
    method: 'POST',
    body: credentials
  }),
  getMe: () => request('/auth/me'),
  getUsers: () => request('/auth/users'),
  getUserProfile: (id) => request(`/auth/user/${id}`),

  // Admin User & Credential Management
  createAdminUser: (data) => request('/auth/admin/users', {
    method: 'POST',
    body: data
  }),
  resetUserPassword: (id, password) => request(`/auth/admin/users/${id}/password`, {
    method: 'PUT',
    body: { password }
  }),
  updateAdminUser: (id, data) => request(`/auth/admin/users/${id}`, {
    method: 'PUT',
    body: data
  }),
  deleteAdminUser: (id) => request(`/auth/admin/users/${id}`, {
    method: 'DELETE'
  }),

  // Admin System Stats
  getAdminStats: () => request('/admin/stats'),

  // Tasks
  getTasks: (params = {}) => {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    return request(`/tasks?${query.toString()}`);
  },

  getTaskDetails: (id) => request(`/tasks/${id}`),

  createTask: (formData) => request('/tasks', {
    method: 'POST',
    body: formData
  }),

  updateTask: (id, updates) => request(`/tasks/${id}`, {
    method: 'PUT',
    body: updates
  }),

  updateTaskStatus: (id, status) => request(`/tasks/${id}/status`, {
    method: 'PATCH',
    body: { status }
  }),

  addComment: (id, payload) => {
    const isFormData = payload instanceof FormData;
    return request(`/tasks/${id}/comments`, {
      method: 'POST',
      body: isFormData ? payload : (typeof payload === 'string' ? { comment: payload } : payload)
    });
  },
  deleteComment: (taskId, commentId) => request(`/tasks/${taskId}/comments/${commentId}`, {
    method: 'DELETE'
  }),

  uploadAttachment: (id, formData) => request(`/tasks/${id}/attachments`, {
    method: 'POST',
    body: formData
  }),
  deleteAttachment: (taskId, attachmentId) => request(`/tasks/${taskId}/attachments/${attachmentId}`, {
    method: 'DELETE'
  }),

  getTaskHistory: (id) => request(`/tasks/${id}/history`),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  // Recycle Bin
  getRecycleBin: () => request('/tasks/recycle-bin/list'),
  restoreTask: (id) => request(`/tasks/${id}/restore`, { method: 'POST' }),
  deleteTaskPermanently: (id) => request(`/tasks/${id}/permanent`, { method: 'DELETE' }),
  emptyRecycleBin: () => request('/tasks/recycle-bin/empty', { method: 'DELETE' }),

  // Employees & Metadata
  getEmployees: () => request('/employees'),
  getEmployeeAnalytics: (id, params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    const qs = searchParams.toString();
    return request(`/employees/${id}/analytics${qs ? `?${qs}` : ''}`);
  },
  createEmployee: (employeeData) => request('/employees', {
    method: 'POST',
    body: employeeData
  }),
  deleteEmployee: (id) => request(`/employees/${id}`, {
    method: 'DELETE'
  }),
  getDepartments: () => request('/departments'),
  createDepartment: (data) => request('/departments', {
    method: 'POST',
    body: data
  }),
  deleteDepartment: (id) => request(`/departments/${id}`, {
    method: 'DELETE'
  }),
  updateDepartment: (id, data) => request(`/departments/${id}`, {
    method: 'PUT',
    body: data
  }),
  getJobTitles: () => request('/job-titles'),
  createJobTitle: (data) => request('/job-titles', {
    method: 'POST',
    body: data
  }),
  deleteJobTitle: (id) => request(`/job-titles/${id}`, {
    method: 'DELETE'
  }),
  getProjects: () => request('/projects'),
  createProject: (data) => request('/projects', {
    method: 'POST',
    body: data
  }),
  updateProject: (id, data) => request(`/projects/${id}`, {
    method: 'PUT',
    body: data
  }),
  deleteProject: (id) => request(`/projects/${id}`, {
    method: 'DELETE'
  }),
  getReports: (params = {}) => {
    const query = new URLSearchParams();
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        query.append(k, params[k]);
      }
    });
    return request(`/reports?${query.toString()}`);
  },
  removeEmployeeFromProject: (employeeId, projectId) => request(`/reports/employees/${employeeId}/projects/${projectId}`, { method: 'DELETE' }),
  restoreEmployeeToProject: (employeeId, projectId) => request(`/reports/employees/${employeeId}/projects/${projectId}/restore`, { method: 'POST' }),
  deletePreviousMember: (recordId) => request(`/reports/previous-members/${recordId}`, { method: 'DELETE' }),

  // Teams & Allocation (Manager Portal)
  getTeams: (params = {}) => {
    const query = new URLSearchParams();
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        query.append(k, params[k]);
      }
    });
    return request(`/teams${query.toString() ? `?${query.toString()}` : ''}`);
  },
  getTeam: (id) => request(`/teams/${id}`),
  getMyTeamAllocation: () => request('/teams/my-allocation'),
  createTeam: (data) => request('/teams', { method: 'POST', body: data }),
  updateTeam: (id, data) => request(`/teams/${id}`, { method: 'PUT', body: data }),
  deleteTeam: (id) => request(`/teams/${id}`, { method: 'DELETE' }),
  addTeamMember: (id, data) => request(`/teams/${id}/members`, { method: 'POST', body: data }),
  removeTeamMember: (id, userId) => request(`/teams/${id}/members/${userId}`, { method: 'DELETE' }),
  allocateTeamProject: (id, data) => request(`/teams/${id}/projects`, { method: 'POST', body: data }),
  deallocateTeamProject: (id, projectId) => request(`/teams/${id}/projects/${projectId}`, { method: 'DELETE' }),

  // Team / Squad Sharing & Co-Management
  getManageableTeams: () => request('/teams/manageable-teams'),
  getTeamShares: (teamId) => request(`/teams/team-shares/${teamId}`),
  shareTeam: (teamId, data) => request(`/teams/team-shares/${teamId}`, { method: 'POST', body: data }),
  revokeTeamShare: (teamId, userId) => request(`/teams/team-shares/${teamId}/${userId}`, { method: 'DELETE' }),

  // Project Co-Management & Sharing
  getManageableProjects: () => request('/teams/manageable-projects'),
  getEligibleManagers: () => request('/teams/managers'),
  getProjectShares: (projectId) => request(`/teams/projects/${projectId}/shares`),
  shareProject: (projectId, data) => request(`/teams/projects/${projectId}/share`, { method: 'POST', body: data }),
  revokeProjectShare: (projectId, userId) => request(`/teams/projects/${projectId}/share/${userId}`, { method: 'DELETE' }),

  // Personal Self-Logs (Tasks, Notes, Calendar)
  getSelfLogs: (params = {}) => {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    return request(`/self-logs${query.toString() ? `?${query.toString()}` : ''}`);
  },
  createSelfLog: (data) => request('/self-logs', { method: 'POST', body: data }),
  updateSelfLog: (id, data) => request(`/self-logs/${id}`, { method: 'PUT', body: data }),
  deleteSelfLog: (id) => request(`/self-logs/${id}`, { method: 'DELETE' }),

  // System Audit Logs (Change History)
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    return request(`/audit-logs?${query.toString()}`);
  },

  // Manager Control & View Permissions
  getManagersWithPermissions: () => request('/manager-control/managers'),
  getManagerPermissions: (userId) => request(`/manager-control/${userId}`),
  updateManagerPermissions: (userId, data) => request(`/manager-control/${userId}`, { method: 'PUT', body: data }),
  applyManagerPreset: (userId, preset) => request('/manager-control/apply-preset', { method: 'POST', body: { user_id: userId, preset } }),
  getMyPermissions: () => request('/manager-control/my-permissions'),

  // User Profile, Avatar & Password
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: data }),
  uploadAvatar: (formData) => request('/auth/avatar', { method: 'POST', body: formData }),
  removeAvatar: () => request('/auth/avatar', { method: 'DELETE' }),
  changePassword: (data) => request('/auth/change-password', { method: 'PUT', body: data }),

  // User In-App Notifications
  getNotifications: (params = {}) => {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    return request(`/notifications${query.toString() ? `?${query.toString()}` : ''}`);
  },
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH' }),
  deleteNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
  clearAllNotifications: () => request('/notifications/clear-all', { method: 'DELETE' })
};


