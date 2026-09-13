import { useSyncExternalStore } from 'react';

// Навигация через hash: работает офлайн и не требует настроек сервера.

export interface Route {
  name: string;
  params: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const [name = 'fridge', ...params] = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { name, params, query: new URLSearchParams(qs) };
}

let current = parse();
const listeners = new Set<() => void>();
window.addEventListener('hashchange', () => {
  current = parse();
  listeners.forEach((fn) => fn());
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => current,
  );
}

export function href(...parts: (string | number)[]): string {
  return `#/${parts.map((p) => encodeURIComponent(String(p))).join('/')}`;
}

export function go(path: string, replace = false): void {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (replace) location.replace(target);
  else location.hash = target;
}

export function back(fallback = '#/fridge'): void {
  if (history.length > 1) history.back();
  else go(fallback, true);
}
