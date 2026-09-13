// Подписка телефона на утренние уведомления о сроках.
// На iPhone push работает только у приложения, добавленного на экран «Домой» (iOS 16.4+).
import { getMeta } from '../data/db';
import { getSupabase, syncConfigured } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushAvailability =
  | 'ready'
  | 'not-configured' // на сервере не настроены ключи или синхронизация
  | 'install-first' // iPhone: сначала установить на экран «Домой»
  | 'unsupported'
  | 'no-household'; // нужен общий дом — уведомления приходят по его продуктам

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export async function pushAvailability(): Promise<PushAvailability> {
  if (!syncConfigured || !VAPID_PUBLIC_KEY) return 'not-configured';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (ios && !isStandalone()) return 'install-first';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (!(await getMeta()).householdId) return 'no-household';
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
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Уведомления запрещены. Разрешите их: Настройки iPhone → Уведомления → Холодильник.');
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY!) }));
  const json = sub.toJSON();
  const { householdId } = await getMeta();
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !householdId) throw new Error('Сначала войдите и подключите общий холодильник.');
  const { error } = await sb.from('push_subscriptions').upsert({
    household_id: householdId,
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow',
  }, { onConflict: 'endpoint' });
  if (error) throw new Error(`Не удалось сохранить подписку: ${error.message}`);
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  try {
    const sb = await getSupabase();
    await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  } finally {
    await sub.unsubscribe();
  }
}
