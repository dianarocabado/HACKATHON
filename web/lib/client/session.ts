// Who is signed in, shared by the header, the profile page and the mission claim form.
// External store read with useSyncExternalStore (like the language): the server snapshot is
// `undefined` = unknown, so hydration matches and components show nothing until the check returns.
import { useEffect, useSyncExternalStore } from 'react';
import type { UserProfile } from '@contracts/types';
import { api } from './api';

let user: UserProfile | null | undefined;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((cb) => cb());
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export function setSessionUser(next: UserProfile | null) {
  user = next;
  emit();
}

export function refreshSession(): Promise<void> {
  loading ??= api.session()
    .then((u) => setSessionUser(u))
    .catch(() => setSessionUser(null))
    .finally(() => { loading = null; });
  return loading;
}

/** `undefined` while unknown, `null` when signed out. */
export function useSession(): UserProfile | null | undefined {
  const current = useSyncExternalStore(subscribe, () => user, () => undefined);
  useEffect(() => { if (user === undefined) void refreshSession(); }, []);
  return current;
}
