import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken, getToken, onSessionExpired, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getToken()));
  const [sessionExpired, setSessionExpired] = useState(false);
  const navigate = useNavigate();

  // Restore the session on first load.
  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me', { silent: true })
      .then((data) => setUser(data.user))
      .catch((err) => {
        if (err.code === 'SESSION_EXPIRED') setSessionExpired(true);
        clearToken();
      })
      .finally(() => setLoading(false));
  }, []);

  // Any API call that finds an expired session sends the user back to log in.
  useEffect(() => {
    onSessionExpired(() => {
      setUser(null);
      setSessionExpired(true);
      const here = window.location.pathname + window.location.search;
      navigate(`/login?expired=1&redirect=${encodeURIComponent(here)}`, { replace: true });
    });
  }, [navigate]);

  const login = useCallback(async ({ email, password, remember }) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password, remember } });
    setToken(data.token, remember);
    setSessionExpired(false);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (form) => {
    const data = await api('/auth/register', { method: 'POST', body: form });
    setToken(data.token, false);
    setSessionExpired(false);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, loading, sessionExpired, login, register, logout, isAdmin: user?.role === 'admin' }),
    [user, loading, sessionExpired, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
