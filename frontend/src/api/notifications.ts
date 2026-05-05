import { apiClient, ApiRequestConfig, PaginatedResponse, PaginationParams } from './client';

// ============================================================================
// Types
// ============================================================================

export type NotifierType = 'telegram' | 'discord' | 'email' | 'webhook' | 'pushover';

export type EventType =
  | 'stream_start'
  | 'stream_stop'
  | 'stream_pause'
  | 'stream_resume'
  | 'transcoding_start'
  | 'transcoding_hw'
  | 'item_added'
  | 'user_created'
  | 'server_update_available'
  | 'server_down'
  | 'server_up';

export type NotificationStatus = 'pending' | 'sent' | 'failed';

// ============================================================================
// Notifiers
// ============================================================================

export interface NotifierConfig {
  [key: string]: unknown;
}

export interface TelegramNotifierConfig extends NotifierConfig {
  bot_token: string;
  chat_id: string;
  parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  include_poster?: boolean;
}

export interface DiscordNotifierConfig extends NotifierConfig {
  webhook_url: string;
  include_poster?: boolean;
  color?: number; // Discord embed color
}

export interface EmailNotifierConfig extends NotifierConfig {
  smtp_server: string;
  smtp_port: number;
  username: string;
  password: string;
  from_address: string;
  to_addresses: string[];
  use_tls?: boolean;
}

export interface WebhookNotifierConfig extends NotifierConfig {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  body_template?: string;
}

export interface PushoverNotifierConfig extends NotifierConfig {
  app_token: string;
  user_key: string;
  device?: string;
  sound?: string;
  priority?: 'low' | 'normal' | 'high' | 'emergency';
  retry?: number;  // For priority=emergency, seconds between retries (30-86400)
  expire?: number; // For priority=emergency, expiry in seconds (0-86400)
}

export interface Notifier {
  id: number;
  name: string;
  type: NotifierType;
  enabled: boolean;
  config: NotifierConfig;
  created_at: string;
  updated_at: string;
}

export interface CreateNotifier {
  name: string;
  type: NotifierType;
  config: NotifierConfig;
  enabled?: boolean;
}

export interface UpdateNotifier {
  name?: string;
  type?: NotifierType;
  config?: NotifierConfig;
  enabled?: boolean;
}

export interface TestNotifierResponse {
  success: boolean;
  message: string;
  error?: string;
}

// ============================================================================
// Notification Rules
// ============================================================================

export interface NotificationRule {
  id: number;
  name: string;
  notifier_id: number;
  notifier?: Notifier;
  event_type: EventType;
  enabled: boolean;
  filters?: RuleFilters;
  template?: string;
  created_at: string;
}

export interface RuleFilters {
  user_id?: number;
  user_ids?: number[];
  library_id?: number;
  library_ids?: number[];
  media_type?: string;
  media_types?: string[];
  transcode_only?: boolean;
  completion_pct_min?: number;
  completion_pct_max?: number;
}

export interface CreateRule {
  name?: string;
  notifier_id: number;
  event_type: EventType;
  enabled?: boolean;
  filters?: RuleFilters;
  template?: string;
}

export interface UpdateRule extends Partial<CreateRule> {
  enabled?: boolean;
}

// ============================================================================
// Notification Log
// ============================================================================

export interface NotificationLog {
  id: number;
  notifier_id: number;
  notifier?: Notifier;
  rule_id: number;
  rule?: NotificationRule;
  event_type: EventType;
  event_data: Record<string, unknown>;
  status: NotificationStatus;
  error?: string;
  sent_at?: string;
  created_at: string;
}

export interface NotificationLogParams extends PaginationParams, Record<string, unknown> {
  notifier_id?: number;
  rule_id?: number;
  event_type?: EventType;
  status?: NotificationStatus;
  start_date?: string;
  end_date?: string;
}

export interface RetryNotificationResponse {
  success: boolean;
  message: string;
  log?: NotificationLog;
  error?: string;
}

// ============================================================================
// API Methods - Notifiers
// ============================================================================

/**
 * List all notifiers
 */
export async function listNotifiers(
  config?: ApiRequestConfig
): Promise<Notifier[]> {
  const response = await apiClient.get<any[]>('/notifications/notifiers', undefined, config);
  return response.map(mapNotifierResponse);
}

/**
 * Get paginated notifiers
 */
