import { apiClient, ApiRequestConfig, PaginatedResponse, PaginationParams } from './client';

// ============================================================================
// Types
// ============================================================================

export interface HistoryRecord {
  id: number;
  jellyfin_id?: string;
  user_id: number;
  user: {
    id: number;
    username: string;
    avatar_url?: string;
  };
  item_id: number;
  item: {
    id: number;
    name: string;
    item_type: string;
    poster_url?: string;
    year?: number;
  };
  library_id: number;
  library: {
    id: number;
    name: string;
  };
  started_at: string;
  stopped_at?: string;
  duration: number; // seconds watched
  paused_duration: number; // seconds paused
  play_count: number;
  completion_pct: number;
  // Playback info
  client: string;
  device: string;
  device_id?: string;
  ip_address?: string;
  // Stream quality
  video_codec?: string;
  audio_codec?: string;
  container?: string;
  width?: number;
  height?: number;
  bitrate?: number;
  transcode: boolean;
  transcode_reason?: string;
  transcode_hw?: string;
  media_type: 'Video' | 'Audio';
  // Metadata
  item_name: string;
  item_type: string;
  series_name?: string;
  season_number?: number;
  episode_number?: number;
  year?: number;
  playback_position_ticks?: number;
  created_at: string;
}

export interface HistoryStats {
  total_plays: number;
  total_watch_time: number; // seconds
  total_users: number;
  total_items: number;
  avg_watch_time: number; // seconds
  avg_completion_pct: number;
  // Breakdown by type
  plays_by_type: Array<{
    item_type: string;
    count: number;
    watch_time: number;
  }>;
  // Transcode stats
  transcode_count: number;
  direct_play_count: number;
  transcode_percentage: number;
}

export interface HistoryStatsByDay {
  date: string;
  plays: number;
  watch_time: number;
  unique_users: number;
  avg_completion: number;
}

export interface HistoryStatsByUser {
  user_id: number;
  username: string;
  avatar_url?: string;
  plays: number;
  watch_time: number;
  avg_completion: number;
}

export interface HistoryStatsByDevice {
  client: string;
  device: string;
  plays: number;
  watch_time: number;
  unique_users: number;
}

export interface HistoryListParams extends PaginationParams, Record<string, unknown> {
  user_id?: number;
  library_id?: number;
  item_id?: number;
  media_type?: 'Video' | 'Audio';
  start_date?: string;
  end_date?: string;
  client?: string;
  device?: string;
  transcode?: boolean;
  sort_by?: 'started_at' | 'duration' | 'completion_pct' | 'bitrate';
  sort_order?: 'asc' | 'desc';
}

export interface HistoryStatsParams extends Record<string, unknown> {
  start_date?: string;
  end_date?: string;
  user_id?: number;
  library_id?: number;
}

