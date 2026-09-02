const API_BASE = '/api';

export function getActiveUserId() {
  return localStorage.getItem('active_user_id') || '10';
}

export function setActiveUserId(userId) {
  if (userId) {
    localStorage.setItem('active_user_id', String(userId));
  }
}

async function request(endpoint, options = {}) {
  const activeUserId = getActiveUserId();
  const headers = { ...options.headers };

  headers['X-User-Id'] = activeUserId;

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
  // Profiles
  getUsers: () => request('/auth/users'),
  getUserProfile: (id) => request(`/auth/user/${id}`),
  createManager: (data) => request('/managers', {
    method: 'POST',
    body: data
  }),
  deleteManager: (id) => request(`/managers/${id}`, {
    method: 'DELETE'
  }),

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

  addComment: (id, comment) => request(`/tasks/${id}/comments`, {
    method: 'POST',
    body: { comment }
  }),

  uploadAttachment: (id, formData) => request(`/tasks/${id}/attachments`, {
    method: 'POST',
    body: formData
  }),

  getTaskHistory: (id) => request(`/tasks/${id}/history`),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  // Recycle Bin
  getRecycleBin: () => request('/tasks/recycle-bin/list'),
  restoreTask: (id) => request(`/tasks/${id}/restore`, { method: 'POST' }),
  deleteTaskPermanently: (id) => request(`/tasks/${id}/permanent`, { method: 'DELETE' }),
  emptyRecycleBin: () => request('/tasks/recycle-bin/empty', { method: 'DELETE' }),

  // Metadata
  getEmployees: () => request('/employees'),
  createEmployee: (data) => request('/employees', {
    method: 'POST',
    body: data
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
  getProjects: () => request('/projects'),
  createProject: (data) => request('/projects', {
    method: 'POST',
    body: data
  }),
  deleteProject: (id) => request(`/projects/${id}`, {
    method: 'DELETE'
  }),
  getReports: (params = {}) => {
    const query = new URLSearchParams(params);
    return request(`/reports?${query.toString()}`);
  }
};
