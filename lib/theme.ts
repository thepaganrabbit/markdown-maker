import type { AppTheme } from '@/lib/types';
export type { AppTheme } from '@/lib/types';

export const THEME_STORAGE_KEY = 'doc-u-maker:theme';

export function applyTheme(theme: AppTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

export function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  return raw === 'dark' ? 'dark' : 'light';
}

export function saveTheme(theme: AppTheme) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}
