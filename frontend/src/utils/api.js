import axios from 'axios';
import { tokenStore } from './tokenStore.js';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  withCredentials: true,   // send/receive the httponly refresh cookie
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = tokenStore.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (originalRequest.url?.includes('/api/auth/refresh/')) {
      tokenStore.setToken(null);
      window.dispatchEvent(new Event('auth_change'));
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes('/api/auth/login/')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // No body needed — the refresh token cookie is sent automatically.
        const response = await axios.post(
          'http://localhost:8000/api/auth/refresh/',
          {},
          { withCredentials: true }
        );

        const newAccessToken = response.data.access;
        tokenStore.setToken(newAccessToken);

        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        tokenStore.setToken(null);
        window.dispatchEvent(new Event('auth_change'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;