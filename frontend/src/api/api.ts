import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rkai_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiError(err: any): string {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || 'Something went wrong';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d: any) => d?.msg || JSON.stringify(d)).join(' ');
  return typeof detail?.msg === 'string' ? detail.msg : JSON.stringify(detail);
}

export function absoluteUrl(rel?: string | null): string | undefined {
  if (!rel) return undefined;
  if (rel.startsWith('http')) return rel;
  return `${BASE_URL}${rel}`;
}

export function formatINR(value?: number | string | null): string {
  const n = Number(value || 0);
  if (!isFinite(n)) return '₹ 0.00';
  try {
    return '₹ ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return '₹ ' + n.toFixed(2);
  }
}