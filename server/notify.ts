// Ежедневная рассылка: каждому подписанному телефону — какие продукты истекают сегодня и завтра.
// Запускается планировщиком Vercel (vercel.json → crons).
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { expiryDigest, localDate, type DigestItem } from './expiryDigest.js';

interface SubscriptionRow {
  id: string;
  household_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  time_zone: string;
  last_sent_on: string | null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export async function handleExpiryCron(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return json(401, { error: 'Нет доступа' });

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!url || !serviceKey || !publicKey || !privateKey) {
    return json(500, { error: 'Не заданы VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_VAPID_PUBLIC_KEY или VAPID_PRIVATE_KEY' });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:family@example.com', publicKey, privateKey);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: subs, error } = await db.from('push_subscriptions').select('*');
  if (error) return json(500, { error: error.message });

  const now = new Date();
  const itemsByHousehold = new Map<string, DigestItem[]>();
  let sent = 0;
  let removed = 0;

  for (const sub of (subs ?? []) as SubscriptionRow[]) {
    const today = localDate(now, sub.time_zone);
    if (sub.last_sent_on === today) continue;
    const tomorrow = localDate(now, sub.time_zone, 1);

    let items = itemsByHousehold.get(sub.household_id);
    if (!items) {
      const { data: rows, error: itemsError } = await db
        .from('records')
        .select('data')
        .eq('household_id', sub.household_id)
        .eq('kind', 'item')
        .eq('deleted', false)
        .gte('data->>expiresAt', today)
        .lte('data->>expiresAt', tomorrow);
      if (itemsError) return json(500, { error: itemsError.message });
      items = (rows ?? []).map((r) => r.data as DigestItem);
      itemsByHousehold.set(sub.household_id, items);
    }

    const digest = expiryDigest(items, today, tomorrow);
    if (!digest) continue;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(digest),
        { TTL: 6 * 3600, urgency: 'normal' },
      );
      await db.from('push_subscriptions').update({ last_sent_on: today }).eq('id', sub.id);
      sent += 1;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // Подписка больше не действует: приложение удалили или запретили уведомления
      if (status === 404 || status === 410) {
        await db.from('push_subscriptions').delete().eq('id', sub.id);
        removed += 1;
      }
    }
  }
  return json(200, { subscriptions: subs?.length ?? 0, sent, removed });
}
