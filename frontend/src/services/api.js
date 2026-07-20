import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function getToken() {
  return localStorage.getItem('access_token');
}

function setAuthHeader(config, token) {
  const auth = `Bearer ${token}`;
  if (config.headers && typeof config.headers.set === 'function') {
    config.headers.set('Authorization', auth);
  } else {
    if (!config.headers) config.headers = {};
    config.headers['Authorization'] = auth;
    config.headers.Authorization = auth;
  }
  return config;
}

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    setAuthHeader(config, token);
  }
  if (config.data instanceof FormData && config.headers && typeof config.headers.delete === 'function') {
    config.headers.delete('Content-Type');
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    error ? reject(error) : resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        setAuthHeader(originalRequest, token);
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      isRefreshing = false;
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const newToken = data.data.access_token;
      const newRefreshToken = data.data.refresh_token;

      localStorage.setItem('access_token', newToken);
      localStorage.setItem('refresh_token', newRefreshToken);

      processQueue(null, newToken);

      setAuthHeader(originalRequest, newToken);
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
