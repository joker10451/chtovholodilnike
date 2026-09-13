// Подписка телефона на утренние уведомления о сроках. Вход по почте не нужен:
// сервер получает код доступа и сроки продуктов (только названия и даты) и утром присылает напоминание.
// На iPhone push работает только у приложения, добавленного на экран «Домой» (iOS 16.4+).
import { getMeta, setMeta } from '../data/db';
import { getItems } from '../data/repo';
import { todayISO } from '../shared/dates';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushAvailability =
  | 'ready'
  | 'not-configured' // в сборке нет ключа уведомлений
  | 'install-first' // iPhone: сначала установить на экран «Домой»
  | 'unsupported';

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export async function pushAvailability(): Promise<PushAvailability> {
  if (!VAPID_PUBLIC_KEY) return 'not-configured';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (ios && !isStandalone()) return 'install-first';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return 'ready';
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function callPush(method: 'POST' | 'DELETE', body: unknown): Promise<void> {
  const { accessCode } = await getMeta();
  const res = await fetch('/api/push', {
    method,
    headers: { 'content-type': 'application/json', 'x-access-code': encodeURIComponent(accessCode) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Сервер уведомлений ответил ошибкой ${res.status}`);
  }
}

/** Что отправляем на сервер: продукты со сроком, начиная с сегодняшнего дня */
async function schedule(): Promise<{ name: string; expiresAt: string }[]> {
  const today = todayISO();
  return (await getItems())
    .filter((i) => i.expiresAt && i.expiresAt >= today && i.qty > 0)
    .sort((a, b) => a.expiresAt!.localeCompare(b.expiresAt!))
    .slice(0, 300)
    .map((i) => ({ name: i.name.slice(0, 80), expiresAt: i.expiresAt! }));
}

async function upload(sub: PushSubscription, force: boolean): Promise<void> {
  const json = sub.toJSON();
  const items = await schedule();
  const payload = {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow',
    items,
  };
  const hash = JSON.stringify(payload);
  if (!force && (await getMeta()).pushScheduleHash === hash) return;
  await callPush('POST', payload);
  await setMeta({ pushScheduleHash: hash });
}

export async function enablePush(): Promise<void> {
  if (!(await getMeta()).accessCode) throw new Error('Сначала введите код доступа ниже — он защищает уведомления от чужих.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Уведомления запрещены. Разрешите их: Настройки iPhone → Уведомления → Холодильник.');
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY!) }));
  try {
    await upload(sub, true);
  } catch (e) {
    await sub.unsubscribe().catch(() => {});
    throw e;
  }
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  try {
    await callPush('DELETE', { endpoint: sub.endpoint });
  } finally {
    await sub.unsubscribe();
    await setMeta({ pushScheduleHash: null });
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Продукты изменились — через несколько секунд обновим сроки на сервере (если уведомления включены) */
export function schedulePushUpdate(delay = 4000): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    void (async () => {
      if (!navigator.onLine) return;
      const sub = await currentSubscription();
      if (sub) await upload(sub, false);
    })().catch(() => { /* повторим при следующем изменении или запуске */ });
  }, delay);
}
