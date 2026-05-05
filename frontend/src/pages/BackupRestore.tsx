import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BackupProgress from '@/components/backup/BackupProgress';
import BackupList from '@/components/backup/BackupList';
import RestorePanel from '@/components/backup/RestorePanel';
import ImportReport from '@/components/backup/ImportReport';
import {
  startStandardBackup,
  startBackupImport,
  startDryRunImport,
  getBackupJobStatus,
  listBackupFiles,
  downloadBackup,
  deleteBackupFile,
  BackupJob,
  BackupFile,
  isJobCompleted,
  isJobFailed,
  isJobRunning,
  isJobPending,
  getJobResultMessage
} from '@/api/backup';
import { Download, RefreshCw, Loader2, AlertCircle } from 'lucide-react';

export default function BackupRestore() {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup');
  const [backupJob, setBackupJob] = useState<BackupJob | null>(null);
  const [restoreJob, setRestoreJob] = useState<BackupJob | null>(null);
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [showConfirmImport, setShowConfirmImport] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load backup files on mount
  useEffect(() => {
    loadBackupFiles();
    checkActiveJobs();

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  const loadBackupFiles = async () => {
    try {
      setLoadingBackups(true);
      const files = await listBackupFiles();
      setBackupFiles(files);
      setError(null);
    } catch (err) {
      setError('Failed to load backup files');
      console.error('Failed to load backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const checkActiveJobs = async () => {
    try {
      const status = await getBackupJobStatus();
      if (status) {
        if (status.job_type === 'export') {
          setBackupJob(status);
        } else {
          setRestoreJob(status);
          setActiveTab('restore');
        }
        startPolling();
      }
    } catch (err) {
      console.error('Failed to check active jobs:', err);
    }
  };

  const startPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    const interval = setInterval(async () => {
      try {
        const status = await getBackupJobStatus();

        if (!status) {
          // No active job, stop polling
          stopPolling();
          setBackupJob(null);
          setRestoreJob(null);
          loadBackupFiles();
          return;
        }

        if (status.job_type === 'export') {
          setBackupJob(status);
          if (isJobCompleted(status) || isJobFailed(status)) {
            stopPolling();
            loadBackupFiles();
          }
        } else {
          setRestoreJob(status);
          if (isJobCompleted(status) || isJobFailed(status)) {
            stopPolling();
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    setPollingInterval(interval);
  };

  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  const handleStartBackup = async () => {
    try {
      setError(null);
      const job = await startStandardBackup();
      setBackupJob(job);
      startPolling();
    } catch (err: any) {
      setError(err.message || 'Failed to start backup');
      console.error('Failed to start backup:', err);
    }
  };

  const handleStartRestore = async (file: File, dryRun = false) => {
    if (!dryRun) {
      // Show confirmation modal for actual import
      setPendingFile(file);
      setShowConfirmImport(true);
      return;
    }

    // Dry run - proceed immediately
    try {
      setError(null);
      const job = await startDryRunImport({ file });
      setRestoreJob(job);
      startPolling();
    } catch (err: any) {
      setError(err.message || 'Failed to start import');
      console.error('Failed to start import:', err);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;

    setShowConfirmImport(false);
    try {
      setError(null);
      const job = await startBackupImport({ file: pendingFile });
      setRestoreJob(job);
      startPolling();
      setPendingFile(null);
    } catch (err: any) {
      setError(err.message || 'Failed to start import');
      console.error('Failed to start import:', err);
    }
  };

  const handleDownloadBackup = async (filename: string, jobId?: number) => {
    try {
      if (jobId) {
        await downloadBackup(jobId, filename);
      }
    } catch (err) {
      console.error('Failed to download backup:', err);
      setError('Failed to download backup');
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) {
      return;
    }

    try {
      await deleteBackupFile(filename);
      loadBackupFiles();
    } catch (err) {
      console.error('Failed to delete backup:', err);
      setError('Failed to delete backup');
    }
  };

  const isBackupActive = !!(backupJob && (isJobPending(backupJob) || isJobRunning(backupJob)));
  const isRestoreActive = !!(restoreJob && (isJobPending(restoreJob) || isJobRunning(restoreJob)));
  const hasActiveBackupOrRestore = isBackupActive || isRestoreActive;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Backup & Restore</h1>
          <p className="text-muted-foreground mt-1">
            Export and import your watch statistics
          </p>
        </div>
        <Button onClick={loadBackupFiles} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'backup' | 'restore')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="backup" className="gap-2">
            Backup
          </TabsTrigger>
          <TabsTrigger value="restore" className="gap-2">
            Restore
          </TabsTrigger>
        </TabsList>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-6">
          {/* Export Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Export Watch Stats</h2>
              <p className="text-muted-foreground text-sm">
                Create a backup of all watch statistics from this server
              </p>
            </div>
            <Button
              onClick={handleStartBackup}
              disabled={isBackupActive || hasActiveBackupOrRestore}
              className="gap-2"
            >
              {isBackupActive ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export Watch Stats
                </>
              )}
            </Button>
          </div>

          {/* Backup Progress */}
          {backupJob && (
            <div className="p-6 border rounded-lg bg-muted/30">
              <BackupProgress job={backupJob} />
              {(isJobCompleted(backupJob) || isJobFailed(backupJob)) && (
                <div className="mt-4 p-4 bg-background rounded-lg">
                  <p className="font-medium mb-2">{getJobResultMessage(backupJob)}</p>
                  {isJobCompleted(backupJob) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadBackup(backupJob.filename || `jellyview-backup-${backupJob.id}.json`, backupJob.id)}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download Backup
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Backup List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Saved Backups</h3>
            <BackupList
              backups={backupFiles}
              loading={loadingBackups}
              onDownload={handleDownloadBackup}
              onDelete={handleDeleteBackup}
            />
          </div>
        </TabsContent>

        {/* Restore Tab */}
        <TabsContent value="restore" className="space-y-6">
          {/* Restore Panel */}
          {!restoreJob ? (
            <RestorePanel
              isRestoring={isRestoreActive}
              hasActiveJob={hasActiveBackupOrRestore}
              onStartRestore={handleStartRestore}
            />
          ) : (
            /* Restore Progress */
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">
                {restoreJob.dry_run ? 'Dry Run Progress' : 'Restore Progress'}
              </h2>

              {isJobRunning(restoreJob) || isJobPending(restoreJob) ? (
                <div className="p-6 border rounded-lg bg-muted/30">
                  <BackupProgress job={restoreJob} />
                </div>
              ) : (
                /* Import Report */
                <ImportReport job={restoreJob} dryRun={restoreJob.dry_run} />
              )}

              {/* Result Message */}
              {(isJobCompleted(restoreJob) || isJobFailed(restoreJob)) && (
                <div className="p-4 bg-background rounded-lg">
                  <p className="font-medium">{getJobResultMessage(restoreJob)}</p>
                </div>
              )}

              {/* New Import Button */}
              {(isJobCompleted(restoreJob) || isJobFailed(restoreJob)) && (
                <Button
                  onClick={() => {
                    setRestoreJob(null);
                  }}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Start New Import
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmImport} onOpenChange={setShowConfirmImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Import</DialogTitle>
            <DialogDescription>
              This will import watch statistics from <strong>{pendingFile?.name}</strong>.
              <br /><br />
              This action may modify existing watch data. Make sure you have a backup of your current data before proceeding.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmImport(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmImport} className="gap-2">
              <Download className="h-4 w-4" />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
