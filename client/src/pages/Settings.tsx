import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  User,
  Building,
  Cloud,
  Key,
  Bell,
  Shield,
  CheckCircle,
  XCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/stores/authStore'
import { API_BASE_URL } from '@/lib/api'
import { driveApi } from '@/lib/api'

export default function Settings() {
  const { user, currentWorkspace } = useAuthStore()

  const [driveConnected, setDriveConnected] = useState(false)
  const [isCheckingDrive, setIsCheckingDrive] = useState(false)

  useEffect(() => {
    checkDriveConnection()
  }, [])

  const checkDriveConnection = async () => {
    setIsCheckingDrive(true)
    try {
      const { data } = await driveApi.status()
      setDriveConnected(data.connected)
    } catch {
      setDriveConnected(false)
    } finally {
      setIsCheckingDrive(false)
    }
  }

  const handleConnectDrive = () => {
    window.location.href = `${API_BASE_URL}/auth/google`
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and workspace settings
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="workspace">
            <Building className="mr-2 h-4 w-4" />
            Workspace
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Cloud className="mr-2 h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Your personal account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={user?.avatar} alt={user?.name} />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">{user?.name}</h3>
                    <p className="text-muted-foreground">{user?.email}</p>
                    {user?.hasGoogleAuth && (
                      <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>Google account connected</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <Input value={user?.name || ''} disabled />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address</label>
                    <Input value={user?.email || ''} disabled />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security
                </CardTitle>
                <CardDescription>
                  Manage your account security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Password</p>
                      <p className="text-sm text-muted-foreground">
                        {user?.hasGoogleAuth
                          ? 'Using Google authentication'
                          : 'Set a strong password'}
                      </p>
                    </div>
                  </div>
                  {!user?.hasGoogleAuth && (
                    <Button variant="outline" size="sm">
                      Change
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Workspace Tab */}
        <TabsContent value="workspace">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>Workspace Settings</CardTitle>
                <CardDescription>
                  Manage your workspace configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Workspace Name</label>
                  <Input value={currentWorkspace?.name || ''} disabled />
                </div>

                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Workspace ID</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {currentWorkspace?.id}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Configure notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'Document processed', description: 'When a document finishes processing' },
                    { label: 'Workflow completed', description: 'When a workflow finishes running' },
                    { label: 'New insights', description: 'When new patterns are discovered' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked
                        className="h-5 w-5 rounded border-gray-300"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>Connected Services</CardTitle>
                <CardDescription>
                  Manage your integrations and data sources
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Google Drive */}
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                      <svg className="h-6 w-6" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium">Google Drive</h4>
                      <p className="text-sm text-muted-foreground">
                        Import documents from your Drive
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isCheckingDrive ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : driveConnected ? (
                      <>
                        <div className="flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span>Connected</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={checkDriveConnection}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <XCircle className="h-4 w-4" />
                          <span>Not connected</span>
                        </div>
                        <Button size="sm" onClick={handleConnectDrive}>
                          Connect
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Gemini API */}
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium">Google Gemini</h4>
                      <p className="text-sm text-muted-foreground">
                        AI-powered search and analysis
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Active</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Manage your API keys for external integrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg bg-muted text-center">
                  <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    API keys are configured in environment variables
                  </p>
                  <Button variant="link" size="sm" className="mt-2">
                    View Documentation
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
