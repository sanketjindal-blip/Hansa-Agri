import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/api';

interface User {
  id: string;
  phone: string;
  name?: string;
  role: 'customer' | 'admin' | 'dealer' | 'manager';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isDealer: boolean;
  isManager: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('rkai_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (phone: string) => {
    const res = await api.post('/auth/send-otp', { phone });
    return res.data;
  };

  const verifyOtp = async (phone: string, otp: string) => {
    const res = await api.post('/auth/verify-otp', { phone, otp });
    const { access_token } = res.data;
    localStorage.setItem('rkai_token', access_token);
    setToken(access_token);
    await fetchUser();
  };

  const logout = () => {
    localStorage.removeItem('rkai_token');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';
  const isDealer = user?.role === 'dealer';
  const isManager = user?.role === 'manager';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, verifyOtp, logout, isAdmin, isDealer, isManager }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};