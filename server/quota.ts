// Лимиты запросов: счётчики в Supabase, общие для всех копий серверной функции.
import { serverDb } from './store.js';

export type QuotaResult = 'ok' | 'hour' | 'day';

/** Число из переменной окружения или значение по умолчанию */
export function envLimit(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Засчитывает запрос. Если хранилище не настроено или недоступно — пропускаем, чтобы не ломать приложение */
export async function takeQuota(name: string, limits: { hour: number; day: number }, now = new Date()): Promise<QuotaResult> {
  const db = serverDb();
  if (!db) return 'ok';
  const iso = now.toISOString();
  try {
    const [hour, day] = await Promise.all([
      db.rpc('take_quota', { p_bucket: `${name}:h:${iso.slice(0, 13)}`, p_limit: limits.hour }),
      db.rpc('take_quota', { p_bucket: `${name}:d:${iso.slice(0, 10)}`, p_limit: limits.day }),
    ]);
    if (hour.error || day.error) return 'ok';
    if (day.data === false) return 'day';
    if (hour.data === false) return 'hour';
    return 'ok';
  } catch {
    return 'ok';
  }
}
