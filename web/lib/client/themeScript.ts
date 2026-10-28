// No React here: imported by the server layout (app/layout.tsx) as well as by theme.ts.
export const THEME_KEY = 'hw-theme';

/** Runs in <head> before first paint so a saved dark theme never flashes light. Keep it tiny. */
export const THEME_INIT_SCRIPT =
  `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;
