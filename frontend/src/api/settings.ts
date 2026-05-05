import { apiClient, ApiRequestConfig } from './client';

// ============================================================================
// Types
// ============================================================================

export interface JellyfinConnection {
  url: string;
  api_key: string;
  verify_ssl?: boolean;
}

export interface JellyfinStatus {
  connected: boolean;
  server_name?: string;
  version?: string;
  os?: string;
  id?: string;
  last_check?: string;
  error?: string;
}

export interface GeneralSettings {
  dashboard_refresh_interval: number; // seconds
  history_retention_days: number;
  library_sync_interval: number; // minutes
  user_sync_interval: number; // minutes
  recently_added_sync_interval: number; // minutes
  log_level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  timezone: string;
}

export interface AppSettings {
  jellyfin?: JellyfinConnection;
  general?: GeneralSettings;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  server_info?: {
    name: string;
    version: string;
    os: string;
    id: string;
  };
  error?: string;
}

export interface BackupResponse {
  success: boolean;
  message: string;
  backup_path?: string;
  error?: string;
}

export interface RestoreResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface SystemInfo {
  jellyview_version: string;
  jellyfin_version?: string;
  jellyfin_connected: boolean;
  database_size: number; // bytes
  database_path: string;
  uptime: number; // seconds
  start_time: string;
  os_info?: string;
  python_version?: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
}

