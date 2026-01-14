import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FileText,
  MessageSquare,
  Network,
  Workflow,
  TrendingUp,
  Clock,
  Search,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/authStore'
import { knowledgeApi, chatApi } from '@/lib/api'

interface Insights {
  totalDocuments: number
  documentsByType: Record<string, number>
  documentsByStatus: Record<string, number>
  recentDocuments: { _id: string; title: string; createdAt: string }[]
  topEntities: { name: string; type: string; mentions: number }[]
  workspace: { name: string; memberCount: number; totalSize: number }
}

export default function Dashboard() {
  const { user, currentWorkspace } = useAuthStore()
  const [insights, setInsights] = useState<Insights | null>(null)
  const [quickQuestion, setQuickQuestion] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [quickAnswer, setQuickAnswer] = useState<string | null>(null)

  useEffect(() => {
    if (currentWorkspace) {
      knowledgeApi.getInsights(currentWorkspace.id).then(({ data }) => {
        setInsights(data)
      }).catch(console.error)
    }
  }, [currentWorkspace])

  const handleQuickAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickQuestion.trim() || !currentWorkspace) return

    setIsAsking(true)
    setQuickAnswer(null)

    try {
      const { data } = await chatApi.quickAsk(currentWorkspace.id, quickQuestion)
      setQuickAnswer(data.answer)
    } catch (error) {
      console.error('Quick ask error:', error)
    } finally {
      setIsAsking(false)
    }
  }

  const stats = [
    {
      title: 'Total Documents',
      value: insights?.totalDocuments || 0,
      icon: FileText,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Knowledge Entities',
      value: insights?.topEntities?.length || 0,
      icon: Network,
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Team Members',
      value: insights?.workspace?.memberCount || 1,
      icon: TrendingUp,
      color: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Processed',
      value: insights?.documentsByStatus?.completed || 0,
      icon: Clock,
      color: 'from-orange-500 to-amber-500',
    },
  ]

  const quickActions = [
    { label: 'New Chat', icon: MessageSquare, path: '/app/chat', color: 'bg-blue-500' },
    { label: 'Upload Docs', icon: FileText, path: '/app/documents', color: 'bg-green-500' },
    { label: 'View Graph', icon: Network, path: '/app/knowledge', color: 'bg-purple-500' },
    { label: 'Workflows', icon: Workflow, path: '/app/workflows', color: 'bg-orange-500' },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening in {currentWorkspace?.name || 'your workspace'}
          </p>
        </div>
        <Button asChild>
          <Link to="/app/chat">
            <Sparkles className="mr-2 h-4 w-4" />
            Start AI Chat
          </Link>
        </Button>
      </motion.div>

      {/* Quick Ask */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Quick Ask</h3>
                <p className="text-sm text-white/80">Ask anything about your knowledge base</p>
              </div>
            </div>
            <form onSubmit={handleQuickAsk} className="flex gap-2">
              <Input
                placeholder="What would you like to know?"
                value={quickQuestion}
                onChange={(e) => setQuickQuestion(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus-visible:ring-white/50"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={isAsking || !quickQuestion.trim()}
              >
                {isAsking ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </Button>
            </form>
            {quickAnswer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 p-4 rounded-lg bg-white/10"
              >
                <p className="text-sm">{quickAnswer}</p>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${stat.color}`}
                  >
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.path}>
              <Card className="border-0 shadow-md hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
                <CardContent className="pt-6 text-center">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.color} mx-auto mb-3`}
                  >
                    <action.icon className="h-6 w-6 text-white" />
                  </div>
                  <p className="font-medium">{action.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Recent Activity & Top Entities */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Recent Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {insights?.recentDocuments?.length ? (
                <div className="space-y-3">
                  {insights.recentDocuments.map((doc) => (
                    <div
                      key={doc._id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No documents yet. Upload your first document to get started.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Top Entities</CardTitle>
            </CardHeader>
            <CardContent>
              {insights?.topEntities?.length ? (
                <div className="space-y-3">
                  {insights.topEntities.slice(0, 5).map((entity) => (
                    <div
                      key={entity.name}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            entity.type === 'person'
                              ? 'bg-blue-500'
                              : entity.type === 'organization'
                              ? 'bg-green-500'
                              : entity.type === 'technology'
                              ? 'bg-purple-500'
                              : 'bg-orange-500'
                          }`}
                        />
                        <span className="text-sm font-medium">{entity.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {entity.mentions} mentions
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Entities will appear here after processing documents.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
