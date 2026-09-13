// Журнал ошибок с телефона. Код доступа не нужен — ошибка может случиться до того, как его ввели,
// поэтому принимаем только короткие записи строгого вида и ограничиваем их число в час и в сутки.
import { z } from 'zod';
import { takeQuota } from './quota.js';
import { serverDb } from './store.js';

export const LogEntrySchema = z.object({
  version: z.string().max(20),
  screen: z.string().max(40),
  kind: z.enum(['crash', 'error', 'ai', 'scan', 'backup', 'push']),
  message: z.string().min(1).max(500),
  stack: z.string().max(2000).optional(),
  device: z.string().max(80).optional(),
  count: z.number().int().min(1).max(1000).default(1),
});

export const LogBatchSchema = z.object({ entries: z.array(LogEntrySchema).min(1).max(20) });

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function handleLogRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Используйте POST' });
  const db = serverDb();
  if (!db) return json(503, { error: 'Журнал не настроен' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Некорректный запрос' });
  }
  const parsed = LogBatchSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: 'Некорректный запрос' });

  if ((await takeQuota('log', { hour: 60, day: 300 })) !== 'ok') return json(429, { error: 'Слишком много записей' });

  const { error } = await db.from('client_errors').insert(parsed.data.entries.map((e) => ({
    app_version: e.version,
    screen: e.screen,
    kind: e.kind,
    message: e.message,
    stack: e.stack ?? null,
    device: e.device ?? null,
    count: e.count,
  })));
  return error ? json(500, { error: 'Не удалось записать' }) : json(200, { ok: true });
}