export async function listNotifiersPaginated(
  params?: PaginationParams,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<Notifier>> {
  return apiClient.getPaginated<Notifier>('/notifications/notifiers', params as PaginationParams & Record<string, unknown>, config);
}

/**
 * Create a new notifier
 */
export async function createNotifier(
  data: CreateNotifier,
  config?: ApiRequestConfig
): Promise<Notifier> {
  // Map frontend field names to backend field names
  const payload = {
    name: data.name,
    notifier_type: data.type,
    is_enabled: data.enabled ?? true,
    config: data.config,
  };
  const response = await apiClient.post<Notifier>('/notifications/notifiers', payload, config);
  return mapNotifierResponse(response);
}

/**
 * Update an existing notifier
 */
export async function updateNotifier(
  id: number,
  data: UpdateNotifier,
  config?: ApiRequestConfig
): Promise<Notifier> {
  // Map frontend field names to backend field names
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.type !== undefined) payload.notifier_type = data.type;
  if (data.enabled !== undefined) payload.is_enabled = data.enabled;
  if (data.config !== undefined) payload.config = data.config;
  const response = await apiClient.put<Notifier>(`/notifications/notifiers/${id}`, payload, config);
  return mapNotifierResponse(response);
}

/**
 * Delete a notifier
 */
export async function deleteNotifier(
  id: number,
  config?: ApiRequestConfig
): Promise<void> {
  await apiClient.delete<void>(`/notifications/notifiers/${id}`, config);
}

/**
 * Send a test notification
 */
export async function testNotifier(
  id: number,
  config?: ApiRequestConfig
): Promise<TestNotifierResponse> {
  return apiClient.post<TestNotifierResponse>(`/notifications/notifiers/${id}/test`, undefined, config);
}

// ============================================================================
// API Methods - Rules
// ============================================================================

/**
 * List all notification rules
 */
export async function listRules(
  config?: ApiRequestConfig
): Promise<NotificationRule[]> {
  const response = await apiClient.get<any[]>('/notifications/rules', undefined, config);
  return response.map(mapRuleResponse);
}

/**
 * Get paginated notification rules
 */
export async function listRulesPaginated(
  params?: PaginationParams,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<NotificationRule>> {
  return apiClient.getPaginated<NotificationRule>('/notifications/rules', params as PaginationParams & Record<string, unknown>, config);
}

/**
 * Create a new notification rule
 */
export async function createRule(
  data: CreateRule,
  config?: ApiRequestConfig
): Promise<NotificationRule> {
  // Map frontend field names to backend field names
  const payload = {
    name: data.name || data.event_type,
    rule_type: data.event_type,
    is_enabled: data.enabled ?? true,
    conditions: data.filters || {},
    notifier_ids: data.notifier_id ? [data.notifier_id] : [],
    template: data.template,
  };
  const response = await apiClient.post<any>('/notifications/rules', payload, config);
  return mapRuleResponse(response);
}

/**
 * Update an existing notification rule
 */
export async function updateRule(
  id: number,
  data: UpdateRule,
  config?: ApiRequestConfig
): Promise<NotificationRule> {
  // Map frontend field names to backend field names
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.event_type !== undefined) payload.rule_type = data.event_type;
  if (data.enabled !== undefined) payload.is_enabled = data.enabled;
  if (data.filters !== undefined) payload.conditions = data.filters;
  if (data.notifier_id !== undefined) payload.notifier_ids = [data.notifier_id];
  if (data.template !== undefined) payload.template = data.template;
  const response = await apiClient.put<any>(`/notifications/rules/${id}`, payload, config);
  return mapRuleResponse(response);
}

/**
 * Delete a notification rule
 */
export async function deleteRule(
  id: number,
  config?: ApiRequestConfig
): Promise<void> {
  await apiClient.delete<void>(`/notifications/rules/${id}`, config);
}

// ============================================================================
// API Methods - Notification Log
// ============================================================================

/**
 * Get notification delivery log
 */
