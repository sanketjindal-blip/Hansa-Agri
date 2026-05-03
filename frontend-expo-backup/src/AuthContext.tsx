import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { storage } from './storage';
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
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await storage.getItem('rkai_token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch {
          await storage.removeItem('rkai_token');
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      await storage.setItem('rkai_token', res.data.access_token);
      setUser(res.data.user);
    } catch (e) {
      throw new Error(formatApiError(e));
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, phone?: string) => {
    try {
      const res = await api.post('/auth/register', { email, password, name, phone });
      await storage.setItem('rkai_token', res.data.access_token);
      setUser(res.data.user);
    } catch (e) {
      throw new Error(formatApiError(e));
    }
  }, []);

  const logout = useCallback(async () => {
    await storage.removeItem('rkai_token');
    setUser(null);
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    try {
      await api.post('/auth/send-otp', { phone });
    } catch (e) { throw new Error(formatApiError(e)); }
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string, name?: string) => {
    try {
      const res = await api.post('/auth/verify-otp', { phone, otp, name });
      await storage.setItem('rkai_token', res.data.access_token);
      setUser(res.data.user);
    } catch (e) { throw new Error(formatApiError(e)); }
  }, []);

  return <Ctx.Provider value={{ user, loading, login, register, sendOtp, verifyOtp, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
