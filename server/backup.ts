// Облачные резервные копии без входа по почте: доступ по коду доступа семьи.
// Копии зашифрованы на телефоне тем же кодом — сервер хранит только непрочитываемые байты.
import { z } from 'zod';
import { checkAccess } from './access.js';
import { serverDb } from './store.js';

/** Сколько последних копий хранить */
export const KEEP_BACKUPS = 5;

export const UploadSchema = z.object({
  // Vercel принимает тело до 4,5 МБ
  payload: z.string().min(40).max(4_200_000).regex(/^[A-Za-z0-9+/]+=*$/),
  records: z.number().int().min(0).max(1_000_000),
  products: z.number().int().min(0).max(1_000_000),
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function handleBackupRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') return json(405, { error: 'Используйте GET или POST' });
  const denied = checkAccess(request);
  if (denied) return denied;

  const db = serverDb();
  if (!db) return json(500, { error: 'Облачные копии не настроены на сервере: нет SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY.' });

  if (request.method === 'GET') {
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      if (!/^\d+$/.test(id)) return json(400, { error: 'Некорректный запрос' });
      const { data, error } = await db.from('backups').select('payload').eq('id', Number(id)).maybeSingle();
      if (error) return json(500, { error: error.message });
      return data ? json(200, data) : json(404, { error: 'Копия не найдена' });
    }
    const { data, error } = await db.from('backups')
      .select('id, created_at, records, products, size')
      .order('created_at', { ascending: false })
      .limit(KEEP_BACKUPS);
    if (error) return json(500, { error: error.message });
    return json(200, {
      backups: (data ?? []).map((b) => ({ id: b.id, createdAt: b.created_at, records: b.records, products: b.products, size: b.size })),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Копия слишком большая или повреждена' });
  }
  const parsed = UploadSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: 'Некорректная копия' });
  const { payload, records, products } = parsed.data;

  const { data: inserted, error } = await db.from('backups')
    .insert({ payload, records, products, size: payload.length })
    .select('id, created_at')
    .single();
  if (error) return json(500, { error: error.message });

  // Старые копии сверх лимита удаляем
  const { data: old } = await db.from('backups').select('id').order('created_at', { ascending: false }).range(KEEP_BACKUPS, KEEP_BACKUPS + 100);
  if (old?.length) await db.from('backups').delete().in('id', old.map((b) => b.id));

  return json(200, { id: inserted.id, createdAt: inserted.created_at });
}
