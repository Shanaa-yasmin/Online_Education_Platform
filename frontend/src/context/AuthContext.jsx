import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api.js';

const AuthContext = createContext(undefined);

const isProfileEqual = (p1, p2) => {
  if (p1 === p2) return true;
  if (!p1 || !p2) return false;
  return (
    p1.bio === p2.bio &&
    p1.title === p2.title &&
    p1.skills === p2.skills &&
    p1.phone_number === p2.phone_number &&
    p1.website === p2.website &&
    p1.location === p2.location &&
    p1.avatar === p2.avatar
  );
};

const isUserEqual = (u1, u2) => {
  if (u1 === u2) return true;
  if (!u1 || !u2) return false;
  return (
    u1.id === u2.id &&
    u1.username === u2.username &&
    u1.email === u2.email &&
    u1.first_name === u2.first_name &&
    u1.last_name === u2.last_name &&
    u1.role === u2.role &&
    isProfileEqual(u1.profile, u2.profile)
  );
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncAuth = useCallback(() => {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(prev => prev === storedToken ? prev : storedToken);
        setUser(prev => isUserEqual(prev, parsedUser) ? prev : parsedUser);
      } catch {
        localStorage.removeItem('user');
      }
    } else {
      setToken(prev => prev === null ? prev : null);
      setUser(prev => prev === null ? prev : null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    syncAuth();
    // Listen for forced logout events dispatched by the Axios interceptor
    window.addEventListener('auth_change', syncAuth);
    return () => window.removeEventListener('auth_change', syncAuth);
  }, [syncAuth]);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/api/auth/login/', { email, password });
    const { access, refresh, user: userData } = response.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(access);
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (formData) => {
    const response = await api.post('/api/auth/register/', formData);
    const { access, refresh, user: userData } = response.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(access);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token');
    try {
      if (refresh) {
        await api.post('/api/auth/logout/', { refresh });
      }
    } catch (err) {
      console.error('Logout API call failed:', err);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((updatedUser) => {
    if (!updatedUser) return;
    const { stats, ...cleanUser } = updatedUser;
    localStorage.setItem('user', JSON.stringify(cleanUser));
    setUser(prev => isUserEqual(prev, cleanUser) ? prev : cleanUser);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const response = await api.get('/api/auth/profile/');
      updateUser(response.data);
    } catch (err) {
      console.error('Profile refresh failed:', err);
    }
  }, [updateUser]);

  const contextValue = useMemo(() => ({
    user,
    token,
    loading,
    login,
    register,
    logout,
    updateUser,
    refreshProfile
  }), [user, token, loading, login, register, logout, updateUser, refreshProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
