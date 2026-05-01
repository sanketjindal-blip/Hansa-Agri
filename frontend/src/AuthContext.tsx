import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, formatApiError } from './api';

export type User = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('rkai_token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch {
          await AsyncStorage.removeItem('rkai_token');
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      await AsyncStorage.setItem('rkai_token', res.data.access_token);
      setUser(res.data.user);
    } catch (e) {
      throw new Error(formatApiError(e));
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, phone?: string) => {
    try {
      const res = await api.post('/auth/register', { email, password, name, phone });
      await AsyncStorage.setItem('rkai_token', res.data.access_token);
      setUser(res.data.user);
    } catch (e) {
      throw new Error(formatApiError(e));
    }
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem('rkai_token');
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
