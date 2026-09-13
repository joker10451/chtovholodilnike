// Очередь фото на распознавание. Без интернета фото ждут на телефоне
// и отправляются, как только связь появится.
import { AiRequestError, OfflineError, recognize } from '../lib/ai';
import { reportError } from '../lib/errorLog';
import { toImagePart } from '../lib/image';
import { todayISO } from '../shared/dates';
import { db, newId } from './db';
import type { ScanMode } from './types';


let processing = false;

export async function enqueueScan(mode: ScanMode, photos: Blob[]): Promise<string> {
  const id = newId();
  await db.scans.put({ id, mode, photos, createdAt: Date.now(), status: 'queued' });
  void processScanQueue();
  return id;
}

export async function retryScan(id: string): Promise<void> {
  await db.scans.update(id, { status: 'queued', error: undefined });
  void processScanQueue();
}

export async function removeScan(id: string): Promise<void> {
  await db.scans.delete(id);
}

export async function processScanQueue(): Promise<void> {
  if (processing || !navigator.onLine) return;
  processing = true;
  try {
    for (;;) {
      const job = await db.scans.where('status').equals('queued').first();
      if (!job) break;
      await db.scans.update(job.id, { status: 'processing' });
      try {
        const images = await Promise.all(job.photos.map(toImagePart));
        const result = await recognize({ task: job.mode, today: todayISO(), images });
        await db.scans.update(job.id, { status: 'ready', result, error: undefined });
      } catch (e) {
        if (e instanceof OfflineError) {
          await db.scans.update(job.id, { status: 'queued' });
          break;
        }
        if (!(e instanceof AiRequestError)) reportError('scan', e, job.mode);
        const message = e instanceof AiRequestError ? e.message : 'Не получилось распознать фото. Попробуйте ещё раз.';
        await db.scans.update(job.id, { status: 'error', error: message });
      }
    }
  } finally {
    processing = false;
  }
}

/** Сканы, зависшие в «processing» после закрытия приложения, возвращаем в очередь */
export async function recoverScans(): Promise<void> {
  await db.scans.where('status').equals('processing').modify({ status: 'queued' });
  // Применённые сканы с фото держим не дольше недели
  const weekAgo = Date.now() - 7 * 86_400_000;
  await db.scans.filter((s) => s.status === 'applied' && s.createdAt < weekAgo).delete();
}
