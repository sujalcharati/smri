import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Search,
  FolderOpen,
  Check,
  Cloud,
  HardDrive,
  Loader2,
  MessageSquare,
  Hash,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentStore } from '@/stores/documentStore'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/components/ui/use-toast'
import { cn, formatBytes, formatRelativeTime } from '@/lib/utils'

interface SlackChannel {
  id: string
  name: string
  memberCount?: number
  topic?: string
  purpose?: string
}

export default function Documents() {
  const { currentWorkspace, user, token } = useAuthStore()
  const {
    documents,
    driveFiles,
    driveConnected,
    isLoading,
    isUploading,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    checkDriveStatus,
    fetchDriveFiles,
    importFromDrive,
  } = useDocumentStore()
  const { toast } = useToast()

  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedDriveFiles, setSelectedDriveFiles] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)

  // Slack state
  const [slackConfigured, setSlackConfigured] = useState(false)
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([])
  const [selectedSlackChannels, setSelectedSlackChannels] = useState<string[]>([])
  const [slackLoading, setSlackLoading] = useState(false)
  const [syncingDocId, setSyncingDocId] = useState<string | null>(null)

  useEffect(() => {
    if (currentWorkspace) {
      fetchDocuments(currentWorkspace.id)
      checkDriveStatus()
      checkSlackStatus()
    }
  }, [currentWorkspace, fetchDocuments, checkDriveStatus])

  // Handle Drive connection callback
  useEffect(() => {
    const driveStatus = searchParams.get('drive')
    const error = searchParams.get('error')

    if (driveStatus === 'connected') {
      toast({
        title: 'Google Drive connected',
        description: 'You can now import files from your Drive',
      })
      checkDriveStatus()
      setSearchParams({})
    } else if (error) {
      toast({
        title: 'Connection failed',
        description: error === 'drive_connect_failed' ? 'Failed to connect Google Drive' : error,
        variant: 'destructive',
      })
      setSearchParams({})
    }
  }, [searchParams, setSearchParams, toast, checkDriveStatus])

  useEffect(() => {
    if (showUploadModal && driveConnected) {
      fetchDriveFiles()
    }
  }, [showUploadModal, driveConnected, fetchDriveFiles])

  // Slack API functions
  const checkSlackStatus = async () => {
    try {
      const response = await fetch('/api/slack/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setSlackConfigured(data.configured)
    } catch {
      setSlackConfigured(false)
    }
  }

  const fetchSlackChannels = async () => {
    if (!slackConfigured) return
    setSlackLoading(true)
    try {
      const response = await fetch('/api/slack/channels', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setSlackChannels(data.channels || [])
    } catch (error) {
      console.error('Failed to fetch Slack channels:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch Slack channels',
        variant: 'destructive',
      })
    } finally {
      setSlackLoading(false)
    }
  }

  const handleSlackImport = async () => {
    if (!currentWorkspace || selectedSlackChannels.length === 0) return
    setSlackLoading(true)

    try {
      for (const channelId of selectedSlackChannels) {
        const channel = slackChannels.find((c) => c.id === channelId)
        if (!channel) continue

        const response = await fetch('/api/slack/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            channelId,
            channelName: channel.name,
            workspaceId: currentWorkspace.id,
          }),
        })

        if (!response.ok) {
          throw new Error(`Failed to import #${channel.name}`)
        }
      }

      toast({
        title: 'Slack import complete',
        description: `Imported ${selectedSlackChannels.length} channel(s)`,
      })

      setSelectedSlackChannels([])
      setShowUploadModal(false)
      fetchDocuments(currentWorkspace.id)
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import channels',
        variant: 'destructive',
      })
    } finally {
      setSlackLoading(false)
    }
  }

  const toggleSlackChannel = (channelId: string) => {
    setSelectedSlackChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    )
  }

  // Sync a single Slack document
  const handleSlackSync = async (docId: string, sourceId: string, title: string) => {
    if (!currentWorkspace) return
    setSyncingDocId(docId)

    try {
      // Extract channel name from title (format: "Slack: #channel-name")
      const channelName = title.replace('Slack: #', '')

      const response = await fetch('/api/slack/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          channelId: sourceId,
          channelName,
          workspaceId: currentWorkspace.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Sync failed')
      }

      toast({
        title: 'Slack synced',
        description: `#${channelName} has been updated with latest messages`,
      })

      fetchDocuments(currentWorkspace.id)
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Failed to sync channel',
        variant: 'destructive',
      })
    } finally {
      setSyncingDocId(null)
    }
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !currentWorkspace) return

    for (const file of Array.from(files)) {
      try {
        await uploadDocument(currentWorkspace.id, file)
        toast({
          title: 'Document uploaded',
          description: `${file.name} is being processed`,
        })
      } catch {
        toast({
          title: 'Upload failed',
          description: `Failed to upload ${file.name}`,
          variant: 'destructive',
        })
      }
    }

    setShowUploadModal(false)
  }

  const handleDriveImport = async () => {
    if (!currentWorkspace || selectedDriveFiles.length === 0) return

    for (const fileId of selectedDriveFiles) {
      try {
        await importFromDrive(fileId, currentWorkspace.id)
      } catch (error) {
        console.error('Import error:', error)
      }
    }

    toast({
      title: 'Import started',
      description: `${selectedDriveFiles.length} files are being imported`,
    })

    setSelectedDriveFiles([])
    setShowUploadModal(false)
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return

    try {
      await deleteDocument(id)
      toast({
        title: 'Document deleted',
        description: `${title} has been removed`,
      })
    } catch {
      toast({
        title: 'Delete failed',
        description: 'Could not delete document',
        variant: 'destructive',
      })
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFileUpload(e.dataTransfer.files)
    },
    [currentWorkspace]
  )

  const toggleDriveFile = (fileId: string) => {
    setSelectedDriveFiles((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    )
  }

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'processing':
        return 'bg-yellow-500'
      case 'failed':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getTypeIcon = (_type: string) => {
    return FileText
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground">
            Manage your knowledge base documents
          </p>
        </div>
        <Button onClick={() => setShowUploadModal(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Add Documents
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Drop Zone (when dragging) */}
      <div
        className={cn(
          'relative rounded-xl border-2 border-dashed transition-all',
          isDragging
            ? 'border-primary bg-primary/5 p-12'
            : 'border-transparent p-0'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="flex flex-col items-center justify-center text-center">
            <Upload className="h-12 w-12 text-primary mb-4" />
            <p className="text-lg font-medium">Drop files here to upload</p>
            <p className="text-sm text-muted-foreground">PDF, DOCX, TXT files supported</p>
          </div>
        )}

        {/* Documents Grid */}
        {!isDragging && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="border-0 shadow-md animate-pulse">
                  <CardContent className="pt-6">
                    <div className="h-10 w-10 bg-muted rounded-lg mb-4" />
                    <div className="h-4 w-3/4 bg-muted rounded mb-2" />
                    <div className="h-3 w-1/2 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))
            ) : filteredDocuments.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No documents yet</h3>
                <p className="text-muted-foreground mb-4">
                  Upload documents to build your knowledge base
                </p>
                <Button onClick={() => setShowUploadModal(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Add Documents
                </Button>
              </div>
            ) : (
              filteredDocuments.map((doc, index) => {
                const Icon = getTypeIcon(doc.type)
                return (
                  <motion.div
                    key={doc._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-0 shadow-md hover:shadow-lg transition-all group">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex items-center gap-1">
                            <div
                              className={cn(
                                'w-2 h-2 rounded-full',
                                getStatusColor(doc.processingStatus)
                              )}
                              title={doc.processingStatus}
                            />
                            {doc.source === 'slack' && doc.sourceId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSlackSync(doc._id, doc.sourceId!, doc.title)
                                }}
                                disabled={syncingDocId === doc._id}
                                title="Sync latest messages"
                              >
                                {syncingDocId === doc._id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 h-8 w-8"
                              onClick={() => handleDelete(doc._id, doc.title)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <h3 className="font-medium truncate mb-1">{doc.title}</h3>
                        <p className="text-xs text-muted-foreground mb-2">
                          {formatBytes(doc.size)} • {formatRelativeTime(doc.createdAt)}
                        </p>
                        {doc.summary && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {doc.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-3">
                          {doc.source === 'google_drive' && (
                            <Cloud className="h-3 w-3 text-muted-foreground" />
                          )}
                          {doc.source === 'slack' && (
                            <MessageSquare className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground uppercase">
                            {doc.type}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Documents</DialogTitle>
            <DialogDescription>
              Upload files from your computer or import from Google Drive
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="upload" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">
                <HardDrive className="mr-2 h-4 w-4" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="drive" disabled={!user?.hasDriveAccess}>
                <Cloud className="mr-2 h-4 w-4" />
                Drive
              </TabsTrigger>
              <TabsTrigger value="slack" onClick={() => slackConfigured && fetchSlackChannels()}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Slack
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4">
              <div
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
                  'hover:border-primary hover:bg-primary/5'
                )}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                <p className="font-medium mb-1">Click to upload or drag and drop</p>
                <p className="text-sm text-muted-foreground">
                  PDF, DOCX, TXT (Max 50MB)
                </p>
              </div>
            </TabsContent>

            <TabsContent value="drive" className="mt-4">
              {!driveConnected ? (
                <div className="text-center py-8">
                  <Cloud className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium mb-2">Connect Google Drive</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your Google Drive to import files
                  </p>
                  <Button onClick={async () => {
                    try {
                      const response = await fetch('/api/auth/google/drive', {
                        headers: { Authorization: `Bearer ${token}` },
                      })
                      const data = await response.json()
                      if (data.authUrl) {
                        window.location.href = data.authUrl
                      }
                    } catch (error) {
                      toast({
                        title: 'Error',
                        description: 'Failed to connect to Google Drive',
                        variant: 'destructive',
                      })
                    }
                  }}>
                    <Cloud className="mr-2 h-4 w-4" />
                    Connect Google Drive
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {selectedDriveFiles.length} files selected
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchDriveFiles()}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : (
                      driveFiles.map((file) => (
                        <div
                          key={file.id}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                            selectedDriveFiles.includes(file.id)
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted'
                          )}
                          onClick={() => toggleDriveFile(file.id)}
                        >
                          <div
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded border',
                              selectedDriveFiles.includes(file.id)
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground'
                            )}
                          >
                            {selectedDriveFiles.includes(file.id) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatBytes(parseInt(file.size))}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <Button
                    className="w-full"
                    disabled={selectedDriveFiles.length === 0 || isUploading}
                    onClick={handleDriveImport}
                  >
                    {isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Cloud className="mr-2 h-4 w-4" />
                    )}
                    Import {selectedDriveFiles.length} Files
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="slack" className="mt-4">
              {!slackConfigured ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium mb-2">Connect Slack</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add SLACK_BOT_TOKEN to your server .env file to enable Slack integration
                  </p>
                  <div className="text-xs text-left bg-muted p-3 rounded-lg max-w-md mx-auto">
                    <p className="font-medium mb-2">Setup steps:</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Create a Slack App at api.slack.com/apps</li>
                      <li>Add Bot Token Scopes: channels:history, channels:read, users:read</li>
                      <li>Install to your workspace</li>
                      <li>Copy Bot Token to server/.env as SLACK_BOT_TOKEN</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {selectedSlackChannels.length} channel(s) selected
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchSlackChannels}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {slackLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : slackChannels.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No channels found. Click Refresh to load.</p>
                      </div>
                    ) : (
                      slackChannels.map((channel) => (
                        <div
                          key={channel.id}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                            selectedSlackChannels.includes(channel.id)
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted'
                          )}
                          onClick={() => toggleSlackChannel(channel.id)}
                        >
                          <div
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded border',
                              selectedSlackChannels.includes(channel.id)
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground'
                            )}
                          >
                            {selectedSlackChannels.includes(channel.id) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{channel.name}</p>
                            {channel.purpose && (
                              <p className="text-xs text-muted-foreground truncate">
                                {channel.purpose}
                              </p>
                            )}
                          </div>
                          {channel.memberCount && (
                            <span className="text-xs text-muted-foreground">
                              {channel.memberCount} members
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <Button
                    className="w-full"
                    disabled={selectedSlackChannels.length === 0 || slackLoading}
                    onClick={handleSlackImport}
                  >
                    {slackLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="mr-2 h-4 w-4" />
                    )}
                    Import {selectedSlackChannels.length} Channel(s)
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
