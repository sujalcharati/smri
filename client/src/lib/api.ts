import axios from 'axios'

export const API_BASE_URL = import.meta.env.PROD
  ? 'https://server-production-4738.up.railway.app/api'
  : '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/auth'
    }
    return Promise.reject(error)
  }
)

export default api

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getGoogleAuthUrl: () => api.get('/auth/google'),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

// Documents API
export const documentsApi = {
  upload: (formData: FormData) =>
    api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list: (params: { workspaceId: string; page?: number; limit?: number; status?: string; type?: string; search?: string }) =>
    api.get('/documents', { params }),
  get: (id: string) => api.get(`/documents/${id}`),
  delete: (id: string) => api.delete(`/documents/${id}`),
  updateTags: (id: string, tags: string[]) =>
    api.patch(`/documents/${id}/tags`, { tags }),
}

// Chat API
export const chatApi = {
  create: (workspaceId: string, title?: string) =>
    api.post('/chat', { workspaceId, title }),
  list: (params: { workspaceId: string; page?: number; limit?: number }) =>
    api.get('/chat', { params }),
  get: (id: string) => api.get(`/chat/${id}`),
  sendMessage: (chatId: string, content: string, searchDocuments?: boolean) =>
    api.post(`/chat/${chatId}/messages`, { content, searchDocuments }),
  quickAsk: (workspaceId: string, question: string) =>
    api.post('/chat/ask', { workspaceId, question }),
  delete: (id: string) => api.delete(`/chat/${id}`),
}

// Drive API
export const driveApi = {
  status: () => api.get('/drive/status'),
  listFiles: (folderId?: string, pageToken?: string) =>
    api.get('/drive/files', { params: { folderId, pageToken } }),
  listFolders: (parentId?: string) =>
    api.get('/drive/folders', { params: { parentId } }),
  importFile: (fileId: string, workspaceId: string) =>
    api.post('/drive/import', { fileId, workspaceId }),
  importBatch: (fileIds: string[], workspaceId: string) =>
    api.post('/drive/import-batch', { fileIds, workspaceId }),
  sync: (documentId: string) =>
    api.post(`/drive/sync/${documentId}`),
}

// Knowledge API
export const knowledgeApi = {
  getGraph: (workspaceId: string) =>
    api.get('/knowledge/graph', { params: { workspaceId } }),
  getEntities: (params: { workspaceId: string; type?: string; search?: string; limit?: number }) =>
    api.get('/knowledge/entities', { params }),
  getRelated: (documentId: string) =>
    api.get(`/knowledge/related/${documentId}`),
  analyzeRelation: (documentId1: string, documentId2: string) =>
    api.post('/knowledge/analyze-relation', { documentId1, documentId2 }),
  getInsights: (workspaceId: string) =>
    api.get('/knowledge/insights', { params: { workspaceId } }),
}

// Workflows API
export const workflowsApi = {
  create: (data: { workspaceId: string; name: string; description?: string; trigger: object; steps?: object[] }) =>
    api.post('/workflows', data),
  list: (params: { workspaceId: string; status?: string }) =>
    api.get('/workflows', { params }),
  get: (id: string) => api.get(`/workflows/${id}`),
  update: (id: string, data: object) => api.put(`/workflows/${id}`, data),
  run: (id: string, input?: object) =>
    api.post(`/workflows/${id}/run`, { input }),
  delete: (id: string) => api.delete(`/workflows/${id}`),
  getTemplates: () => api.get('/workflows/templates/list'),
}
