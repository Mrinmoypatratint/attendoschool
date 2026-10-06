import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'attendoschool.optinetinnovations.in') {
      return 'https://attendoschool-backend.onrender.com/api';
    }
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'https://attendoschool-backend.onrender.com/api';
    }
  }
  return 'http://localhost:5000/api';
};

export const API_BASE_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000 // 30s timeout to allow for cold starts or heavy batch operations
});

export const AUTH_EXPIRED_EVENT = 'attendoschool_auth_expired';
let isHandlingAuthError = false;

// Attach auth token to all outgoing requests
api.interceptors.request.use((c) => {
  const t = localStorage.getItem('attendance_token') || localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

// Production resilience interceptor:
// Automatically retry requests that fail due to cold starts, proxy timeouts (502/503/504),
// or transient network glitches before presenting an error to the user.
interface RetryConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;

    // Handle 401 unauthorized / token expired
    if (error.response && error.response.status === 401) {
      const msg = (error.response.data as any)?.message || '';
      const code = (error.response.data as any)?.code || '';

      if (
        code === 'TOKEN_EXPIRED' ||
        code === 'INVALID_TOKEN' ||
        code === 'AUTH_REQUIRED' ||
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('invalid') ||
        msg.toLowerCase().includes('authentication required')
      ) {
        localStorage.removeItem('attendance_token');
        localStorage.removeItem('attendance_user');
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        if (!isHandlingAuthError) {
          isHandlingAuthError = true;
          setTimeout(() => { isHandlingAuthError = false; }, 3000);

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { message: msg } }));

            if (!window.location.hash.includes('/login')) {
              window.location.hash = '#/login?session_expired=1';
            }
          }
        }
      }
      return Promise.reject(error);
    }

    // Check if eligible for automatic retry (server unreachable / cold start / proxy blip)
    if (config) {
      config._retryCount = config._retryCount || 0;
      const isNetworkError = !error.response;
      const isGatewayError = error.response && [502, 503, 504].includes(error.response.status);
      const isTimeout = error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout');

      const maxRetries = 2;
      if ((isNetworkError || isGatewayError || isTimeout) && config._retryCount < maxRetries) {
        config._retryCount += 1;
        const backoffDelay = config._retryCount * 1200; // 1.2s, then 2.4s
        console.warn(`[API] Transient connection error (${error.message}). Retrying request (attempt ${config._retryCount}/${maxRetries}) in ${backoffDelay}ms...`);
        
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        return api(config);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Fetch wrapper with built-in retry and session management
 */
export async function apiRequest<T = any>(url: string, options?: RequestInit, retries: number = 2): Promise<T> {
  const token = localStorage.getItem('attendance_token') || localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as any)
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const cleanUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/${url}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(cleanUrl, {
        ...options,
        headers
      });

      if (!response.ok) {
        // Retry on 502/503/504
        if ([502, 503, 504].includes(response.status) && attempt < retries) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 1200));
          continue;
        }

        let errorMsg = `HTTP Error ${response.status}`;
        try {
          const data = await response.json();
          if (data.message) errorMsg = data.message;
        } catch {}

        if (response.status === 401) {
          localStorage.removeItem('attendance_token');
          localStorage.removeItem('attendance_user');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (typeof window !== 'undefined' && !window.location.hash.includes('/login')) {
            window.location.hash = '#/login?session_expired=1';
          }
        }

        throw new Error(errorMsg);
      }

      return response.json();
    } catch (err: any) {
      if (attempt < retries && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1200));
        continue;
      }
      throw err;
    }
  }

  throw new Error('Server unreachable after retries.');
}
