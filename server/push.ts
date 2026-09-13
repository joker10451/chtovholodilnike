// Подписка телефона на утренние уведомления — без входа по почте.
// Телефон присылает код доступа, адрес push-подписки и сроки продуктов (только названия и даты).
// Хранится в Supabase, доступ к таблице есть только у сервера.
import { z } from 'zod';
import { checkAccess } from './access.js';
import { serverDb } from './store.js';

/** Сервисы push браузеров. На другие адреса сервер ничего не отправляет */
const PUSH_HOSTS = ['web.push.apple.com', 'fcm.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com'];

const isPushEndpoint = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

const Endpoint = z.string().max(1000).refine(isPushEndpoint, 'Неизвестный сервис уведомлений');

export const SubscribeSchema = z.object({
  endpoint: Endpoint,
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  timeZone: z.string().max(60).default('Europe/Moscow'),
  items: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })).max(300),
});

export const UnsubscribeSchema = z.object({ endpoint: Endpoint });

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function handlePushRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST' && request.method !== 'DELETE') return json(405, { error: 'Используйте POST или DELETE' });
  const denied = checkAccess(request);
  if (denied) return denied;

  const db = serverDb();
  if (!db) return json(500, { error: 'Уведомления не настроены на сервере: нет SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY.' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Некорректный запрос' });
  }

  if (request.method === 'DELETE') {
    const parsed = UnsubscribeSchema.safeParse(body);
    if (!parsed.success) return json(400, { error: 'Некорректный запрос' });
    const { error } = await db.from('push_devices').delete().eq('endpoint', parsed.data.endpoint);
    return error ? json(500, { error: error.message }) : json(200, { ok: true });
  }

  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: 'Некорректный запрос', details: z.prettifyError(parsed.error) });
  const { endpoint, keys, timeZone, items } = parsed.data;
  const { error } = await db.from('push_devices').upsert({
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    time_zone: timeZone,
    items,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  return error ? json(500, { error: error.message }) : json(200, { ok: true });
}
