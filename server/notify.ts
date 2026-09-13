// Ежедневная рассылка: каждому подписанному телефону — какие продукты истекают сегодня и завтра.
// Запускается планировщиком Vercel (vercel.json → crons).
import webpush from 'web-push';
import { expiryDigest, localDate, type DigestItem } from './expiryDigest.js';
import { pushStore } from './push.js';

interface DeviceRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  time_zone: string;
  items: DigestItem[] | null;
  last_sent_on: string | null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export async function handleExpiryCron(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return json(401, { error: 'Нет доступа' });

  const db = pushStore();
  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!db || !publicKey || !privateKey) {
    return json(500, { error: 'Не заданы SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_VAPID_PUBLIC_KEY или VAPID_PRIVATE_KEY' });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:family@example.com', publicKey, privateKey);

  const { data: devices, error } = await db.from('push_devices').select('endpoint, p256dh, auth, time_zone, items, last_sent_on');
  if (error) return json(500, { error: error.message });

  const now = new Date();
  let sent = 0;
  let removed = 0;

  for (const device of (devices ?? []) as DeviceRow[]) {
    const today = localDate(now, device.time_zone);
    if (device.last_sent_on === today) continue;
    const digest = expiryDigest(device.items ?? [], today, localDate(now, device.time_zone, 1));
    if (!digest) continue;
    try {
      await webpush.sendNotification(
        { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        JSON.stringify(digest),
        { TTL: 6 * 3600, urgency: 'normal' },
      );
      await db.from('push_devices').update({ last_sent_on: today }).eq('endpoint', device.endpoint);
      sent += 1;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // Подписка больше не действует: приложение удалили или запретили уведомления
      if (status === 404 || status === 410) {
        await db.from('push_devices').delete().eq('endpoint', device.endpoint);
        removed += 1;
      }
    }
  }
  return json(200, { devices: devices?.length ?? 0, sent, removed });
}
