'use client';
// Current interface language for all client components; remembered per browser, German by default.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { LANG_KEY, translate, type Lang, type MessageKey } from '@/lib/client/i18n';

// The stored choice is an external store read by every component through useSyncExternalStore, not
// passed down as a context value. React uses the server snapshot ('de', what the server rendered)
// while *that component* hydrates, even when a streamed Suspense part (e.g. the bottom nav on dynamic
// routes) hydrates long after the rest. A context value would already be 'en' then (React #418).
const listeners = new Set<() => void>();
function readLang(): Lang {
  try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'de'; } catch { return 'de'; }
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => { listeners.delete(cb); window.removeEventListener('storage', cb); };
}
const serverLang = (): Lang => 'de';

// Only holds the choice when storage is blocked (private mode), so it still applies for this page view.
const Ctx = createContext<{ override: Lang | null; setLang: (l: Lang) => void }>({ override: null, setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<Lang | null>(null);
  const stored = useSyncExternalStore(subscribe, readLang, serverLang);
  const lang = override ?? stored;

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setOverride(l);
    try { localStorage.setItem(LANG_KEY, l); } catch {}
    listeners.forEach((cb) => cb());
  }, []);

  const value = useMemo(() => ({ override, setLang }), [override, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  const { override, setLang } = useContext(Ctx);
  const stored = useSyncExternalStore(subscribe, readLang, serverLang);
  const lang = override ?? stored;
  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );
  return { lang, setLang, t };
}

/** Header button that flips between German and English. */
export function LangToggle() {
  const { lang, setLang, t } = useLang();
  return (
    <button
      onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
      aria-label={t('lang.switch')}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-2 text-[0.8125rem] font-semibold"
      style={{ borderColor: 'var(--border)' }}
    >
      {t('lang.other')}
    </button>
  );
}
