// Обновление приложения без перезагрузки посреди дела.
// Новая версия скачивается в фоне и ставится, когда человек сам нажал «Обновить»
// или когда приложение свёрнуто — тогда перезагрузку никто не заметит.
import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface PwaState {
  hasUpdate: boolean;
  isUpdating: boolean;
  dismissed: boolean;
}

let state: PwaState = { hasUpdate: false, isUpdating: false, dismissed: false };
const listeners = new Set<() => void>();

function updateState(partial: Partial<PwaState>) {
  state = { ...state, ...partial };
  listeners.forEach((l) => l());
}

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | null = null;

export function initPwa() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateState({ hasUpdate: true, dismissed: false });
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      registration = reg;
      setInterval(() => { if (navigator.onLine && document.visibilityState === 'visible') void reg.update(); }, 30 * 60 * 1000);
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (navigator.onLine) void registration?.update();
    } else if (state.hasUpdate && !state.isUpdating) {
      // Приложение свернули — самое незаметное время поставить новую версию
      void applyUpdate();
    }
  });
}

export async function applyUpdate() {
  updateState({ isUpdating: true });
  try {
    if (updateSW) await updateSW(true);
    else window.location.reload();
  } catch {
    window.location.reload();
  }
}

/** Проверяет, есть ли новая версия. true — новая версия скачана и ждёт установки */
export async function checkForUpdate(): Promise<boolean> {
  if (!registration) return false;
  try {
    await registration.update();
    // Скачивание новой версии занимает пару секунд
    await new Promise((r) => setTimeout(r, 2500));
    return state.hasUpdate || !!registration.waiting;
  } catch {
    return false;
  }
}

export function dismissUpdate() {
  updateState({ dismissed: true });
}

export function usePwaUpdate() {
  const current = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
  );
  return { ...current, applyUpdate, dismissUpdate, checkForUpdate };
}
