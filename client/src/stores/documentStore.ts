import { create } from 'zustand'
import { documentsApi, driveApi } from '../lib/api'

interface Document {
  _id: string
  title: string
  type: string
  source: 'upload' | 'google_drive' | 'slack'
  sourceId?: string
  summary?: string
  tags: string[]
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed'
  size: number
  createdAt: string
  updatedAt: string
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: string
  modifiedTime: string
  webViewLink?: string
}

interface DocumentState {
  documents: Document[]
  selectedDocument: Document | null
  driveFiles: DriveFile[]
  driveConnected: boolean
  isLoading: boolean
  isUploading: boolean
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  error: string | null

  // Actions
  fetchDocuments: (workspaceId: string, params?: { page?: number; status?: string; type?: string; search?: string }) => Promise<void>
  uploadDocument: (workspaceId: string, file: File) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  updateTags: (id: string, tags: string[]) => Promise<void>
  selectDocument: (doc: Document | null) => void
  checkDriveStatus: () => Promise<void>
  fetchDriveFiles: (folderId?: string) => Promise<void>
  importFromDrive: (fileId: string, workspaceId: string) => Promise<void>
  importBatchFromDrive: (fileIds: string[], workspaceId: string) => Promise<void>
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  selectedDocument: null,
  driveFiles: [],
  driveConnected: false,
  isLoading: false,
  isUploading: false,
  pagination: { page: 1, limit: 20, total: 0, pages: 0 },
  error: null,

  fetchDocuments: async (workspaceId, params = {}) => {
    set({ isLoading: true })
    try {
      const { data } = await documentsApi.list({
        workspaceId,
        page: params.page || 1,
        limit: 20,
        ...params,
      })
      set({
        documents: data.documents,
        pagination: data.pagination,
        isLoading: false,
      })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({ error: err.response?.data?.error || 'Failed to fetch documents', isLoading: false })
    }
  },

  uploadDocument: async (workspaceId, file) => {
    set({ isUploading: true })
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('workspaceId', workspaceId)

      const { data } = await documentsApi.upload(formData)

      // Add to list with processing status
      const newDoc: Document = {
        _id: data.id,
        title: data.title,
        type: data.type,
        source: 'upload',
        tags: [],
        processingStatus: 'processing',
        size: file.size,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      set((state) => ({
        documents: [newDoc, ...state.documents],
        isUploading: false,
      }))
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({ error: err.response?.data?.error || 'Failed to upload document', isUploading: false })
      throw error
    }
  },

  deleteDocument: async (id) => {
    try {
      await documentsApi.delete(id)
      set((state) => ({
        documents: state.documents.filter((doc) => doc._id !== id),
        selectedDocument: state.selectedDocument?._id === id ? null : state.selectedDocument,
      }))
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({ error: err.response?.data?.error || 'Failed to delete document' })
    }
  },

  updateTags: async (id, tags) => {
    try {
      await documentsApi.updateTags(id, tags)
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc._id === id ? { ...doc, tags } : doc
        ),
      }))
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({ error: err.response?.data?.error || 'Failed to update tags' })
    }
  },

  selectDocument: (doc) => {
    set({ selectedDocument: doc })
  },

  checkDriveStatus: async () => {
    try {
      const { data } = await driveApi.status()
      set({ driveConnected: data.connected })
    } catch {
      set({ driveConnected: false })
    }
  },

  fetchDriveFiles: async (folderId) => {
    set({ isLoading: true })
    try {
      const { data } = await driveApi.listFiles(folderId)
      set({ driveFiles: data.files, isLoading: false })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({ error: err.response?.data?.error || 'Failed to fetch drive files', isLoading: false })
    }
  },

  importFromDrive: async (fileId, workspaceId) => {
    try {
      const { data } = await driveApi.importFile(fileId, workspaceId)

      const newDoc: Document = {
        _id: data.id,
        title: data.title,
        type: data.type,
        source: 'google_drive',
        tags: [],
        processingStatus: 'processing',
        size: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      set((state) => ({
        documents: [newDoc, ...state.documents],
      }))
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({ error: err.response?.data?.error || 'Failed to import from Drive' })
      throw error
    }
  },

  importBatchFromDrive: async (fileIds, workspaceId) => {
    try {
      const { data } = await driveApi.importBatch(fileIds, workspaceId)

      const newDocs = data.results
        .filter((r: { status: string }) => r.status === 'imported')
        .map((r: { documentId: string; fileId: string }) => {
          const file = get().driveFiles.find((f) => f.id === r.fileId)
          return {
            _id: r.documentId,
            title: file?.name || 'Imported Document',
            type: 'gdoc',
            source: 'google_drive' as const,
            tags: [],
            processingStatus: 'processing' as const,
            size: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        })

      set((state) => ({
        documents: [...newDocs, ...state.documents],
      }))

      return data.results
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({ error: err.response?.data?.error || 'Failed to import from Drive' })
      throw error
    }
  },
}))
