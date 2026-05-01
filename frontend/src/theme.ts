export const theme = {
  colors: {
    primary: '#FF6600',
    primaryDark: '#E55A00',
    secondary: '#2E7D32',
    secondaryDark: '#1B5E20',
    background: '#F9FAFB',
    surface: '#FFFFFF',
    textPrimary: '#111827',
    textSecondary: '#4B5563',
    textMuted: '#9CA3AF',
    border: '#E5E7EB',
    earth: '#8B4513',
    danger: '#DC2626',
    warning: '#F59E0B',
    success: '#10B981',
    overlay: 'rgba(0,0,0,0.45)',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },
  spacing: (n: number) => n * 4,
};

export const formatINR = (v: number) =>
  '\u20B9' + Math.round(v).toLocaleString('en-IN');
