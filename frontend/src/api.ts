import axios from 'axios';

export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://attendoschool-backend.onrender.com/api';
  }
  return 'http://localhost:5000/api';
};

export const API_BASE_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((c) => {
  const t = localStorage.getItem('attendance_token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
