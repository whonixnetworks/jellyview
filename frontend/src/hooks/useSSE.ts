import { useEffect, useRef, useCallback, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SSEEvent<T = unknown> {
  type: string;
  data: T;
  timestamp: string;
}

export interface SSEHookOptions {
  eventTypes?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enableReconnect?: boolean;
}

export interface SSEHookReturn<T = unknown> {
  status: ConnectionStatus;
  lastEvent: SSEEvent<T> | null;
  error: Error | null;
  reconnectAttempt: number;
  isConnected: boolean;
  isConnecting: boolean;
  hasError: boolean;
  subscribe: (eventType: string, callback: (data: T) => void) => () => void;
  unsubscribe: (eventType: string) => void;
  reconnect: () => void;
  disconnect: () => void;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_RECONNECT_INTERVAL = 1000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const BASE_URL = '/api';

// ============================================================================
// Helper Functions
// ============================================================================

function buildSSEUrl(eventTypes?: string[]): string {
  const url = new URL(`${BASE_URL}/sse`, window.location.origin);
  
  if (eventTypes && eventTypes.length > 0) {
    url.searchParams.set('event_types', eventTypes.join(','));
  }
  
  return url.toString();
}

function parseEventData<T>(event: MessageEvent): SSEEvent<T> {
  try {
    const parsed = JSON.parse(event.data);
    return {
      type: event.type || 'message',
      data: parsed as T,
      timestamp: new Date().toISOString(),
    };
  } catch {
    // If parsing fails, return raw data
    return {
      type: event.type || 'message',
      data: event.data as T,
      timestamp: new Date().toISOString(),
    };
  }
}

function calculateBackoff(attempt: number, baseInterval: number): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseInterval * Math.pow(2, attempt);
  const jitter = Math.random() * 0.5 * exponentialDelay; // Up to 50% jitter
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}

// ============================================================================
// Main Hook
// ============================================================================

export function useSSE<T = unknown>(
  options: SSEHookOptions = {}
): SSEHookReturn<T> {
  const {
    eventTypes,
    reconnectInterval = DEFAULT_RECONNECT_INTERVAL,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    enableReconnect = true,
  } = options;

  // State
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<SSEEvent<T> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const callbacksRef = useRef<Map<string, Set<(data: T) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<number>();
  const isMountedRef = useRef(true);

  // Derived state
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const hasError = status === 'error';

  // Subscribe to an event type
  const subscribe = useCallback(
    (eventType: string, callback: (data: T) => void): (() => void) => {
      if (!callbacksRef.current.has(eventType)) {
        callbacksRef.current.set(eventType, new Set());
      }
      callbacksRef.current.get(eventType)!.add(callback);

      // Return unsubscribe function
      return () => {
        const callbacks = callbacksRef.current.get(eventType);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            callbacksRef.current.delete(eventType);
          }
        }
      };
    },
    []
  );

  // Unsubscribe from an event type
  const unsubscribe = useCallback((eventType: string) => {
    callbacksRef.current.delete(eventType);
  }, []);

  // Handle incoming message
  const handleMessage = useCallback((event: MessageEvent) => {
    if (!isMountedRef.current) return;

    const parsedEvent = parseEventData<T>(event);
    setLastEvent(parsedEvent);

    // Notify all subscribers for this event type
    const callbacks = callbacksRef.current.get(parsedEvent.type);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(parsedEvent.data);
        } catch (err) {
          console.error(`Error in SSE callback for event type "${parsedEvent.type}":`, err);
        }
      });
    }

    // Also notify general message subscribers
    const messageCallbacks = callbacksRef.current.get('message');
    if (messageCallbacks) {
      messageCallbacks.forEach((callback) => {
        try {
          callback(parsedEvent.data);
        } catch (err) {
          console.error('Error in SSE message callback:', err);
        }
      });
    }
  }, []);

  // Handle connection open
  const handleOpen = useCallback(() => {
    if (!isMountedRef.current) return;
    
    setStatus('connected');
    setError(null);
    setReconnectAttempt(0);
  }, []);

  // Handle connection error
  const handleError = useCallback(() => {
    if (!isMountedRef.current) return;

    setError(new Error('SSE connection error'));
    setStatus('error');

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Attempt reconnection if enabled
    if (enableReconnect && reconnectAttempt < maxReconnectAttempts) {
      const backoffDelay = calculateBackoff(reconnectAttempt, reconnectInterval);
      
      setStatus('connecting');
      setReconnectAttempt((prev) => prev + 1);
      
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          connect();
        }
      }, backoffDelay);
    } else {
      setStatus('disconnected');
    }
  }, [enableReconnect, reconnectAttempt, maxReconnectAttempts, reconnectInterval]);

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    try {
      setStatus('connecting');
      setError(null);

      const url = buildSSEUrl(eventTypes);
      const eventSource = new EventSource(url);
      
      eventSourceRef.current = eventSource;
      eventSource.onmessage = handleMessage;
      eventSource.onopen = handleOpen;
      eventSource.onerror = handleError;

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to connect to SSE');
      setError(error);
      setStatus('error');
    }
  }, [eventTypes, handleMessage, handleOpen, handleError]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    setReconnectAttempt(0);
    connect();
  }, [connect]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setStatus('disconnected');
    setError(null);
    setReconnectAttempt(0);
  }, []);

  // Establish connection on mount
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
    // Only connect on mount, not on every option change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    lastEvent,
    error,
    reconnectAttempt,
    isConnected,
    isConnecting,
    hasError,
    subscribe,
    unsubscribe,
    reconnect,
    disconnect,
  };
}

// ============================================================================
// Convenience Hooks for Common Event Types
// ============================================================================

export function useSessionUpdates(eventTypes?: string[]) {
  const sse = useSSE<unknown>({ eventTypes });
  
  return sse;
}

export function useLibraryUpdates(eventTypes?: string[]) {
  const sse = useSSE<unknown>({ eventTypes });
  
  return sse;
}

export function useSystemEvents(eventTypes?: string[]) {
  const sse = useSSE<unknown>({ eventTypes });
  
  return sse;
}
