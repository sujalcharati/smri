import { create } from 'zustand'
import { chatApi } from '../lib/api'

interface Source {
  documentId: string
  documentTitle: string
  relevantChunk: string
  confidence: number
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: Source[]
  timestamp: string
}

interface ChatPreview {
  id: string
  title: string
  preview: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

interface Chat {
  _id: string
  title: string
  messages: Message[]
  context: {
    documentIds: string[]
    searchQuery?: string
  }
  createdAt: string
  updatedAt: string
}

interface ChatState {
  chats: ChatPreview[]
  currentChat: Chat | null
  isLoading: boolean
  isSending: boolean
  error: string | null

  // Actions
  fetchChats: (workspaceId: string) => Promise<void>
  createChat: (workspaceId: string) => Promise<string>
  loadChat: (chatId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  deleteChat: (chatId: string) => Promise<void>
  clearCurrentChat: () => void
  clearError: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChat: null,
  isLoading: false,
  isSending: false,
  error: null,

  fetchChats: async (workspaceId) => {
    set({ isLoading: true })
    try {
      const { data } = await chatApi.list({ workspaceId, limit: 50 })
      set({ chats: data.chats, isLoading: false })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({ error: err.response?.data?.error || 'Failed to fetch chats', isLoading: false })
    }
  },

  createChat: async (workspaceId) => {
    try {
      const { data } = await chatApi.create(workspaceId)
      const newChat: ChatPreview = {
        id: data.id,
        title: data.title,
        preview: '',
        messageCount: 0,
        createdAt: data.createdAt,
        updatedAt: data.createdAt,
      }
      set((state) => ({ chats: [newChat, ...state.chats] }))
      return data.id
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({ error: err.response?.data?.error || 'Failed to create chat' })
      throw error
    }
  },

  loadChat: async (chatId) => {
    set({ isLoading: true })
    try {
      const { data } = await chatApi.get(chatId)
      set({ currentChat: data, isLoading: false })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({ error: err.response?.data?.error || 'Failed to load chat', isLoading: false })
    }
  },

  sendMessage: async (content) => {
    const { currentChat } = get()
    if (!currentChat) return

    // Optimistically add user message
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }

    set((state) => ({
      currentChat: state.currentChat
        ? { ...state.currentChat, messages: [...state.currentChat.messages, userMessage] }
        : null,
      isSending: true,
    }))

    try {
      const { data } = await chatApi.sendMessage(currentChat._id, content)

      set((state) => ({
        currentChat: state.currentChat
          ? {
              ...state.currentChat,
              title: data.chatTitle,
              messages: [...state.currentChat.messages, data.message],
            }
          : null,
        isSending: false,
        // Update chat preview in list
        chats: state.chats.map((chat) =>
          chat.id === currentChat._id
            ? { ...chat, title: data.chatTitle, preview: content, updatedAt: new Date().toISOString() }
            : chat
        ),
      }))
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({ error: err.response?.data?.error || 'Failed to send message', isSending: false })
    }
  },

  deleteChat: async (chatId) => {
    try {
      await chatApi.delete(chatId)
      set((state) => ({
        chats: state.chats.filter((chat) => chat.id !== chatId),
        currentChat: state.currentChat?._id === chatId ? null : state.currentChat,
      }))
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      set({ error: err.response?.data?.error || 'Failed to delete chat' })
    }
  },

  clearCurrentChat: () => {
    set({ currentChat: null })
  },

  clearError: () => {
    set({ error: null })
  },
}))
