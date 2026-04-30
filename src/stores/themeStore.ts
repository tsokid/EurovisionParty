import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

// Day mode is currently disabled — theme is locked to dark.
function applyDarkTheme() {
  if (typeof window === 'undefined') return;
  document.documentElement.setAttribute('data-theme', 'dark');
  localStorage.setItem('europarty-theme', 'dark');
}

export const useThemeStore = create<ThemeState>()(() => {
  applyDarkTheme();
  return {
    theme: 'dark' as Theme,
    toggleTheme: () => { /* disabled */ },
  };
});
