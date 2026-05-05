import { apiClient, ApiRequestConfig } from './client';

// ============================================================================
// Types
// ============================================================================

export interface Session {
  id: string;
  jellyfin_session_id: string;
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
    backdrop_url?: string;
    year?: number;
    runtime_ticks?: number;
  };
  library_id?: number;
  library?: {
    id: number;
    name: string;
  };
  state: 'playing' | 'paused' | 'buffering' | 'stopped';
  progress_pct: number;
  buffer_count: number;
  started_at: string;
  last_updated: string;
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
  // For episodes
  series_name?: string;
  season_number?: number;
  episode_number?: number;
}

export interface SessionCommand {
  command: 'Stop' | 'Pause' | 'Unpause' | 'Seek' | 'PlayNext';
  position_ticks?: number;
}

export interface SessionMessage {
  text: string;
  timeout_ms?: number;
}

export interface SessionStats {
  total_sessions: number;
  playing_sessions: number;
  paused_sessions: number;
  buffering_sessions: number;
  transcode_count: number;
  direct_play_count: number;
  total_bandwidth?: number; // bytes per second
}

export interface SessionsListParams extends Record<string, unknown> {
  user_id?: number;
  library_id?: number;
  state?: 'playing' | 'paused' | 'buffering';
  transcode_only?: boolean;
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * List all active sessions
 */
export async function listSessions(
  params?: SessionsListParams,
  config?: ApiRequestConfig
): Promise<Session[]> {
  return apiClient.get<Session[]>('/sessions', params, config);
}

/**
 * Get session detail by ID
 */
export async function getSession(
  id: string,
  config?: ApiRequestConfig
): Promise<Session> {
  return apiClient.get<Session>(`/sessions/${id}`, undefined, config);
}

/**
 * Send a playstate command to a session
 */
export async function sendSessionCommand(
  id: string,
  command: SessionCommand,
  config?: ApiRequestConfig
): Promise<void> {
  await apiClient.post<void>(`/sessions/${id}/command`, command, config);
}

/**
 * Send a message to the client session
 */
export async function sendSessionMessage(
  id: string,
  message: SessionMessage,
  config?: ApiRequestConfig
): Promise<void> {
  await apiClient.post<void>(`/sessions/${id}/message`, message, config);
}

/**
 * Stop a session
 */
export async function stopSession(
  id: string,
  config?: ApiRequestConfig
): Promise<void> {
  return sendSessionCommand(id, { command: 'Stop' }, config);
}

/**
 * Pause a session
 */
export async function pauseSession(
  id: string,
  config?: ApiRequestConfig
): Promise<void> {
  return sendSessionCommand(id, { command: 'Pause' }, config);
}

/**
 * Unpause/resume a session
 */
export async function unpauseSession(
  id: string,
  config?: ApiRequestConfig
): Promise<void> {
  return sendSessionCommand(id, { command: 'Unpause' }, config);
}

/**
 * Seek to position in session
 */
export async function seekSession(
  id: string,
  positionTicks: number,
  config?: ApiRequestConfig
): Promise<void> {
  return sendSessionCommand(id, { command: 'Seek', position_ticks: positionTicks }, config);
}

/**
 * Get session statistics
 */
export async function getSessionStats(
  config?: ApiRequestConfig
): Promise<SessionStats> {
  return apiClient.get<SessionStats>('/sessions/stats', undefined, config);
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Get only currently playing sessions
 */
export async function getPlayingSessions(
  config?: ApiRequestConfig
): Promise<Session[]> {
  return listSessions({ state: 'playing' }, config);
}

/**
 * Get only transcoding sessions
 */
export async function getTranscodingSessions(
  config?: ApiRequestConfig
): Promise<Session[]> {
  return listSessions({ transcode_only: true }, config);
}

/**
 * Get sessions for a specific user
 */
export async function getUserSessions(
  userId: number,
  config?: ApiRequestConfig
): Promise<Session[]> {
  return listSessions({ user_id: userId }, config);
}

/**
 * Get sessions from a specific library
 */
export async function getLibrarySessions(
  libraryId: number,
  config?: ApiRequestConfig
): Promise<Session[]> {
  return listSessions({ library_id: libraryId }, config);
}

// ============================================================================
// Type Guards
// ============================================================================

export function isPlaying(session: Session): boolean {
  return session.state === 'playing';
}

export function isPaused(session: Session): boolean {
  return session.state === 'paused';
}

export function isBuffering(session: Session): boolean {
  return session.state === 'buffering';
}

export function isTranscoding(session: Session): boolean {
  return session.transcode;
}

export function isVideo(session: Session): boolean {
  return session.media_type === 'Video';
}

export function isAudio(session: Session): boolean {
  return session.media_type === 'Audio';
}

export function isEpisode(session: Session): boolean {
  return session.item.item_type === 'Episode';
}

export function getProgressPercentage(session: Session): number {
  return Math.round(session.progress_pct * 100) / 100;
}

export function getQualityLabel(session: Session): string {
  if (!session.width || !session.height) {
    return 'Unknown';
  }
  return `${session.width}x${session.height}`;
}

export function getTranscodeLabel(session: Session): string | null {
  if (!session.transcode) {
    return null;
  }
  const reason = session.transcode_reason || 'Transcoding';
  const hw = session.transcode_hw ? ` (${session.transcode_hw})` : '';
  return `${reason}${hw}`;
}
