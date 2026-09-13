import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface PwaState {
  hasUpdate: boolean;
  isUpdating: boolean;
  offlineReady: boolean;
  dismissed: boolean;
}

let state: PwaState = {
  hasUpdate: false,
  isUpdating: false,
  offlineReady: false,
  dismissed: false,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function updateState(partial: Partial<PwaState>) {
  state = { ...state, ...partial };
  notify();
}

let updateFunction: ((reloadPage?: boolean) => Promise<void>) | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

// Автоматический релоад при смене контроллера (когда новый SW активирован)
let refreshing = false;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

export function initPwa() {
  if (typeof window === 'undefined') return;

  updateFunction = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateState({ hasUpdate: true, dismissed: false });
    },
    onOfflineReady() {
      updateState({ offlineReady: true });
    },
    onRegisteredSW(_url, registration) {
      if (registration) {
        swRegistration = registration;

        // Проверяем обновления при каждом возвращении в приложение
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && navigator.onLine) {
            void registration.update();
          }
        });

        // Периодическая проверка раз в 15 минут
        setInterval(() => {
          if (navigator.onLine) {
            void registration.update();
          }
        }, 15 * 60 * 1000);
      }
    },
  });
}

/** Применить обновление и перезагрузить приложение */
export async function applyUpdate() {
  updateState({ isUpdating: true });
  try {
    if (updateFunction) {
      await updateFunction(true);
    } else if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
}

/** Принудительно проверить наличие обновления */
export async function checkForUpdate(): Promise<boolean> {
  if (swRegistration) {
    try {
      await swRegistration.update();
      return state.hasUpdate;
    } catch {
      return false;
    }
  }
  return false;
}

/** Скрыть баннер обновления на этот сеанс */
export function dismissUpdate() {
  updateState({ dismissed: true });
}

/** Хук для компонентов */
export function usePwaUpdate(): PwaState & {
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  checkForUpdate: () => Promise<boolean>;
} {
  const current = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );

  return {
    ...current,
    applyUpdate,
    dismissUpdate,
    checkForUpdate,
  };
}
