import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restore() {
      try {
        const [savedToken, savedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (savedToken && savedUser) {
          // Validate the stored token is still accepted by the server.
          // If the API restarted (previously wiping the in-memory store), this
          // will return 401 and we clear the stale session instead of silently
          // failing later when the user tries to save.
          const check = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          if (check.ok) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            setAuthTokenGetter(() => savedToken);
          } else {
            await Promise.all([
              AsyncStorage.removeItem(TOKEN_KEY),
              AsyncStorage.removeItem(USER_KEY),
            ]);
          }
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    }
    restore();
  }, []);

  const persistSession = async (t: string, u: User) => {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, t),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(u)),
    ]);
    setToken(t);
    setUser(u);
    setAuthTokenGetter(() => t);
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Login failed");
    await persistSession(data.token, data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Registration failed");
    await persistSession(data.token, data.user);
  };

  const logout = async () => {
    if (token) {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
    setToken(null);
    setUser(null);
    setAuthTokenGetter(() => null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
