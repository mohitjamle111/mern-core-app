import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

/**
 * Session lives in the shell, once. Module UIs call `useAuth()` and receive the
 * already-authenticated user — they never render a login form, never read a
 * token, never talk to the auth API.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { user } = await api.post('/api/auth/login', { email, password });
    setUser(user);
    return user;
  };

  const logout = async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  };

  const can = (permission) => !permission || !!user?.permissions?.includes(permission);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
