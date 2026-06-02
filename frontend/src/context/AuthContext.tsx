'use client';

/**
 * AuthContext — wired to the actual ScholarlyAI backend.
 *
 * Backend contracts (auth_routes.py):
 *  POST /auth/login    — FormData { email, password }
 *                        → { token, user_id, email, name, avatar, bio, subject_focus }
 *  POST /auth/register — FormData { email, password, name }
 *                        → { token, user_id, email, name, avatar, bio, subject_focus }
 *  GET  /auth/check/:id — Bearer token required
 *                        → { valid, user_id, email, name, avatar, bio }
 *
 * localStorage keys used across the app:
 *  scholarly_token    — JWT returned by login / register
 *  scholarly_user_id  — user_id returned by login / register
 *  scholarly_email    — email (convenience, read by some components)
 *  scholarly_name     — display name (convenience)
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Types ──────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  bio: string;
  subject_focus: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns Bearer auth headers using the stored scholarly_token.
 * Exported so non-context code (Dashboard, panels) can use it too.
 * Do NOT set Content-Type here — FormData requests set their own boundary.
 */
export function getAuthHeaders(): Record<string, string> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('scholarly_token')
      : null;
  return {
    Authorization: `Bearer ${token ?? ''}`,
  };
}

function persistSession(data: {
  token: string;
  user_id: string;
  email: string;
  name: string;
  avatar: string;
  bio: string;
  subject_focus: string[];
}): User {
  localStorage.setItem('scholarly_token', data.token);
  localStorage.setItem('scholarly_user_id', data.user_id);
  localStorage.setItem('scholarly_email', data.email);
  localStorage.setItem('scholarly_name', data.name);
  return {
    id: data.user_id,
    email: data.email,
    name: data.name,
    avatar: data.avatar,
    bio: data.bio,
    subject_focus: data.subject_focus ?? [],
  };
}

function clearSession(): void {
  localStorage.removeItem('scholarly_token');
  localStorage.removeItem('scholarly_user_id');
  localStorage.removeItem('scholarly_email');
  localStorage.removeItem('scholarly_name');
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshIfNeeded = async (token: string) => {
  const payload = JSON.parse(atob(token.split(".")[1]));
  const expiresIn = payload.exp * 1000 - Date.now();
  if (expiresIn < 2 * 24 * 60 * 60 * 1000) {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.token) localStorage.setItem("scholarly_token", data.token);
    }
  }
};


  // On mount: verify any stored token against /auth/check
  useEffect(() => {
    const token = localStorage.getItem('scholarly_token');
    const userId = localStorage.getItem('scholarly_user_id');

    if (!token || !userId) {
      setIsLoading(false);
      return;
    }

    fetch(`${API_URL}/auth/check/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        // Token expired or invalid — wipe stale credentials
        clearSession();
        return null;
      })
      .then((data) => {
        if (data?.valid) {
          setUser({
            id: data.user_id,
            email: data.email,
            name: data.name,
            avatar: data.avatar ?? '🎓',
            bio: data.bio ?? '',
            subject_focus: [],
          });
          refreshIfNeeded(token);
        }
      })
      .catch(() => {
        // Network error on startup — restore from localStorage so offline
        // users aren't locked out. page.js will re-validate on next load.
        const name = localStorage.getItem('scholarly_name') ?? '';
        const email = localStorage.getItem('scholarly_email') ?? '';
        setUser({ id: userId, email, name, avatar: '🎓', bio: '', subject_focus: [] });
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const fd = new FormData();
    fd.append('email', email);
    fd.append('password', password);

    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      body: fd,
    });
    

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).detail ?? 'Login failed');
    }

    const data = await res.json();
    setUser(persistSession(data));
  };

  const signup = async (
    email: string,
    name: string,
    password: string,
  ): Promise<void> => {
    const fd = new FormData();
    fd.append('email', email);
    fd.append('name', name);
    fd.append('password', password);

    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      body: fd,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).detail ?? 'Registration failed');
    }

    const data = await res.json();
    setUser(persistSession(data));
  };

  const logout = (): void => {
    clearSession();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}