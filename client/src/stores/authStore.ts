import { create } from 'zustand'
import { authApi } from '../lib/api'

interface User {
  id: string
  email: string
  name: string
  avatar?: string
  hasGoogleAuth?: boolean
  hasDriveAccess?: boolean
}

interface Workspace {
  id: string
  name: string
}

interface AuthState {
  user: User | null
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  setToken: (token: string) => void
  checkAuth: () => Promise<void>
  logout: () => void
  setCurrentWorkspace: (workspace: Workspace) => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  workspaces: [],
  currentWorkspace: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await authApi.login({ email, password })
      localStorage.setItem('token', data.token)
      set({
        user: data.user,
        workspaces: data.workspaces,
        currentWorkspace: data.workspaces[0] || null,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({
        error: err.response?.data?.error || 'Login failed',
        isLoading: false,
      })
      throw error
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await authApi.register({ email, password, name })
      localStorage.setItem('token', data.token)
      set({
        user: data.user,
        workspaces: [data.workspace],
        currentWorkspace: data.workspace,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({
        error: err.response?.data?.error || 'Registration failed',
        isLoading: false,
      })
      throw error
    }
  },

  loginWithGoogle: async () => {
    try {
      const { data } = await authApi.getGoogleAuthUrl()
      window.location.href = data.authUrl
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({ error: err.response?.data?.error || 'Google login failed' })
    }
  },

  setToken: (token) => {
    localStorage.setItem('token', token)
    set({ token })
    get().checkAuth()
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }

    try {
      const { data } = await authApi.getMe()
      set({
        user: data.user,
        workspaces: data.workspaces,
        currentWorkspace: data.workspaces[0] || null,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch {
      localStorage.removeItem('token')
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    set({
      user: null,
      workspaces: [],
      currentWorkspace: null,
      token: null,
      isAuthenticated: false,
    })
  },

  setCurrentWorkspace: (workspace) => {
    set({ currentWorkspace: workspace })
  },

  clearError: () => {
    set({ error: null })
  },
}))
