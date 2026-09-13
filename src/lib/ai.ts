import type { z } from 'zod';
import { db, getMeta } from '../data/db';
import {
  GeneratedRecipeSchema, PackageSchema, RecognitionSchema,
  type AiRequest, type GeneratedRecipe, type PackageInfo, type Recognition,
} from '../shared/aiSchemas';

export class OfflineError extends Error {
  constructor() {
    super('Нет интернета. Проверьте подключение или VPN.');
    this.name = 'OfflineError';
  }
}

export class AiRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AiRequestError';
  }
}

/** Сервер на Vercel живёт не дольше минуты; ждём чуть дольше, чтобы получить его собственную ошибку */
const TIMEOUT_MS = 70_000;
/** Ответ на то же фото или ту же фразу берём из памяти телефона — не тратим лимит нейросети */
const CACHE_TTL_MS = 7 * 86_400_000;
const CACHEABLE: AiRequest['task'][] = ['shelf', 'receipt', 'package', 'text', 'import'];

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Нейросеть не приняла код доступа. Проверьте код в настройках.',
  404: 'Нейросеть недоступна: на сервере не найдена функция /api/ai.',
  413: 'Фото слишком большие. Снимите меньше фото за раз.',
  429: 'Бесплатный лимит нейросети на сегодня закончился. Попробуйте позже.',
  504: 'Нейросеть не успела ответить. Попробуйте ещё раз — лучше с одним фото.',
};

async function cacheKey(body: AiRequest): Promise<string> {
  // Дата не влияет на распознавание упаковки или фразы — без неё один и тот же снимок совпадёт и завтра
  const { today: _today, ...rest } = body;
  const bytes = new TextEncoder().encode(JSON.stringify(rest));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return `${body.task}:${[...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

async function readCache(key: string): Promise<unknown | undefined> {
  try {
    const row = await db.aicache.get(key);
    if (row && Date.now() - row.createdAt < CACHE_TTL_MS) return row.value;
  } catch { /* кэш необязателен */ }
  return undefined;
}

async function writeCache(key: string, value: unknown) {
  try {
    await db.aicache.put({ key, value, createdAt: Date.now() });
    await db.aicache.where('createdAt').below(Date.now() - CACHE_TTL_MS).delete();
  } catch { /* кэш необязателен */ }
}

async function send(body: AiRequest, accessCode: string): Promise<Response> {
  const attempt = () => fetch('/api/ai', {
    method: 'POST',
    // В заголовках допустима только латиница, а код может быть по-русски
    headers: { 'content-type': 'application/json', 'x-access-code': encodeURIComponent(accessCode) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  try {
    return await attempt();
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') throw new AiRequestError(504, STATUS_MESSAGES[504]);
    // Связь моргнула (VPN переподключился) — одна повторная попытка
    if (!navigator.onLine) throw new OfflineError();
    await new Promise((r) => setTimeout(r, 1200));
    try {
      return await attempt();
    } catch (again) {
      if ((again as Error).name === 'TimeoutError') throw new AiRequestError(504, STATUS_MESSAGES[504]);
      throw new OfflineError();
    }
  }
}

async function call<T extends z.ZodType>(body: AiRequest, schema: T): Promise<z.infer<T>> {
  const key = CACHEABLE.includes(body.task) ? await cacheKey(body) : null;
  if (key) {
    const cached = schema.safeParse(await readCache(key));
    if (cached.success) return cached.data;
  }
  if (!navigator.onLine) throw new OfflineError();

  const { accessCode } = await getMeta();
  const res = await send(body, accessCode);
  const payload = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    throw new AiRequestError(res.status, payload?.error ?? STATUS_MESSAGES[res.status] ?? `Сервер нейросети ответил ошибкой ${res.status}. Попробуйте ещё раз.`);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new AiRequestError(502, 'Нейросеть ответила в неожиданном формате. Попробуйте ещё раз.');
  if (key) await writeCache(key, parsed.data);
  return parsed.data;
}

export function recognize(body: Extract<AiRequest, { task: 'shelf' | 'receipt' | 'text' }>): Promise<Recognition> {
  return call(body, RecognitionSchema);
}

export function generateRecipe(body: Extract<AiRequest, { task: 'recipe' | 'import' }>): Promise<GeneratedRecipe> {
  return call(body, GeneratedRecipeSchema);
}

export function readPackage(body: Extract<AiRequest, { task: 'package' }>): Promise<PackageInfo> {
  return call(body, PackageSchema);
}
