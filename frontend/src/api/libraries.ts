import { apiClient, ApiRequestConfig, PaginatedResponse, PaginationParams } from './client';

// ============================================================================
// Types
// ============================================================================

export interface Library {
  id: number;
  jellyfin_id: string;
  name: string;
  item_type: string; // movies, tvshows, music, books, etc.
  total_items: number;
  total_size: number; // bytes
  created_at: string;
  updated_at: string;
}

export interface LibraryDetail extends Library {
  // Statistics
  total_plays: number;
  total_watch_time: number; // seconds
  // Counts by type
  movie_count?: number;
  series_count?: number;
  episode_count?: number;
  // Date range
  newest_item_date?: string;
  oldest_item_date?: string;
  // Top content
  top_genres?: Array<{
    name: string;
    count: number;
  }>;
  top_studios?: Array<{
    name: string;
    count: number;
  }>;
}

export interface LibraryStats {
  library_id: number;
  library_name: string;
  // Time series
  plays_over_time: Array<{
    date: string;
    plays: number;
    watch_time: number;
  }>;
  // By genre
  plays_by_genre: Array<{
    genre: string;
    plays: number;
    watch_time: number;
  }>;
  // By rating
  rating_distribution: Array<{
    rating_range: string;
    count: number;
  }>;
  // By year
  items_by_year: Array<{
    year: number;
    count: number;
    plays: number;
  }>;
}

export interface LibraryItem {
  id: number;
  jellyfin_id: string;
  library_id: number;
  item_type: string; // Movie, Series, Episode, Audio, etc.
  name: string;
  sort_name?: string;
  year?: number;
  premiere_date?: string;
  rating?: number;
  community_rating?: number;
  official_rating?: string; // PG, PG-13, R, etc.
  runtime_ticks?: number;
  genres: string[]; // parsed from JSON
  studios: string[]; // parsed from JSON
  poster_url?: string;
  backdrop_url?: string;
  // For episodes
  series_id?: number;
  series_name?: string;
  season_number?: number;
  episode_number?: number;
  added_at: string;
  created_at: string;
  updated_at: string;
}

export interface LibraryItemsParams extends PaginationParams, Record<string, unknown> {
  search?: string;
  genre?: string;
  studio?: string;
  year?: number;
  rating_min?: number;
  sort_by?: 'name' | 'date_added' | 'rating' | 'plays' | 'year';
  sort_order?: 'asc' | 'desc';
  media_type?: string;
}

export interface LibraryRecentlyAddedParams extends PaginationParams, Record<string, unknown> {
  limit?: number;
}

