import axios from 'axios';

export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'attendoschool.optinetinnovations.in') {
      return '/api';
    }
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return '/api';
    }
  }
  return 'http://localhost:5000/api';
};

export const API_BASE_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((c) => {
  const t = localStorage.getItem('attendance_token') || localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

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
    throw new Error(errorMsg);
  }

  return response.json();
}

