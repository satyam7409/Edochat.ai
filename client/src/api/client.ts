import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach Bearer token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Unwrap the response envelope: { statusCode, message, data }
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const request = err?.config as (typeof err.config & { _retried?: boolean }) | undefined;
    if (err?.response?.status === 401 && request && !request._retried && !request.url?.startsWith('/user/')) {
      request._retried = true;
      try {
        const refresh = await api.post('/user/refresh');
        const token = refresh.data.data.accessToken;
        localStorage.setItem('accessToken', token);
        request.headers.Authorization = `Bearer ${token}`;
        return api(request);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        localStorage.removeItem('orgId');
      }
    }
    const message =
      err?.response?.data?.message || err?.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);
