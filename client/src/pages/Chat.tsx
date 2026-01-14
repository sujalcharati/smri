import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import {
  Send,
  Plus,
  Trash2,
  FileText,
  Sparkles,
  MessageSquare,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatRelativeTime } from '@/lib/utils'

export default function Chat() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const { currentWorkspace } = useAuthStore()
  const {
    chats,
    currentChat,
    isLoading,
    isSending,
    fetchChats,
    createChat,
    loadChat,
    sendMessage,
    deleteChat,
    clearCurrentChat,
  } = useChatStore()

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentWorkspace) {
      fetchChats(currentWorkspace.id)
    }
  }, [currentWorkspace, fetchChats])

  useEffect(() => {
    if (chatId) {
      loadChat(chatId)
    } else {
      clearCurrentChat()
    }
  }, [chatId, loadChat, clearCurrentChat])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentChat?.messages])

  const handleNewChat = async () => {
    if (!currentWorkspace) return
    const newChatId = await createChat(currentWorkspace.id)
    navigate(`/app/chat/${newChatId}`)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isSending) return

    if (!currentChat && currentWorkspace) {
      const newChatId = await createChat(currentWorkspace.id)
      navigate(`/app/chat/${newChatId}`)
      // Wait for chat to load
      setTimeout(async () => {
        await sendMessage(input.trim())
        setInput('')
      }, 100)
    } else {
      await sendMessage(input.trim())
      setInput('')
    }
  }

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteChat(id)
    if (chatId === id) {
      navigate('/app/chat')
    }
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-6">
      {/* Sidebar - Chat History */}
      <div className="hidden md:flex w-72 flex-col">
        <Button onClick={handleNewChat} className="mb-4 w-full">
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>

        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-2">
            {chats.map((chat) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'group flex items-center justify-between rounded-lg p-3 cursor-pointer transition-all',
                  chatId === chat.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                )}
                onClick={() => navigate(`/app/chat/${chat.id}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(chat.updatedAt)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 h-8 w-8"
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col border-0 shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold">
                {currentChat?.title || 'New Conversation'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Powered by Google Gemini
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="md:hidden" onClick={handleNewChat}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-6 py-4">
          {!currentChat?.messages?.length ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">How can I help you today?</h3>
              <p className="text-muted-foreground max-w-md">
                Ask me anything about your documents and knowledge base. I'll search through
                your data and provide accurate, sourced answers.
              </p>
              <div className="flex flex-wrap gap-2 mt-6 justify-center">
                {[
                  'Summarize recent documents',
                  'What are our main projects?',
                  'Find information about...',
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => setInput(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {currentChat.messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={cn(
                      'flex gap-4',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role !== 'user' && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-3',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>

                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <p className="text-xs font-medium mb-2 opacity-70">Sources:</p>
                          <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1 text-xs bg-background/50 rounded px-2 py-1"
                              >
                                <FileText className="h-3 w-3" />
                                <span className="truncate max-w-[150px]">
                                  {source.documentTitle}
                                </span>
                                <ExternalLink className="h-3 w-3 opacity-50" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              {isSending && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <div className="typing-indicator flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full" />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full" />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full" />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <form onSubmit={handleSend} className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your documents..."
              disabled={isSending || isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={!input.trim() || isSending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