export interface LibraryMostPlayedParams extends PaginationParams, Record<string, unknown> {
  limit?: number;
  period?: '7d' | '30d' | '90d' | 'all';
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * List all libraries
 */
export async function listLibraries(
  config?: ApiRequestConfig
): Promise<Library[]> {
  return apiClient.get<Library[]>('/libraries', undefined, config);
}

/**
 * Get library detail with statistics
 */
export async function getLibraryDetail(
  id: number,
  config?: ApiRequestConfig
): Promise<LibraryDetail> {
  return apiClient.get<LibraryDetail>(`/libraries/${id}`, undefined, config);
}

/**
 * Get library statistics with charts
 */
export async function getLibraryStats(
  id: number,
  config?: ApiRequestConfig
): Promise<LibraryStats> {
  return apiClient.get<LibraryStats>(`/libraries/${id}/stats`, undefined, config);
}

/**
 * Get recently added items from a library
 */
export async function getLibraryRecentlyAdded(
  id: number,
  params?: LibraryRecentlyAddedParams,
  config?: ApiRequestConfig
): Promise<LibraryItem[]> {
  return apiClient.get<LibraryItem[]>(`/libraries/${id}/recently-added`, params, config);
}

/**
 * Get most played items from a library
 */
export async function getLibraryMostPlayed(
  id: number,
  params?: LibraryMostPlayedParams,
  config?: ApiRequestConfig
): Promise<any[]> {
  return apiClient.get<any[]>(`/libraries/${id}/most-played`, params, config);
}

/**
 * Browse library items (paginated)
 */
export async function getLibraryItems(
  id: number,
  params?: LibraryItemsParams,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<LibraryItem>> {
  return apiClient.getPaginated<LibraryItem>(`/libraries/${id}/items`, params, config);
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Get movie libraries only
 */
export async function getMovieLibraries(config?: ApiRequestConfig): Promise<Library[]> {
  const libraries = await listLibraries(config);
  return libraries.filter(lib => lib.item_type === 'movies');
}

/**
 * Get TV show libraries only
 */
export async function getTVShowLibraries(config?: ApiRequestConfig): Promise<Library[]> {
  const libraries = await listLibraries(config);
  return libraries.filter(lib => lib.item_type === 'tvshows');
}

/**
 * Get music libraries only
 */
export async function getMusicLibraries(config?: ApiRequestConfig): Promise<Library[]> {
  const libraries = await listLibraries(config);
  return libraries.filter(lib => lib.item_type === 'music');
}

/**
 * Get most played library by plays
 */
export async function getTopLibraryByPlays(
  limit: number = 5,
  config?: ApiRequestConfig
): Promise<LibraryDetail[]> {
  const libraries = await listLibraries(config);
  const libraryDetails = await Promise.all(
    libraries.map(lib => getLibraryDetail(lib.id, config))
  );
  
  return libraryDetails
    .sort((a, b) => b.total_plays - a.total_plays)
    .slice(0, limit);
}

// ============================================================================
// Type Guards and Helpers
// ============================================================================

export function isMovieLibrary(library: Library): boolean {
  return library.item_type === 'movies';
}

export function isTVShowLibrary(library: Library): boolean {
  return library.item_type === 'tvshows';
}

export function isMusicLibrary(library: Library): boolean {
  return library.item_type === 'music';
}

export function getLibraryIcon(itemType: string): string {
  switch (itemType) {
    case 'movies':
      return '🎬';
    case 'tvshows':
      return '📺';
    case 'music':
      return '🎵';
    case 'books':
      return '📚';
    case 'photos':
      return '📷';
    default:
      return '📁';
  }
}

export function formatLibrarySize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function getLibraryTypeLabel(itemType: string): string {
  switch (itemType) {
    case 'movies':
      return 'Movies';
    case 'tvshows':
      return 'TV Shows';
    case 'music':
      return 'Music';
    case 'books':
      return 'Books';
    case 'photos':
      return 'Photos';
    case 'mixed':
      return 'Mixed';
    default:
      return itemType.charAt(0).toUpperCase() + itemType.slice(1);
  }
}

// ============================================================================
// Item Type Guards
// ============================================================================

export function isMovie(item: LibraryItem): boolean {
  return item.item_type === 'Movie';
}

export function isSeries(item: LibraryItem): boolean {
  return item.item_type === 'Series';
}

export function isEpisode(item: LibraryItem): boolean {
  return item.item_type === 'Episode';
}

export function isAudio(item: LibraryItem): boolean {
  return item.item_type === 'Audio';
}

export function getEpisodeLabel(item: LibraryItem): string | null {
  if (!isEpisode(item)) {
    return null;
  }
  const season = item.season_number ?? '?';
  const episode = item.episode_number ?? '?';
  return `S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
}

export function formatRuntime(ticks: number): string {
  const seconds = ticks / 10000000;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours === 0) {
    return `${minutes}m`;
  } else {
    return `${hours}h ${minutes}m`;
  }
}

export function getRatingColor(rating: number): string {
  if (rating >= 8) return 'text-green-500';
  if (rating >= 6) return 'text-yellow-500';
  if (rating >= 4) return 'text-orange-500';
  return 'text-red-500';
}
