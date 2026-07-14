import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import api from '../utils/api.js';
import { tokenStore } from '../utils/tokenStore.js';

const AuthContext = createContext(undefined);

let initialBootstrapTriggered = false;

// Lightweight equality helpers to avoid unnecessary state updates.
// Keep these small and deterministic — user/profile objects are plain JSON from the API.
function isProfileEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function isUserEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasBootstrapped = useRef(false);

  useEffect(() => {
    // Keep React state in sync whenever api.js silently rotates the access token.
    tokenStore.registerListener(setToken);
  }, []);


  const bootstrapAuth = useCallback(async (active = { current: true }) => {
    setLoading(true);
    try {
      const refreshRes = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/refresh/`,
        {},
        { withCredentials: true }
      );
      if (active.current) {
        tokenStore.setToken(refreshRes.data.access);
      }

      const profileRes = await api.get('/api/auth/profile/');
      if (active.current) {
        const { stats, ...cleanUser } = profileRes.data;
        setUser(cleanUser);
      }
    } catch {
      if (active.current) {
        tokenStore.setToken(null);
        setUser(null);
      }
    } finally {
      if (active.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const handleAuthChange = () => {
      bootstrapAuth();
    };

    window.addEventListener('auth_change', handleAuthChange);

    return () => window.removeEventListener('auth_change', handleAuthChange);
  }, [bootstrapAuth]);

  useEffect(() => {
    const active = { current: true };
    bootstrapAuth(active);
    return () => {
      active.current = false;
    };
  }, [bootstrapAuth]);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/api/auth/login/', { email, password });
    const { access, user: userData } = response.data;   // no refresh in body anymore
    tokenStore.setToken(access);
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (formData) => {
    const response = await api.post('/api/auth/register/', formData);
    const { access, user: userData } = response.data;
    tokenStore.setToken(access);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout/');   // cookie sent automatically, backend clears it
    } catch (err) {
      console.error('Logout API call failed:', err);
    } finally {
      tokenStore.setToken(null);
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((updatedUser) => {
    if (!updatedUser) return;
    const { stats, ...cleanUser } = updatedUser;
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
    user, token, loading, login, register, logout, updateUser, refreshProfile
  }), [user, token, loading, login, register, logout, updateUser, refreshProfile]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}