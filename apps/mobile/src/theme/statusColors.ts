export type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface StatusColorPair {
  bg: string;
  text: string;
}

export const lightStatusColors: Record<StatusVariant, StatusColorPair> = {
  success: { bg: '#ecfdf5', text: '#047857' },
  warning: { bg: '#fffbeb', text: '#b45309' },
  danger: { bg: '#fef2f2', text: '#b91c1c' },
  neutral: { bg: '#f1f5f9', text: '#475569' },
  info: { bg: '#eef2ff', text: '#4338ca' },
};

export const darkStatusColors: Record<StatusVariant, StatusColorPair> = {
  success: { bg: '#022c22', text: '#6ee7b7' },
  warning: { bg: '#451a03', text: '#fcd34d' },
  danger: { bg: '#450a0a', text: '#fca5a5' },
  neutral: { bg: '#1e293b', text: '#cbd5e1' },
  info: { bg: '#1e1b4b', text: '#c7d2fe' },
};
