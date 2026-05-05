import { apiClient, ApiRequestConfig, PaginatedResponse, PaginationParams } from './client';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: number;
  jellyfin_id: string;
  username: string;
  is_admin: boolean;
  last_active?: string;
  avatar_url?: string;
  total_plays: number;
  total_watch_time: number; // in seconds
  created_at: string;
  updated_at: string;
}

export interface UserDetail extends User {
  // Statistics
  total_items_watched: number;
  favorite_count: number;
  avg_watch_time: number; // in seconds
  first_play_date?: string;
  last_play_date?: string;
  // Recent activity
  recent_sessions?: number;
  active_session?: {
    id: string;
    item_name: string;
    started_at: string;
  };
}

export interface UserDevice {
  id: number;
  user_id: number;
  client: string;
  device: string;
  device_id?: string;
  ip_address?: string;
  last_seen: string;
  play_count: number;
}

export interface UserLibraryActivity {
  library_id: number;
  library_name: string;
  total_plays: number;
  total_watch_time: number;
  item_count: number;
}

export interface UserStats {
  user_id: number;
  username: string;
  // Time series data
  plays_over_time: Array<{
    date: string;
    plays: number;
    watch_time: number;
  }>;
  // By day of week
  plays_by_day: Array<{
    day: number; // 0-6 (Sunday-Saturday)
    day_name: string;
    plays: number;
    watch_time: number;
  }>;
  // By hour of day
  plays_by_hour: Array<{
    hour: number; // 0-23
    plays: number;
    watch_time: number;
  }>;
  // Top items
  top_items: Array<{
    item_id: number;
    name: string;
    item_type: string;
    poster_url?: string;
    plays: number;
    watch_time: number;
    last_played: string;
  }>;
}

export interface UserHistoryParams extends PaginationParams, Record<string, unknown> {
  start_date?: string;
  end_date?: string;
  library_id?: number;
  media_type?: string;
}

export interface UserListParams extends PaginationParams, Record<string, unknown> {
  search?: string;
  sort_by?: 'username' | 'plays' | 'watch_time' | 'last_active';
  sort_order?: 'asc' | 'desc';
  min_plays?: number;
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * List all users
 */
export async function listUsers(
  params?: UserListParams,
  config?: ApiRequestConfig
): Promise<User[]> {
  return apiClient.get<User[]>('/users', params, config);
}

/**
 * Get paginated users
 */
export async function listUsersPaginated(
  params?: UserListParams,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<User>> {
  return apiClient.getPaginated<User>('/users', params, config);
}

/**
 * Get user detail with full statistics
 */
export async function getUserDetail(
  id: number,
  config?: ApiRequestConfig
): Promise<UserDetail> {
  return apiClient.get<UserDetail>(`/users/${id}`, undefined, config);
}

/**
 * Get user's watch history (paginated)
 */
export async function getUserHistory(
  id: number,
  params?: UserHistoryParams,
  config?: ApiRequestConfig
): Promise<any[]> {
  return apiClient.get<any[]>(`/users/${id}/history`, params, config);
}

/**
 * Get user's watch history (paginated response)
 */
export async function getUserHistoryPaginated(
  id: number,
  params?: UserHistoryParams,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<any>> {
  return apiClient.getPaginated<any>(`/users/${id}/history`, params, config);
}

/**
 * Get user's devices and IP addresses
 */
export async function getUserDevices(
  id: number,
  config?: ApiRequestConfig
): Promise<UserDevice[]> {
  return apiClient.get<UserDevice[]>(`/users/${id}/devices`, undefined, config);
}

/**
 * Get user watch statistics with charts
 */
export async function getUserStats(
  id: number,
  config?: ApiRequestConfig
): Promise<UserStats> {
  return apiClient.get<UserStats>(`/users/${id}/stats`, undefined, config);
}

/**
 * Get user library activity breakdown
 */
export async function getUserLibraryActivity(
  id: number,
  config?: ApiRequestConfig
): Promise<UserLibraryActivity[]> {
  return apiClient.get<UserLibraryActivity[]>(`/users/${id}/libraries`, undefined, config);
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Search users by username
 */
export async function searchUsers(
  query: string,
  config?: ApiRequestConfig
): Promise<User[]> {
  return listUsers({ search: query }, config);
}

/**
 * Get top users by play count
 */
export async function getTopUsersByPlays(
  limit: number = 10,
  config?: ApiRequestConfig
): Promise<User[]> {
  return listUsers({ sort_by: 'plays', sort_order: 'desc', limit }, config);
}

/**
 * Get top users by watch time
 */
export async function getTopUsersByWatchTime(
  limit: number = 10,
  config?: ApiRequestConfig
): Promise<User[]> {
  return listUsers({ sort_by: 'watch_time', sort_order: 'desc', limit }, config);
}

/**
 * Get recently active users
 */
export async function getRecentlyActiveUsers(
  limit: number = 10,
  config?: ApiRequestConfig
): Promise<User[]> {
  return listUsers({ sort_by: 'last_active', sort_order: 'desc', limit }, config);
}

// ============================================================================
// Type Guards and Helpers
// ============================================================================

export function isAdmin(user: User): boolean {
  return user.is_admin;
}

export function isActiveUser(user: User): boolean {
  if (!user.last_active) {
    return false;
  }
  const lastActive = new Date(user.last_active);
  const hoursSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60);
  return hoursSinceActive < 24;
}

export function formatWatchTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours === 0) {
    return `${minutes}m`;
  } else if (hours === 1) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${hours}h ${minutes}m`;
  }
}

export function formatWatchTimeDetailed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours === 0) {
    return `${minutes} minutes`;
  } else if (hours === 1) {
    return `${hours} hour ${minutes} minutes`;
  } else {
    return `${hours} hours ${minutes} minutes`;
  }
}

export function getLastActiveText(user: User): string {
  if (!user.last_active) {
    return 'Never';
  }
  
  const lastActive = new Date(user.last_active);
  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return lastActive.toLocaleDateString();
  }
}

export function getUserInitials(username: string): string {
  const parts = username.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
