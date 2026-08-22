export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  border: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  danger: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarMuted: string;
}

export const lightColors: ThemeColors = {
  background: '#f8fafc',
  foreground: '#0f172a',
  card: '#ffffff',
  cardForeground: '#0f172a',
  border: '#e2e8f0',
  mutedForeground: '#64748b',
  primary: '#4f46e5',
  primaryForeground: '#ffffff',
  danger: '#dc2626',
  sidebar: '#0f172a',
  sidebarForeground: '#f1f5f9',
  sidebarMuted: '#94a3b8',
};

export const darkColors: ThemeColors = {
  background: '#1e293b',
  foreground: '#f1f5f9',
  card: '#0f172a',
  cardForeground: '#f1f5f9',
  border: '#334155',
  mutedForeground: '#94a3b8',
  primary: '#6366f1',
  primaryForeground: '#ffffff',
  danger: '#f87171',
  sidebar: '#0f172a',
  sidebarForeground: '#f1f5f9',
  sidebarMuted: '#94a3b8',
};
