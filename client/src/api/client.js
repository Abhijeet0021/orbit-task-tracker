const API_BASE = (
  import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? 'https://orbit-task-tracker-api.onrender.com/api' : '/api')
).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status} ${response.statusText}`;
    let errorData = null;
    try {
      errorData = await response.json();
      if (errorData?.error) errorMessage = errorData.error;
      else if (errorData?.message) errorMessage = errorData.message;
    } catch {
      // Ignored
    }
    throw new ApiError(response.status, errorMessage, errorData);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return {};
}

export const api = {
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request('/auth/me'),

  getUsers: () => request('/users'),

  getProjects: (includeArchived = false) =>
    request(`/projects?include_archived=${includeArchived}`),

  getProject: (id) => request(`/projects/${id}`),

  createProject: (data) =>
    request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProject: (id, data) =>
    request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  archiveProject: (id) =>
    request(`/projects/${id}/archive`, { method: 'POST' }),

  restoreProject: (id) =>
    request(`/projects/${id}/restore`, { method: 'POST' }),

  addProjectMember: (projectId, userId) =>
    request(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  removeProjectMember: (projectId, userId) =>
    request(`/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    }),

  getTasks: (params = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.project_id) query.set('project_id', String(params.project_id));
    if (params.status) query.set('status', params.status);
    if (params.assignee_id) query.set('assignee_id', String(params.assignee_id));
    if (params.priority) query.set('priority', params.priority);
    if (params.overdue) query.set('overdue', 'true');
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.sort_order) query.set('sort_order', params.sort_order);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    return request(`/tasks?${query.toString()}`);
  },

  getTask: (id) => request(`/tasks/${id}`),

  createTask: (data) =>
    request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTask: (id, data) =>
    request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTask: (id) =>
    request(`/tasks/${id}`, { method: 'DELETE' }),

  addTaskAssignee: (taskId, userId) =>
    request(`/tasks/${taskId}/assignees`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  removeTaskAssignee: (taskId, userId) =>
    request(`/tasks/${taskId}/assignees/${userId}`, {
      method: 'DELETE',
    }),

  addTaskBlocker: (taskId, blockerTaskId) =>
    request(`/tasks/${taskId}/blockers`, {
      method: 'POST',
      body: JSON.stringify({ blockerTaskId }),
    }),

  removeTaskBlocker: (taskId, blockerId) =>
    request(`/tasks/${taskId}/blockers/${blockerId}`, {
      method: 'DELETE',
    }),

  addTaskComment: (taskId, comment) =>
    request(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }),

  executeBulk: (data) =>
    request('/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getExportCsvUrl: (params = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.project_id) query.set('project_id', String(params.project_id));
    if (params.status) query.set('status', params.status);
    if (params.assignee_id) query.set('assignee_id', String(params.assignee_id));
    if (params.priority) query.set('priority', params.priority);
    if (params.overdue) query.set('overdue', 'true');
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.sort_order) query.set('sort_order', params.sort_order);

    return `${API_BASE}/tasks/export.csv?${query.toString()}`;
  },

  getOverdueAlerts: () => request('/alerts/overdue'),

  dismissAlert: (taskId) =>
    request('/alerts/dismiss', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    }),

  getDashboardStats: () => request('/dashboard/stats'),
};