export interface HistoryExportParams {
  format: 'csv' | 'json';
  start_date?: string;
  end_date?: string;
  user_id?: number;
  library_id?: number;
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * Get paginated history with filters
 */
export async function listHistory(
  params?: HistoryListParams,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<HistoryRecord>> {
  return apiClient.getPaginated<HistoryRecord>('/history', params, config);
}

/**
 * Get historical statistics
 */
export async function getHistoryStats(
  params?: HistoryStatsParams,
  config?: ApiRequestConfig
): Promise<HistoryStats> {
  return apiClient.get<HistoryStats>('/history/stats', params, config);
}

/**
 * Get daily plays chart data
 */
export async function getHistoryStatsByDay(
  params?: HistoryStatsParams & { days?: number },
  config?: ApiRequestConfig
): Promise<HistoryStatsByDay[]> {
  return apiClient.get<HistoryStatsByDay[]>('/history/stats/by-day', params, config);
}

/**
 * Get user comparison chart data
 */
export async function getHistoryStatsByUser(
  params?: HistoryStatsParams,
  config?: ApiRequestConfig
): Promise<HistoryStatsByUser[]> {
  return apiClient.get<HistoryStatsByUser[]>('/history/stats/by-user', params, config);
}

/**
 * Get device breakdown chart data
 */
export async function getHistoryStatsByDevice(
  params?: HistoryStatsParams,
  config?: ApiRequestConfig
): Promise<HistoryStatsByDevice[]> {
  return apiClient.get<HistoryStatsByDevice[]>('/history/stats/by-device', params, config);
}

/**
 * Export history to CSV or JSON
 */
export async function exportHistory(
  params: HistoryExportParams,
  _config?: ApiRequestConfig
): Promise<Blob> {
  const filename = `jellyview-history-${new Date().toISOString().split('T')[0]}.${params.format}`;
  return apiClient.downloadFile(`/history/export?format=${params.format}&${new URLSearchParams(params as any).toString()}`, filename);
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Get history for a specific user
 */
export async function getUserHistory(
  userId: number,
  params?: Omit<HistoryListParams, 'user_id'>,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<HistoryRecord>> {
  return listHistory({ ...params, user_id: userId }, config);
}

/**
 * Get history for a specific library
 */
export async function getLibraryHistory(
  libraryId: number,
  params?: Omit<HistoryListParams, 'library_id'>,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<HistoryRecord>> {
  return listHistory({ ...params, library_id: libraryId }, config);
}

/**
 * Get history for a specific item
 */
export async function getItemHistory(
  itemId: number,
  params?: Omit<HistoryListParams, 'item_id'>,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<HistoryRecord>> {
  return listHistory({ ...params, item_id: itemId }, config);
}

/**
 * Get history within a date range
 */
export async function getHistoryByDateRange(
  startDate: string,
  endDate: string,
  params?: Omit<HistoryListParams, 'start_date' | 'end_date'>,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<HistoryRecord>> {
  return listHistory({ ...params, start_date: startDate, end_date: endDate }, config);
}

/**
 * Get only transcoded streams
 */
export async function getTranscodedHistory(
  params?: Omit<HistoryListParams, 'transcode'>,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<HistoryRecord>> {
  return listHistory({ ...params, transcode: true }, config);
}

/**
 * Get only direct play streams
 */
export async function getDirectPlayHistory(
  params?: Omit<HistoryListParams, 'transcode'>,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<HistoryRecord>> {
  return listHistory({ ...params, transcode: false }, config);
}

/**
 * Get daily stats for last N days
 */
export async function getDailyStatsLastNDays(
  days: number,
  config?: ApiRequestConfig
): Promise<HistoryStatsByDay[]> {
  return getHistoryStatsByDay({ days }, config);
}

// ============================================================================
// Type Guards and Helpers
// ============================================================================

export function isVideoRecord(record: HistoryRecord): boolean {
  return record.media_type === 'Video';
}

export function isAudioRecord(record: HistoryRecord): boolean {
  return record.media_type === 'Audio';
}

export function isTranscodedRecord(record: HistoryRecord): boolean {
  return record.transcode;
}

export function isCompleted(record: HistoryRecord): boolean {
  return record.completion_pct >= 90;
}

export function isFullyWatched(record: HistoryRecord): boolean {
  return record.completion_pct >= 100;
}

export function isPartialWatch(record: HistoryRecord): boolean {
  return record.completion_pct < 90 && record.completion_pct >= 10;
}

export function isAbandoned(record: HistoryRecord): boolean {
  return record.completion_pct < 10;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export function formatDurationShort(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export function getCompletionLabel(completionPct: number): string {
  if (completionPct >= 100) return 'Completed';
  if (completionPct >= 90) return 'Almost done';
  if (completionPct >= 50) return 'Halfway';
  if (completionPct >= 25) return 'Started';
  return 'Barely started';
}

export function getCompletionColor(completionPct: number): string {
  if (completionPct >= 100) return 'text-green-500';
  if (completionPct >= 90) return 'text-green-400';
  if (completionPct >= 50) return 'text-yellow-500';
  if (completionPct >= 25) return 'text-orange-500';
  return 'text-red-500';
}

export function getStreamTypeLabel(record: HistoryRecord): string {
  if (!record.transcode) {
    return 'Direct Play';
  }
  const reason = record.transcode_reason || 'Transcode';
  const hw = record.transcode_hw ? ` (${record.transcode_hw})` : '';
  return `${reason}${hw}`;
}

export function getQualityLabel(record: HistoryRecord): string {
  if (!record.width || !record.height) {
    return 'Unknown';
  }
  const width = record.width;
  const height = record.height;
  
  if (width >= 3840 || height >= 2160) return '4K';
  if (width >= 2560 || height >= 1440) return '1440p';
  if (width >= 1920 || height >= 1080) return '1080p';
  if (width >= 1280 || height >= 720) return '720p';
  if (width >= 854 || height >= 480) return '480p';
  if (width >= 640 || height >= 360) return '360p';
  return `${height}p`;
}

export function getBitrateLabel(bitrate?: number): string {
  if (!bitrate) return 'Unknown';
  
  const mbps = bitrate / 1000000;
  if (mbps >= 1) {
    return `${mbps.toFixed(1)} Mbps`;
  } else {
    return `${Math.round(bitrate / 1000)} Kbps`;
  }
}

export function getEpisodeLabel(record: HistoryRecord): string | null {
  if (record.item_type !== 'Episode') {
    return null;
  }
  const season = record.season_number ?? '?';
  const episode = record.episode_number ?? '?';
  return `S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
}

export function groupHistoryByDate(records: HistoryRecord[]): Map<string, HistoryRecord[]> {
  const grouped = new Map<string, HistoryRecord[]>();
  
  for (const record of records) {
    const date = new Date(record.started_at).toDateString();
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(record);
  }
  
  return grouped;
}
