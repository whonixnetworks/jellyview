import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import LogViewer, { LogEntry as LogViewerEntry } from '@/components/ui/LogViewer'
import { useTheme } from '@/hooks/useTheme'
import { AlertCircle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import {
  getSettings,
  updateJellyfinConnection,
  testJellyfinConnection,
  createBackup,
  restoreBackup,
  getSystemInfo,
  getLogs,
} from '@/api/settings'

export default function Settings() {
  const { theme, toggleTheme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [connectionMessage, setConnectionMessage] = useState('')
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Jellyfin Connection state
  const [jellyfinUrl, setJellyfinUrl] = useState('')
  const [apiKey, setApiKey] = useState('')

  // General Settings state
  const [refreshInterval, setRefreshInterval] = useState('30')
  const [historyRetentionDays, setHistoryRetentionDays] = useState('90')
  const [syncInterval, setSyncInterval] = useState('60')
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // System Info state
  const [systemInfo, setSystemInfo] = useState({
    jellyviewVersion: '1.0.0',
    jellyfinVersion: '10.8.0',
    dbSize: '245 MB',
    uptime: '5 days, 3 hours'
  })
  const [systemInfoError, setSystemInfoError] = useState<string | null>(null)
  const [isRefreshingSystem, setIsRefreshingSystem] = useState(false)

  // Logs state
  const [logs, setLogs] = useState<LogViewerEntry[]>([])
  const [logsError, setLogsError] = useState<string | null>(null)
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false)

  // Dialog states
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  // Success message states
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [backupCreated, setBackupCreated] = useState(false)

  // Load saved settings on mount
  useEffect(() => {
    const loadSavedSettings = async () => {
      try {
        setLoading(true)
        const response = await getSettings()
        if (response.jellyfin) {
          setJellyfinUrl(response.jellyfin.url || '')
          setApiKey(response.jellyfin.api_key || '')
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setLoading(false)
      }
    }
    loadSavedSettings()
  }, [])

  // Load logs on mount
  useEffect(() => {
    handleRefreshLogs()
  }, [])

  const handleTestConnection = async () => {
    setConnectionStatus('testing')
    setLoading(true)
    setConnectionMessage('')
    setConnectionError(null)

    try {
      if (!jellyfinUrl.trim()) {
        setConnectionStatus('error')
        setConnectionError('Please enter a Jellyfin server URL')
        setConnectionMessage('')
        return
      }

      if (!apiKey.trim()) {
        setConnectionStatus('error')
        setConnectionError('Please enter your API key')
        setConnectionMessage('')
        return
      }

      // First save the connection settings, then test
      await updateJellyfinConnection({
        url: jellyfinUrl,
        api_key: apiKey,
        verify_ssl: true,
      })

      const response = await testJellyfinConnection()
      if (response.success) {
        setConnectionStatus('success')
        setConnectionMessage(`Successfully connected to ${response.server_info?.name || 'Jellyfin'} (${response.server_info?.version || 'unknown'})`)
        setConnectionError(null)
      } else {
        setConnectionStatus('error')
        setConnectionError(response.message || 'Connection failed')
        setConnectionMessage('')
      }
    } catch (error) {
      setConnectionStatus('error')
      const errorMessage = error instanceof Error ? error.message : 'Connection failed: Server unreachable'
      setConnectionError(errorMessage)
      setConnectionMessage('')
      console.error('Connection test failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setLoading(true)
    setSettingsError(null)
    setSettingsSaved(false)

    try {
      // Validate inputs
      const refreshInt = parseInt(refreshInterval)
      const retention = parseInt(historyRetentionDays)
      const syncInt = parseInt(syncInterval)

      if (refreshInt < 5 || refreshInt > 300) {
        throw new Error('Refresh interval must be between 5 and 300 seconds')
      }
      if (retention < 1 || retention > 365) {
        throw new Error('History retention must be between 1 and 365 days')
      }
      if (syncInt < 1 || syncInt > 1440) {
        throw new Error('Sync interval must be between 1 and 1440 minutes')
      }

      // Save Jellyfin connection if not already saved
      if (jellyfinUrl && apiKey) {
        await updateJellyfinConnection({
          url: jellyfinUrl,
          api_key: apiKey,
          verify_ssl: true,
        })
      }

      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 3000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings'
      setSettingsError(errorMessage)
      console.error('Failed to save settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadBackup = async () => {
    setLoading(true)
    setBackupCreated(false)

    try {
      const response = await createBackup()
      if (response.success) {
        setBackupCreated(true)
        setTimeout(() => setBackupCreated(false), 3000)
      } else {
        setSettingsError(response.message || 'Failed to create backup')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create backup'
      setSettingsError(errorMessage)
      console.error('Failed to download backup:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreBackup = async () => {
    if (!backupFile) {
      setRestoreError('Please select a backup file')
      return
    }

    setLoading(true)
    setRestoreError(null)

    try {
      // Read and validate backup file
      const text = await backupFile.text()
      const backup = JSON.parse(text)

      if (!backup.version) {
        throw new Error('Invalid backup file: missing version')
      }

      // Send to API for restore
      const response = await restoreBackup(backupFile.name)
      if (response.success) {
        setRestoreDialogOpen(false)
        setBackupFile(null)
        setSettingsSaved(true)
        setTimeout(() => setSettingsSaved(false), 3000)
      } else {
        setRestoreError(response.message || 'Failed to restore backup')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore backup. The file may be corrupted.'
      setRestoreError(errorMessage)
      console.error('Failed to restore backup:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshSystemInfo = async () => {
    setIsRefreshingSystem(true)
    setSystemInfoError(null)

    try {
      const response = await getSystemInfo()
      setSystemInfo({
        jellyviewVersion: response.jellyview_version || '0.1.0',
        jellyfinVersion: response.jellyfin_version || 'Unknown',
        dbSize: formatBytes(response.database_size || 0),
        uptime: formatUptimeSeconds(response.uptime || 0),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh system info'
      setSystemInfoError(errorMessage)
      console.error('Failed to refresh system info:', error)
    } finally {
      setIsRefreshingSystem(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatUptimeSeconds = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    if (days > 0) return `${days} days, ${hours} hours`
    return `${hours} hours`
  }

  const handleRefreshLogs = async () => {
    setIsRefreshingLogs(true)
    setLogsError(null)

    try {
      const logEntries = await getLogs({ limit: 50 })
      const viewerLogs: LogViewerEntry[] = logEntries.map((entry, index) => ({
        id: `log-${index}`,
        timestamp: entry.timestamp,
        level: entry.level as LogViewerEntry['level'],
        message: entry.message,
        source: entry.logger,
      }))
      setLogs(viewerLogs)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh logs'
      setLogsError(errorMessage)
      console.error('Failed to refresh logs:', error)
    } finally {
      setIsRefreshingLogs(false)
    }
  }

  const handleClearLogs = () => {
    setLogs([])
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Configure your JellyView preferences and system settings</p>
      </div>

      <Tabs defaultValue="connection" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 h-auto">
          <TabsTrigger value="connection" className="data-[state=active]:bg-background min-h-[44px]">Connection</TabsTrigger>
          <TabsTrigger value="general" className="data-[state=active]:bg-background min-h-[44px]">General</TabsTrigger>
          <TabsTrigger value="appearance" className="data-[state=active]:bg-background min-h-[44px]">Appearance</TabsTrigger>
          <TabsTrigger value="backup" className="data-[state=active]:bg-background min-h-[44px]">Backup</TabsTrigger>
          <TabsTrigger value="system" className="data-[state=active]:bg-background min-h-[44px]">System</TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-background min-h-[44px]">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Jellyfin Connection</CardTitle>
              <CardDescription>
                Configure your Jellyfin server connection details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="jellyfin-url">Server URL</Label>
                <Input
                  id="jellyfin-url"
                  placeholder="https://jellyfin.example.com"
                  value={jellyfinUrl}
                  onChange={(e) => {
                    setJellyfinUrl(e.target.value)
                    setConnectionError(null)
                    setConnectionMessage('')
                  }}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Enter your Jellyfin API key"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setConnectionError(null)
                    setConnectionMessage('')
                  }}
                  disabled={loading}
                />
              </div>

              {/* Error/Success Messages */}
              {connectionError && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Connection Error</p>
                    <p className="text-sm opacity-90">{connectionError}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setConnectionError(null)} className="h-6 w-6">
                    ×
                  </Button>
                </div>
              )}

              {connectionMessage && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Success</p>
                    <p className="text-sm opacity-90">{connectionMessage}</p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={handleTestConnection}
                disabled={loading}
                variant={connectionStatus === 'success' ? 'default' : 'outline'}
              >
                {loading && connectionStatus === 'testing' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              <Button
                onClick={handleSaveSettings}
                disabled={loading || connectionStatus !== 'success'}
              >
                Save Settings
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure application behavior and data retention
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="refresh-interval">Dashboard Refresh Interval (seconds)</Label>
                <Input
                  id="refresh-interval"
                  type="number"
                  min="5"
                  max="300"
                  value={refreshInterval}
                  onChange={(e) => {
                    setRefreshInterval(e.target.value)
                    setSettingsError(null)
                  }}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  How often the dashboard statistics are updated automatically
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="history-retention">History Retention (days)</Label>
                <Input
                  id="history-retention"
                  type="number"
                  min="1"
                  max="365"
                  value={historyRetentionDays}
                  onChange={(e) => {
                    setHistoryRetentionDays(e.target.value)
                    setSettingsError(null)
                  }}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  How long to keep playback and activity history
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sync-interval">Library Sync Interval (minutes)</Label>
                <Input
                  id="sync-interval"
                  type="number"
                  min="1"
                  max="1440"
                  value={syncInterval}
                  onChange={(e) => {
                    setSyncInterval(e.target.value)
                    setSettingsError(null)
                  }}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  How often to sync library metadata from Jellyfin
                </p>
              </div>

              {/* Error/Success Messages */}
              {settingsError && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Error</p>
                    <p className="text-sm opacity-90">{settingsError}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSettingsError(null)} className="h-6 w-6">
                    ×
                  </Button>
                </div>
              )}

              {settingsSaved && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Success</p>
                    <p className="text-sm opacity-90">Settings have been saved successfully</p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button onClick={handleSaveSettings} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the visual appearance of JellyView
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="font-medium">Dark Mode</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Toggle between light and dark theme
                  </p>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                  role="switch"
                  aria-checked={theme === 'dark'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="font-medium">Compact Mode</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Reduce spacing and padding for more content
                  </p>
                </div>
                <Button variant="outline" disabled className="min-h-[44px] touch-target">
                  Coming Soon
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="font-medium">Custom Theme</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select from predefined color schemes
                  </p>
                </div>
                <Button variant="outline" disabled className="min-h-[44px] touch-target">
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Backup & Restore</CardTitle>
              <CardDescription>
                Create backups or restore from a previous backup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium mb-2">Create Backup</h4>
                  <p className="text-sm text-muted-foreground">
                    Download a complete backup of your JellyView settings and data
                  </p>
                </div>
                <Button
                  onClick={handleDownloadBackup}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Backup...
                    </>
                  ) : (
                    'Download Backup'
                  )}
                </Button>
              </div>

              {/* Success Message */}
              {backupCreated && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Backup Created</p>
                    <p className="text-sm opacity-90">Your backup has been downloaded successfully</p>
                  </div>
                </div>
              )}

              <div className="border-t pt-6">
                <div>
                  <h4 className="font-medium mb-2">Restore from Backup</h4>
                  <p className="text-sm text-muted-foreground">
                    Restore your JellyView data from a backup file. This will overwrite current settings.
                  </p>
                </div>
                <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto mt-3">
                      Restore Backup
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Restore from Backup</DialogTitle>
                      <DialogDescription>
                        Select a backup file to restore. This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="backup-file">Backup File</Label>
                        <Input
                          id="backup-file"
                          type="file"
                          accept=".json"
                          onChange={(e) => {
                            setBackupFile(e.target.files?.[0] || null)
                            setRestoreError(null)
                          }}
                          disabled={loading}
                        />
                      </div>
                      {backupFile && (
                        <div className="p-3 bg-muted rounded-md">
                          <p className="text-sm font-medium">{backupFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(backupFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      )}
                      {restoreError && (
                        <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">Restore Error</p>
                            <p className="text-sm opacity-90">{restoreError}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRestoreDialogOpen(false)
                          setBackupFile(null)
                          setRestoreError(null)
                        }}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleRestoreBackup}
                        disabled={loading || !backupFile}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Restoring...
                          </>
                        ) : (
                          'Restore'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>
                View system details and version information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {systemInfoError && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Error</p>
                    <p className="text-sm opacity-90">{systemInfoError}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSystemInfoError(null)} className="h-6 w-6">
                    ×
                  </Button>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <Label className="text-sm text-muted-foreground">JellyView Version</Label>
                  <p className="text-2xl font-bold mt-1">{systemInfo.jellyviewVersion}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <Label className="text-sm text-muted-foreground">Jellyfin Version</Label>
                  <p className="text-2xl font-bold mt-1">{systemInfo.jellyfinVersion}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <Label className="text-sm text-muted-foreground">Database Size</Label>
                  <p className="text-2xl font-bold mt-1">{systemInfo.dbSize}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <Label className="text-sm text-muted-foreground">System Uptime</Label>
                  <p className="text-2xl font-bold mt-1">{systemInfo.uptime}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRefreshSystemInfo}
                  disabled={isRefreshingSystem}
                  className="gap-2"
                >
                  {isRefreshingSystem ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      Refresh Info
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Application Logs</CardTitle>
                  <CardDescription>
                    View and filter application logs for debugging
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshLogs}
                  disabled={isRefreshingLogs}
                  className="gap-2"
                >
                  {isRefreshingLogs ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      Refresh
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <LogViewer
                logs={logs}
                isLoading={isRefreshingLogs}
                error={logsError}
                onRetry={handleRefreshLogs}
                onClear={handleClearLogs}
                maxHeight="500px"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
