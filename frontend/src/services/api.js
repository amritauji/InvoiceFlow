import axios from 'axios';

// Same-origin /api/v1 by default (works behind the Vite dev proxy and nginx in
// production); override with VITE_API_URL when the API lives elsewhere.
const API_BASE = import.meta.env.VITE_API_URL || `${window.location.origin}/api/v1`;

// In-memory token store for the access token — it never touches localStorage,
// preventing XSS theft of the short-lived access token.
// The refresh token is persisted (rotated on each use) so the session survives
// a page refresh; on boot it is exchanged for a fresh access token.
const REFRESH_STORAGE_KEY = 'invoiceflow_refresh_token';
let _accessToken = null;
let _refreshToken = null;

function persistRefreshToken(refresh) {
  try {
    if (refresh) localStorage.setItem(REFRESH_STORAGE_KEY, refresh);
    else localStorage.removeItem(REFRESH_STORAGE_KEY);
  } catch { /* storage unavailable */ }
}

function restoreRefreshToken() {
  try {
    const stored = localStorage.getItem(REFRESH_STORAGE_KEY);
    if (stored) _refreshToken = stored;
  } catch { /* storage unavailable */ }
}

restoreRefreshToken();

export function setTokens(access, refresh) {
  _accessToken = access;
  _refreshToken = refresh;
  persistRefreshToken(refresh);
}

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  persistRefreshToken(null);
}

export function hasStoredSession() {
  return Boolean(_refreshToken);
}

export function getAccessToken() {
  return _accessToken;
}

export function getRefreshToken() {
  return _refreshToken;
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
  if (_accessToken) {
    setAuthHeader(config, _accessToken);
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

    if (!_refreshToken) {
      isRefreshing = false;
      clearTokens();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
        refresh_token: _refreshToken,
      });

      const newToken = data.data.access_token;
      const newRefreshToken = data.data.refresh_token;

      setTokens(newToken, newRefreshToken);

      processQueue(null, newToken);

      setAuthHeader(originalRequest, newToken);
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearTokens();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
