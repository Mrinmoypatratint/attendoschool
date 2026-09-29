import axios from 'axios';

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
  baseURL: API_BASE_URL
});

export const AUTH_EXPIRED_EVENT = 'attendoschool_auth_expired';
let isHandlingAuthError = false;

api.interceptors.request.use((c) => {
  const t = localStorage.getItem('attendance_token') || localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const msg = error.response.data?.message || '';
      const code = error.response.data?.code || '';

      if (
        code === 'TOKEN_EXPIRED' ||
        code === 'INVALID_TOKEN' ||
        code === 'AUTH_REQUIRED' ||
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('invalid') ||
        msg.toLowerCase().includes('authentication required')
      ) {
        // Clear expired session tokens from localStorage
        localStorage.removeItem('attendance_token');
        localStorage.removeItem('attendance_user');
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        if (!isHandlingAuthError) {
          isHandlingAuthError = true;
          setTimeout(() => { isHandlingAuthError = false; }, 3000);

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { message: msg } }));

            // Gracefully navigate to login screen if not already there
            if (!window.location.hash.includes('/login')) {
              window.location.hash = '#/login?session_expired=1';
            }
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export async function apiRequest<T = any>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('attendance_token') || localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as any)
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const cleanUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/${url}`;
  const response = await fetch(cleanUrl, {
    ...options,
    headers
  });

  if (!response.ok) {
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
}

