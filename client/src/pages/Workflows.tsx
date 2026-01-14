import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Workflow,
  Plus,
  Play,
  Pause,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  Search,
  FileText,
  Bell,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/authStore'
import { workflowsApi } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { cn, formatRelativeTime } from '@/lib/utils'

interface WorkflowStep {
  id: string
  name: string
  type: string
  status: string
  output?: unknown
}

interface WorkflowData {
  _id: string
  name: string
  description?: string
  trigger: { type: string; config: Record<string, unknown> }
  steps: WorkflowStep[]
  status: string
  lastRunAt?: string
  runCount: number
  createdAt: string
  updatedAt: string
}

interface Template {
  id: string
  name: string
  description: string
  trigger: { type: string; config: Record<string, unknown> }
  steps: { type: string; name: string; config: Record<string, unknown> }[]
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  active: 'bg-green-500',
  paused: 'bg-yellow-500',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
}

const statusIcons: Record<string, React.ReactNode> = {
  draft: <Clock className="h-4 w-4" />,
  active: <CheckCircle className="h-4 w-4" />,
  paused: <Pause className="h-4 w-4" />,
  running: <Loader2 className="h-4 w-4 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
}

const stepTypeIcons: Record<string, React.ReactNode> = {
  search: <Search className="h-4 w-4" />,
  summarize: <FileText className="h-4 w-4" />,
  extract: <Zap className="h-4 w-4" />,
  analyze: <Sparkles className="h-4 w-4" />,
  notify: <Bell className="h-4 w-4" />,
}

export default function Workflows() {
  const { currentWorkspace } = useAuthStore()
  const { toast } = useToast()

  const [workflows, setWorkflows] = useState<WorkflowData[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [newWorkflowName, setNewWorkflowName] = useState('')
  const [runningWorkflow, setRunningWorkflow] = useState<string | null>(null)

  useEffect(() => {
    if (currentWorkspace) {
      fetchWorkflows()
      fetchTemplates()
    }
  }, [currentWorkspace])

  const fetchWorkflows = async () => {
    if (!currentWorkspace) return

    setIsLoading(true)
    try {
      const { data } = await workflowsApi.list({ workspaceId: currentWorkspace.id })
      setWorkflows(data.workflows)
    } catch (error) {
      console.error('Failed to fetch workflows:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const { data } = await workflowsApi.getTemplates()
      setTemplates(data.templates)
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    }
  }

  const handleCreate = async () => {
    if (!currentWorkspace || !selectedTemplate || !newWorkflowName) return

    try {
      await workflowsApi.create({
        workspaceId: currentWorkspace.id,
        name: newWorkflowName,
        description: selectedTemplate.description,
        trigger: selectedTemplate.trigger,
        steps: selectedTemplate.steps,
      })

      toast({
        title: 'Workflow created',
        description: `${newWorkflowName} has been created`,
      })

      setShowCreateModal(false)
      setSelectedTemplate(null)
      setNewWorkflowName('')
      fetchWorkflows()
    } catch (error) {
      toast({
        title: 'Creation failed',
        description: 'Could not create workflow',
        variant: 'destructive',
      })
    }
  }

  const handleRun = async (workflow: WorkflowData) => {
    setRunningWorkflow(workflow._id)

    try {
      const { data } = await workflowsApi.run(workflow._id)

      toast({
        title: data.status === 'completed' ? 'Workflow completed' : 'Workflow failed',
        description:
          data.status === 'completed'
            ? `${workflow.name} ran successfully`
            : `${workflow.name} failed: ${data.error}`,
        variant: data.status === 'completed' ? 'default' : 'destructive',
      })

      fetchWorkflows()
    } catch (error) {
      toast({
        title: 'Run failed',
        description: 'Could not run workflow',
        variant: 'destructive',
      })
    } finally {
      setRunningWorkflow(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return

    try {
      await workflowsApi.delete(id)
      toast({
        title: 'Workflow deleted',
        description: `${name} has been removed`,
      })
      fetchWorkflows()
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Could not delete workflow',
        variant: 'destructive',
      })
    }
  }

  const handleToggleStatus = async (workflow: WorkflowData) => {
    const newStatus = workflow.status === 'active' ? 'paused' : 'active'

    try {
      await workflowsApi.update(workflow._id, { status: newStatus })
      fetchWorkflows()
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'Could not update workflow status',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Workflows</h1>
          <p className="text-muted-foreground">
            Automate knowledge tasks with AI-powered workflows
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Workflow
        </Button>
      </div>

      {/* Workflows Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-md animate-pulse">
              <CardContent className="pt-6">
                <div className="h-10 w-10 bg-muted rounded-lg mb-4" />
                <div className="h-4 w-3/4 bg-muted rounded mb-2" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first workflow to automate knowledge tasks
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow, index) => (
            <motion.div
              key={workflow._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="border-0 shadow-md hover:shadow-lg transition-all group">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                      <Workflow className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded-full text-xs text-white',
                          statusColors[workflow.status]
                        )}
                      >
                        {statusIcons[workflow.status]}
                        <span className="capitalize">{workflow.status}</span>
                      </div>
                    </div>
                  </div>

                  <h3 className="font-medium mb-1">{workflow.name}</h3>
                  {workflow.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {workflow.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <span>{workflow.steps?.length || 0} steps</span>
                    <span>{workflow.runCount} runs</span>
                    {workflow.lastRunAt && (
                      <span>Last: {formatRelativeTime(workflow.lastRunAt)}</span>
                    )}
                  </div>

                  {/* Steps preview */}
                  <div className="flex items-center gap-1 mb-4">
                    {workflow.steps?.slice(0, 4).map((step, i) => (
                      <div
                        key={step.id}
                        className="flex h-6 w-6 items-center justify-center rounded bg-muted"
                        title={step.name}
                      >
                        {stepTypeIcons[step.type] || <Zap className="h-3 w-3" />}
                      </div>
                    ))}
                    {workflow.steps?.length > 4 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        +{workflow.steps.length - 4}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleRun(workflow)}
                      disabled={runningWorkflow === workflow._id}
                    >
                      {runningWorkflow === workflow._id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="mr-1 h-3 w-3" />
                      )}
                      Run
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleToggleStatus(workflow)}
                    >
                      {workflow.status === 'active' ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(workflow._id, workflow.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Workflow</DialogTitle>
            <DialogDescription>
              Choose a template to get started or create from scratch
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="grid sm:grid-cols-2 gap-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={cn(
                    'p-4 rounded-lg border cursor-pointer transition-all',
                    selectedTemplate?.id === template.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground'
                  )}
                  onClick={() => {
                    setSelectedTemplate(template)
                    setNewWorkflowName(template.name)
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Workflow className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="font-medium">{template.name}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                  <div className="flex items-center gap-1 mt-3">
                    {template.steps.map((step, i) => (
                      <div
                        key={i}
                        className="flex h-5 w-5 items-center justify-center rounded bg-muted"
                        title={step.name}
                      >
                        {stepTypeIcons[step.type] || <Zap className="h-3 w-3" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {selectedTemplate && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Workflow Name</label>
                <Input
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  placeholder="Enter workflow name"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!selectedTemplate || !newWorkflowName}
            >
              Create Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
