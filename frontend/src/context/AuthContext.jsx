import { createContext, useContext, useEffect, useState } from 'react';
import api, { setTokens, clearTokens, hasStoredSession } from '../services/api';
import { getErrorMessage } from '../utils/error';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);

  // Restore session on page refresh using the persisted refresh token.
  // A missing/expired access token is rotated automatically by the API client.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasStoredSession()) {
        if (!cancelled) setRestoring(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled) setUser(data.data);
      } catch {
        if (!cancelled) clearTokens();
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const { access_token, refresh_token, user: userData } = data.data;
      setTokens(access_token, refresh_token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error.response?.status, error.response?.data);
      const msg = getErrorMessage(error, 'Login failed. Check your credentials.');
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, restoring }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
