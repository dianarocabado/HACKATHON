// Light / dark theme. Follows the system until the user picks one; the pick is remembered per browser
// and applied as <html data-theme>, which the tokens in styles/tokens.css prefer over the system setting.
import { useSyncExternalStore } from 'react';
import { THEME_KEY } from './themeScript';

export type Theme = 'light' | 'dark';

const listeners = new Set<() => void>();
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function current(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === 'dark' || chosen === 'light') return chosen;
  return media().matches ? 'dark' : 'light';
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const m = media();
  m.addEventListener('change', cb);
  return () => { listeners.delete(cb); m.removeEventListener('change', cb); };
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
  listeners.forEach((cb) => cb());
}

/** The theme in effect; 'light' during server rendering and hydration, then the real one. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => 'light');
}
