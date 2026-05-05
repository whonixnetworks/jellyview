import { apiClient, ApiRequestConfig } from './client';

// ============================================================================
// Types
// ============================================================================

export type BackupJobType = 'export' | 'import';

export type BackupJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackupJob {
  id: number;
  job_type: BackupJobType;
  status: BackupJobStatus;
  filename?: string;
  progress: number; // 0-100
  current_step?: string;
  total_users: number;
  total_items: number;
  processed: number;
  matched: number;
  unmatched: number;
  errors: number;
  error_log: string[]; // JSON array of error messages
  dry_run: boolean;
  created_at: string;
  completed_at?: string;
}

export interface BackupJobStatusResponse extends BackupJob {
  eta_seconds?: number;
}

export interface BackupJobCreate {
  dry_run?: boolean;
}

export interface BackupJobDryRun {
  dry_run: boolean;
}

export interface BackupImportParams {
  file: File;
  dry_run?: boolean;
}

export interface BackupFileInfo {
  filename: string;
  size: number; // bytes
  created_at: string;
  jellyview_version: string;
  source_server?: {
    name: string;
    version: string;
    id: string;
  };
  stats?: {
    total_users: number;
    total_items: number;
    total_watch_records: number;
  };
}

export interface BackupFile {
  id: number;
  filename: string;
  size: number; // bytes
  created_at: string;
  modified_at: string;
  checksum?: string;
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * Get current backup/restore job status
 */
export async function getBackupJobStatus(
  config?: ApiRequestConfig
): Promise<BackupJobStatusResponse | null> {
  try {
    return await apiClient.get<BackupJobStatusResponse>('/backup/status', undefined, config);
  } catch (error) {
    // 404 means no active job, return null
    return null;
  }
}

/**
 * Start a new backup export job
 */
export async function startBackupExport(
  options?: BackupJobCreate,
  config?: ApiRequestConfig
): Promise<BackupJob> {
  return apiClient.post<BackupJob>('/backup/export', options, config);
}

/**
 * Get backup export job progress
 */
export async function getBackupExportJob(
  jobId: number,
  config?: ApiRequestConfig
): Promise<BackupJobStatusResponse> {
  return apiClient.get<BackupJobStatusResponse>(`/backup/export/${jobId}`, undefined, config);
}

/**
 * Download a backup JSON file
 */
export async function downloadBackup(
  jobId: number,
  filename?: string,
  _config?: ApiRequestConfig
): Promise<Blob> {
  const actualFilename = filename || `jellyview-backup-${jobId}.json`;
  return apiClient.downloadFile(`/backup/download/${jobId}`, actualFilename);
}

/**
 * List saved backup files
 */
export async function listBackupFiles(
  config?: ApiRequestConfig
): Promise<BackupFile[]> {
  return apiClient.get<BackupFile[]>('/backup/list', undefined, config);
}

/**
 * Delete a saved backup file
 */
export async function deleteBackupFile(
  filename: string,
  config?: ApiRequestConfig
): Promise<void> {
  await apiClient.delete<void>(`/backup/${encodeURIComponent(filename)}`, config);
}

/**
 * Start a new backup import job
 */
export async function startBackupImport(
  params: BackupImportParams,
  _config?: ApiRequestConfig
): Promise<BackupJob> {
  return apiClient.uploadFile<BackupJob>('/backup/import', params.file, (_progress) => {
    // Upload progress is handled internally
  });
}

/**
 * Get backup import job progress
 */
export async function getBackupImportJob(
  jobId: number,
  config?: ApiRequestConfig
): Promise<BackupJobStatusResponse> {
  return apiClient.get<BackupJobStatusResponse>(`/backup/import/${jobId}`, undefined, config);
}

/**
 * Start a dry-run import to preview what would be restored
 */
export async function startDryRunImport(
  params: BackupImportParams,
  config?: ApiRequestConfig
): Promise<BackupJob> {
  return startBackupImport({ ...params, dry_run: true }, config);
}

/**
 * Start a dry-run for an existing import job
 */
export async function startJobDryRun(
  jobId: number,
  config?: ApiRequestConfig
): Promise<BackupJob> {
  return apiClient.post<BackupJob>(`/backup/import/${jobId}/dry-run`, undefined, config);
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Start a standard backup (not dry run)
 */
export async function startStandardBackup(
  config?: ApiRequestConfig
): Promise<BackupJob> {
  return startBackupExport({ dry_run: false }, config);
}

/**
 * Start a standard import (not dry run)
 */
export async function startStandardImport(
  file: File,
  config?: ApiRequestConfig
): Promise<BackupJob> {
  return startBackupImport({ file, dry_run: false }, config);
}

/**
 * Check if there's an active backup/restore job running
 */
export async function hasActiveJob(
  config?: ApiRequestConfig
): Promise<boolean> {
  const status = await getBackupJobStatus(config);
  return status !== null && (status.status === 'pending' || status.status === 'running');
}

/**
 * Get latest backup file
 */
export async function getLatestBackupFile(
  config?: ApiRequestConfig
): Promise<BackupFile | null> {
  const files = await listBackupFiles(config);
  if (files.length === 0) return null;
  
  // Sort by created_at descending and return first
  return files.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
}

/**
 * Delete multiple backup files
 */
export async function deleteBackupFiles(
  filenames: string[],
  config?: ApiRequestConfig
): Promise<void> {
  await Promise.all(
    filenames.map(filename => deleteBackupFile(filename, config))
  );
}

// ============================================================================
// Type Guards and Helpers
// ============================================================================

export function isJobPending(job: BackupJob): boolean {
  return job.status === 'pending';
}

export function isJobRunning(job: BackupJob): boolean {
  return job.status === 'running';
}

export function isJobCompleted(job: BackupJob): boolean {
  return job.status === 'completed';
}

export function isJobFailed(job: BackupJob): boolean {
  return job.status === 'failed';
}

export function isJobActive(job: BackupJob): boolean {
  return isJobPending(job) || isJobRunning(job);
}

export function isExportJob(job: BackupJob): boolean {
  return job.job_type === 'export';
}

export function isImportJob(job: BackupJob): boolean {
  return job.job_type === 'import';
}

export function isDryRun(job: BackupJob): boolean {
  return job.dry_run;
}

export function getJobTypeLabel(jobType: BackupJobType): string {
  return jobType === 'export' ? 'Backup' : 'Restore';
}

export function getStatusLabel(status: BackupJobStatus): string {
  const labels: Record<BackupJobStatus, string> = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
  };
  return labels[status];
}

export function getStatusColor(status: BackupJobStatus): string {
  switch (status) {
    case 'pending':
      return 'text-yellow-500';
    case 'running':
      return 'text-blue-500';
    case 'completed':
      return 'text-green-500';
    case 'failed':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

export function getStatusBadgeColor(status: BackupJobStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'running':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'completed':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'failed':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function formatJobDuration(job: BackupJob): string {
  const start = new Date(job.created_at).getTime();
  const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
  const duration = Math.floor((end - start) / 1000); // seconds
  
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

export function getJobProgressMessage(job: BackupJob): string {
  const step = job.current_step || 'Processing';
  const progress = Math.round(job.progress);
  
  if (isExportJob(job)) {
    if (job.total_users > 0 && job.total_items > 0) {
      return `${step}: User ${job.processed}/${job.total_users}, Items ${job.processed}/${job.total_items} (${progress}%)`;
    }
    return `${step} (${progress}%)`;
  } else {
    if (job.total_users > 0) {
      return `${step}: User ${job.processed}/${job.total_users}, Items ${job.processed}/${job.total_items} (${progress}%)`;
    }
    return `${step} (${progress}%)`;
  }
}

export function getJobSummary(job: BackupJob): string {
  if (isExportJob(job)) {
    return `Exported ${job.processed} items from ${job.total_users} users`;
  } else {
    return `Imported ${job.matched} items, ${job.unmatched} unmatched, ${job.errors} errors`;
  }
}

export function getJobResultMessage(job: BackupJob): string {
  if (!isJobCompleted(job) && !isJobFailed(job)) {
    return '';
  }
  
  if (isJobFailed(job)) {
    return `Failed with ${job.errors} error(s)`;
  }
  
  if (isDryRun(job)) {
    return `Dry run completed: ${job.matched} items would be restored, ${job.unmatched} unmatched`;
  }
  
  if (isExportJob(job)) {
    return `Successfully exported ${job.processed} items from ${job.total_users} users`;
  } else {
    return `Successfully imported ${job.matched} items, skipped ${job.processed - job.matched}, ${job.errors} errors`;
  }
}

export function calculateETA(job: BackupJob): number | null {
  if (!isJobRunning(job) || job.progress <= 0) {
    return null;
  }
  
  const elapsed = (Date.now() - new Date(job.created_at).getTime()) / 1000;
  const rate = job.progress / elapsed; // progress per second
  const remaining = 100 - job.progress;
  
  if (rate <= 0) {
    return null;
  }
  
  return Math.round(remaining / rate);
}

export function formatETA(seconds: number | null): string {
  if (seconds === null || seconds < 0) {
    return 'Calculating...';
  }
  
  if (seconds === 0) {
    return 'Almost done';
  }
  
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m remaining`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s remaining`;
  } else {
    return `${secs}s remaining`;
  }
}

export function getBackupFileAge(file: BackupFile): string {
  const now = Date.now();
  const created = new Date(file.created_at).getTime();
  const diffMs = now - created;
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return new Date(file.created_at).toLocaleDateString();
}

export function validateBackupFile(file: File): { valid: boolean; error?: string } {
  // Check file extension
  if (!file.name.endsWith('.json')) {
    return { valid: false, error: 'File must be a JSON file' };
  }
  
  // Check file size (max 100MB)
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 100MB limit' };
  }
  
  return { valid: true };
}
