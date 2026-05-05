import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosProgressEvent } from 'axios';

// ============================================================================
// Types
// ============================================================================

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiRequestConfig {
  signal?: AbortSignal;
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void;
}

export interface LoadingState {
  isLoading: boolean;
  error: ApiError | null;
}

// ============================================================================
// Error Handling
// ============================================================================

export class ApiRequestError extends Error implements ApiError {
  code?: string;
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static fromAxiosError(error: AxiosError): ApiRequestError {
    const response = error.response;
    const message =
      (response?.data as { message?: string })?.message ||
      (response?.data as { detail?: string })?.detail ||
      error.message ||
      'An unknown error occurred';

    return new ApiRequestError(
      message,
      response?.status,
      (response?.data as { code?: string })?.code,
      response?.data
    );
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiRequestError;
}

// ============================================================================
// Base Client
// ============================================================================

class ApiClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getAuthToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors globally
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          // Server responded with error status
          return Promise.reject(ApiRequestError.fromAxiosError(error));
        } else if (error.request) {
          // Request made but no response
          return Promise.reject(
            new ApiRequestError('No response from server. Please check your connection.')
          );
        } else {
          // Request setup error
          return Promise.reject(
            new ApiRequestError('Failed to make request: ' + error.message)
          );
        }
      }
    );
  }

  private getAuthToken(): string | null {
    // Try to get token from localStorage (for web)
    if (typeof window !== 'undefined') {
      return localStorage.getItem('jellyview_token');
    }
    return null;
  }

  public setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jellyview_token', token);
    }
  }

  public clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jellyview_token');
    }
  }

  // ============================================================================
  // HTTP Methods
  // ============================================================================

  private async request<T>(
    config: InternalAxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }

  public async get<T>(
    url: string,
    params?: Record<string, unknown>,
    options?: ApiRequestConfig
  ): Promise<T> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
      signal: options?.signal,
      headers: new axios.AxiosHeaders(),
    });
  }

  public async post<T>(
    url: string,
    data?: unknown,
    options?: ApiRequestConfig
  ): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      signal: options?.signal,
      onUploadProgress: options?.onUploadProgress,
      headers: new axios.AxiosHeaders(),
    });
  }

  public async put<T>(
    url: string,
    data?: unknown,
    options?: ApiRequestConfig
  ): Promise<T> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
      signal: options?.signal,
      headers: new axios.AxiosHeaders(),
    });
  }

  public async patch<T>(
    url: string,
    data?: unknown,
    options?: ApiRequestConfig
  ): Promise<T> {
    return this.request<T>({
      method: 'PATCH',
      url,
      data,
      signal: options?.signal,
      headers: new axios.AxiosHeaders(),
    });
  }

  public async delete<T>(
    url: string,
    options?: ApiRequestConfig
  ): Promise<T> {
    return this.request<T>({
      method: 'DELETE',
      url,
      signal: options?.signal,
      headers: new axios.AxiosHeaders(),
    });
  }

  // ============================================================================
  // Pagination Helpers
  // ============================================================================

  public async getPaginated<T>(
    url: string,
    params?: PaginationParams & Record<string, unknown>,
    options?: ApiRequestConfig
  ): Promise<PaginatedResponse<T>> {
    const response = await this.get<{
      items: T[];
      total: number;
      page: number;
      limit: number;
    }>(url, params, options);

    return {
      items: response.items,
      total: response.total,
      page: response.page,
      limit: response.limit,
      hasMore: response.page * response.limit < response.total,
    };
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  public async uploadFile<T>(
    url: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    return this.post<T>(url, formData, {
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (progressEvent.total !== undefined && onProgress) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    });
  }

  public async downloadFile(
    url: string,
    filename?: string
  ): Promise<Blob> {
    const response = await this.client.get(url, {
      responseType: 'blob',
    });

    // Create download link if filename provided
    if (filename && typeof window !== 'undefined') {
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }

    return response.data;
  }

  // ============================================================================
  // Server-Sent Events
  // ============================================================================

  public connectSSE(url: string, onMessage: (data: unknown) => void, onError?: (error: Error) => void): EventSource {
    const eventSource = new EventSource(this.baseUrl + url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        // If not JSON, pass raw data
        onMessage(event.data);
      }
    };

    eventSource.onerror = () => {
      if (onError) {
        onError(new Error('SSE connection error'));
      }
    };

    return eventSource;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const apiClient = new ApiClient();

export default ApiClient;