export async function getNotificationLog(
  params?: NotificationLogParams,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<NotificationLog>> {
  return apiClient.getPaginated<NotificationLog>('/notifications/log', params, config);
}

/**
 * Retry a failed notification
 */
export async function retryNotification(
  id: number,
  config?: ApiRequestConfig
): Promise<RetryNotificationResponse> {
  return apiClient.post<RetryNotificationResponse>(`/notifications/log/${id}/retry`, undefined, config);
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Get enabled notifiers only
 */
export async function getEnabledNotifiers(config?: ApiRequestConfig): Promise<Notifier[]> {
  const notifiers = await listNotifiers(config);
  return notifiers.filter(n => n.enabled);
}

/**
 * Get rules for a specific notifier
 */
export async function getRulesForNotifier(
  notifierId: number,
  config?: ApiRequestConfig
): Promise<NotificationRule[]> {
  const rules = await listRules(config);
  return rules.filter(r => r.notifier_id === notifierId);
}

/**
 * Get rules for a specific event type
 */
export async function getRulesForEvent(
  eventType: EventType,
  config?: ApiRequestConfig
): Promise<NotificationRule[]> {
  const rules = await listRules(config);
  return rules.filter(r => r.event_type === eventType && r.enabled);
}

/**
 * Get failed notifications only
 */
export async function getFailedNotifications(
  params?: Omit<NotificationLogParams, 'status'>,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<NotificationLog>> {
  return getNotificationLog({ ...params, status: 'failed' }, config);
}

/**
 * Get recent notifications (last 24 hours)
 */
export async function getRecentNotifications(
  config?: ApiRequestConfig
): Promise<PaginatedResponse<NotificationLog>> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getNotificationLog({ start_date: yesterday.toISOString(), limit: 50 }, config);
}

// ============================================================================
// Type Guards and Helpers
// ============================================================================

/**
 * Map backend notifier response (notifier_type, is_enabled) to frontend Notifier type (type, enabled)
 */
function mapNotifierResponse(response: any): Notifier {
  return {
    id: response.id as number,
    name: response.name as string,
    type: (response.notifier_type || response.type) as NotifierType,
    enabled: (response.is_enabled ?? response.enabled ?? true) as boolean,
    config: (response.config || {}) as NotifierConfig,
    created_at: response.created_at as string,
    updated_at: response.updated_at as string,
  };
}

/**
 * Map backend rule response (rule_type, is_enabled, conditions) to frontend NotificationRule type (event_type, enabled, filters)
 */
function mapRuleResponse(response: any): NotificationRule {
  const notifier = response.notifiers?.[0];
  return {
    id: response.id as number,
    name: (response.name || response.rule_type) as string,
    notifier_id: (response.notifier_ids?.[0] || response.notifier_id) as number,
    event_type: (response.rule_type || response.event_type) as EventType,
    enabled: (response.is_enabled ?? response.enabled ?? true) as boolean,
    filters: (response.conditions || response.filters || {}) as RuleFilters,
    template: (response.template || undefined) as string | undefined,
    created_at: response.created_at as string,
    notifier: notifier ? mapNotifierResponse(notifier) : undefined,
  };
}

export function isNotifierEnabled(notifier: Notifier): boolean {
  return notifier.enabled;
}

export function isRuleEnabled(rule: NotificationRule): boolean {
  return rule.enabled;
}

export function isTelegramNotifier(notifier: Notifier): boolean {
  return notifier.type === 'telegram';
}

export function isDiscordNotifier(notifier: Notifier): boolean {
  return notifier.type === 'discord';
}

export function isEmailNotifier(notifier: Notifier): boolean {
  return notifier.type === 'email';
}

export function isWebhookNotifier(notifier: Notifier): boolean {
  return notifier.type === 'webhook';
}

export function wasNotificationSent(log: NotificationLog): boolean {
  return log.status === 'sent';
}

export function isNotificationPending(log: NotificationLog): boolean {
  return log.status === 'pending';
}

export function isNotificationFailed(log: NotificationLog): boolean {
  return log.status === 'failed';
}

export function getNotifierTypeLabel(type: NotifierType): string {
  const labels: Record<NotifierType, string> = {
    telegram: 'Telegram',
    discord: 'Discord',
    email: 'Email',
    webhook: 'Webhook',
    pushover: 'Pushover',
  };
  return labels[type];
}

export function getEventTypeLabel(eventType: EventType): string {
  const labels: Record<EventType, string> = {
    stream_start: 'Stream Started',
    stream_stop: 'Stream Stopped',
    stream_pause: 'Stream Paused',
    stream_resume: 'Stream Resumed',
    transcoding_start: 'Transcoding Started',
    transcoding_hw: 'Hardware Transcoding',
    item_added: 'New Item Added',
    user_created: 'New User Created',
    server_update_available: 'Server Update Available',
    server_down: 'Server Down',
    server_up: 'Server Up',
  };
  return labels[eventType];
}

export function getEventTypeIcon(eventType: EventType): string {
  const icons: Record<EventType, string> = {
    stream_start: '▶️',
    stream_stop: '⏹️',
    stream_pause: '⏸️',
    stream_resume: '▶️',
    transcoding_start: '🔄',
    transcoding_hw: '⚡',
    item_added: '➕',
    user_created: '👤',
    server_update_available: '📦',
    server_down: '❌',
    server_up: '✅',
  };
  return icons[eventType];
}

export function getStatusColor(status: NotificationStatus): string {
  switch (status) {
    case 'sent':
      return 'text-green-500';
    case 'pending':
      return 'text-yellow-500';
    case 'failed':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

export function getStatusLabel(status: NotificationStatus): string {
  const labels: Record<NotificationStatus, string> = {
    sent: 'Sent',
    pending: 'Pending',
    failed: 'Failed',
  };
  return labels[status];
}