export interface LogParams extends Record<string, unknown> {
  level?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  limit?: number;
  start_time?: string;
  end_time?: string;
  search?: string;
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * Get all settings
 */
export async function getSettings(
  config?: ApiRequestConfig
): Promise<AppSettings> {
  return apiClient.get<AppSettings>('/settings', undefined, config);
}

/**
 * Update settings
 */
export async function updateSettings(
  settings: Partial<AppSettings>,
  config?: ApiRequestConfig
): Promise<AppSettings> {
  return apiClient.put<AppSettings>('/settings', settings, config);
}

/**
 * Update Jellyfin connection settings
 */
export async function updateJellyfinConnection(
  connection: JellyfinConnection,
  config?: ApiRequestConfig
): Promise<void> {
  await updateSettings({ jellyfin: connection }, config);
}

/**
 * Update general settings
 */
export async function updateGeneralSettings(
  settings: GeneralSettings,
  config?: ApiRequestConfig
): Promise<void> {
  await updateSettings({ general: settings }, config);
}

/**
 * Test Jellyfin connection
 */
export async function testJellyfinConnection(
  config?: ApiRequestConfig
): Promise<TestConnectionResponse> {
  return apiClient.get<TestConnectionResponse>('/settings/jellyfin/test', undefined, config);
}

/**
 * Get Jellyfin connection status
 */
export async function getJellyfinStatus(
  config?: ApiRequestConfig
): Promise<JellyfinStatus> {
  return apiClient.get<JellyfinStatus>('/auth/status', undefined, config);
}

/**
 * Create database backup
 */
export async function createBackup(
  config?: ApiRequestConfig
): Promise<BackupResponse> {
  return apiClient.post<BackupResponse>('/settings/backup', undefined, config);
}

/**
 * Restore database from backup
 */
export async function restoreBackup(
  backupPath: string,
  config?: ApiRequestConfig
): Promise<RestoreResponse> {
  return apiClient.post<RestoreResponse>('/settings/restore', { backup_path: backupPath }, config);
}

/**
 * Get system information
 */
export async function getSystemInfo(
  config?: ApiRequestConfig
): Promise<SystemInfo> {
  return apiClient.get<SystemInfo>('/settings/system', undefined, config);
}

/**
 * Get application logs
 */
export async function getLogs(
  params?: LogParams,
  config?: ApiRequestConfig
): Promise<LogEntry[]> {
  return apiClient.get<LogEntry[]>('/settings/logs', params, config);
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Check if Jellyfin is connected
 */
export async function checkJellyfinConnected(
  config?: ApiRequestConfig
): Promise<boolean> {
  const status = await getJellyfinStatus(config);
  return status.connected;
}

/**
 * Set dashboard refresh interval
 */
export async function setDashboardRefreshInterval(
  interval: number, // seconds
  config?: ApiRequestConfig
): Promise<void> {
  const settings = await getSettings(config);
  await updateGeneralSettings(
    {
      ...settings.general!,
      dashboard_refresh_interval: interval,
    },
    config
  );
}

/**
 * Set history retention period
 */
export async function setHistoryRetentionDays(
  days: number,
  config?: ApiRequestConfig
): Promise<void> {
  const settings = await getSettings(config);
  await updateGeneralSettings(
    {
      ...settings.general!,
      history_retention_days: days,
    },
    config
  );
}

/**
 * Set library sync interval
 */
export async function setLibrarySyncInterval(
  minutes: number,
  config?: ApiRequestConfig
): Promise<void> {
  const settings = await getSettings(config);
  await updateGeneralSettings(
    {
      ...settings.general!,
      library_sync_interval: minutes,
    },
    config
  );
}

/**
 * Set user sync interval
 */
export async function setUserSyncInterval(
  minutes: number,
  config?: ApiRequestConfig
): Promise<void> {
  const settings = await getSettings(config);
  await updateGeneralSettings(
    {
      ...settings.general!,
      user_sync_interval: minutes,
    },
    config
  );
}

/**
 * Set log level
 */
export async function setLogLevel(
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR',
  config?: ApiRequestConfig
): Promise<void> {
  const settings = await getSettings(config);
  await updateGeneralSettings(
    {
      ...settings.general!,
      log_level: level,
    },
    config
  );
}

/**
 * Get recent error logs
 */
export async function getErrorLogs(
  limit: number = 50,
  config?: ApiRequestConfig
): Promise<LogEntry[]> {
  return getLogs({ level: 'ERROR', limit }, config);
}

/**
 * Search logs for a specific message
 */
export async function searchLogs(
  query: string,
  limit: number = 100,
  config?: ApiRequestConfig
): Promise<LogEntry[]> {
  return getLogs({ search: query, limit }, config);
}

// ============================================================================
// Type Guards and Helpers
// ============================================================================

export function isConnectionSuccessful(status: JellyfinStatus): boolean {
  return status.connected && !!status.server_name;
}

export function formatDatabaseSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export function getLogLevelColor(level: string): string {
  switch (level) {
    case 'ERROR':
      return 'text-red-500';
    case 'WARNING':
      return 'text-yellow-500';
    case 'INFO':
      return 'text-blue-500';
    case 'DEBUG':
      return 'text-gray-500';
    default:
      return 'text-gray-500';
  }
}

export function getLogLevelBadgeColor(level: string): string {
  switch (level) {
    case 'ERROR':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'WARNING':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'INFO':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'DEBUG':
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
}

export function isValidJellyfinUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidApiKey(apiKey: string): boolean {
  return apiKey.length >= 16;
}

export function normalizeJellyfinUrl(url: string): string {
  let normalized = url.trim();
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'http://' + normalized;
  }
  
  return normalized;
}

export function getJellyfinVersion(version?: string): string {
  if (!version) return 'Unknown';
  
  // Extract major.minor if version includes build numbers
  const match = version.match(/^(\d+\.\d+\.\d+)/);
  return match ? match[1] : version;
}

export function getBackupResponseMessage(response: BackupResponse): string {
  if (response.success) {
    return `Backup created successfully at ${response.backup_path}`;
  } else {
    return `Backup failed: ${response.error || 'Unknown error'}`;
  }
}

export function getRestoreResponseMessage(response: RestoreResponse): string {
  if (response.success) {
    return 'Restore completed successfully';
  } else {
    return `Restore failed: ${response.error || 'Unknown error'}`;
  }
}

export function getTestConnectionMessage(response: TestConnectionResponse): string {
  if (response.success) {
    const serverInfo = response.server_info;
    return `Connected to ${serverInfo?.name || 'Jellyfin'} (version ${serverInfo?.version || 'unknown'})`;
  } else {
    return `Connection failed: ${response.error || 'Unknown error'}`;
  }
}
