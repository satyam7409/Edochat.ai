import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User } from '../api/auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  orgId: string | null;
}

interface AuthContextValue extends AuthState {
  setAuth: (user: User, token: string) => void;
  setOrgId: (orgId: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadInitial(): AuthState {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const accessToken = localStorage.getItem('accessToken');
    const orgId = localStorage.getItem('orgId');
    return { user, accessToken, orgId };
  } catch {
    return { user: null, accessToken: null, orgId: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadInitial);

  const setAuth = useCallback((user: User, token: string) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accessToken', token);
    const orgId = user.orgId ?? null;
    if (orgId) localStorage.setItem('orgId', orgId);
    setState({ user, accessToken: token, orgId });
  }, []);

  const setOrgId = useCallback((orgId: string) => {
    localStorage.setItem('orgId', orgId);
    setState((prev) => ({
      ...prev,
      orgId,
      user: prev.user ? { ...prev.user, orgId } : prev.user,
    }));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('orgId');
    setState({ user: null, accessToken: null, orgId: null });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        setAuth,
        setOrgId,
        logout,
        isAuthenticated: !!state.accessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
