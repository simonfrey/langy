import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { api, setToken, clearToken, setOnUnauthorized } from "../lib/api";
import React from "react";

interface User {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("langy_token");
    const savedUser = localStorage.getItem("langy_user");
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        clearToken();
        localStorage.removeItem("langy_user");
      }
    }
    setLoading(false);

    setOnUnauthorized(() => setUser(null));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    localStorage.setItem("langy_user", JSON.stringify(res.user));
    setUser(res.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    localStorage.setItem("langy_user", JSON.stringify(res.user));
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem("langy_user");
    setUser(null);
  }, []);

  return React.createElement(AuthContext.Provider, {
    value: { user, loading, login, register, logout },
    children,
  });
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
