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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
    clearTimeout(timeoutId);

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
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out. Please check your connection or try again.');
    }
    throw err;
  }
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

  // The export endpoint is authenticated, so it cannot be opened in a new tab -
  // a top-level navigation carries no Authorization header. Fetch it with the
  // bearer token and hand the browser a blob instead.
  downloadTasksCsv: async (params = {}) => {
    const token = localStorage.getItem('token');
    const response = await fetch(api.getExportCsvUrl(params), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      let message = `HTTP ${response.status} ${response.statusText}`;
      try {
        const data = await response.json();
        if (data?.error) message = data.error;
      } catch {
        // Response was not JSON; keep the status line.
      }
      throw new ApiError(response.status, message);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `orbit-tasks-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },

  getActivityFeed: (params = {}) => {
    const query = new URLSearchParams();
    if (params.project_id) query.set('project_id', String(params.project_id));
    if (params.user_id) query.set('user_id', String(params.user_id));
    if (params.activity_type) query.set('activity_type', params.activity_type);
    if (params.limit) query.set('limit', String(params.limit));

    return request(`/activities?${query.toString()}`);
  },

  getOverdueAlerts: () => request('/alerts/overdue'),

  dismissAlert: (taskId) =>
    request('/alerts/dismiss', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    }),

  getDashboardStats: () => request('/dashboard/stats'),
};
