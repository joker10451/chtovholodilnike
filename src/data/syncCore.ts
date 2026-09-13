// Обмен изменениями с сервером, без привязки к Supabase — чтобы проверять тестами.
import { getMeta, setMeta, type AppDb } from './db';
import type { RecordKind } from './types';

export interface RemoteRow {
  household_id: string;
  id: string;
  kind: RecordKind;
  data: unknown;
  updated_at: number;
  deleted: boolean;
  synced_at: string;
}

export type RemoteRowInput = Omit<RemoteRow, 'synced_at'>;

/** Что нужно от сервера: записать пачку и отдать изменения после отметки */
export interface RemoteRecords {
  upsert(rows: RemoteRowInput[]): Promise<void>;
  changesSince(householdId: string, cursor: string, limit: number): Promise<RemoteRow[]>;
}

export const PAGE = 500;
const EPOCH = '1970-01-01T00:00:00Z';

/** Отправляет несинхронизированные записи. Запись, изменённую во время отправки, оставляет на следующий раз */
export async function pushDirty(store: AppDb, api: RemoteRecords, householdId: string, page = PAGE): Promise<number> {
  const dirty = await store.records.where('dirty').equals(1).toArray();
  for (let i = 0; i < dirty.length; i += page) {
    const batch = dirty.slice(i, i + page);
    await api.upsert(batch.map((r) => ({
      household_id: householdId, id: r.id, kind: r.kind, data: r.data, updated_at: r.updatedAt, deleted: r.deleted === 1,
    })));
    await store.transaction('rw', store.records, async () => {
      for (const sent of batch) {
        const current = await store.records.get(sent.id);
        if (current && current.updatedAt === sent.updatedAt) await store.records.update(sent.id, { dirty: 0 });
      }
    });
  }
  return dirty.length;
}

/**
 * Забирает изменения второго телефона. Побеждает более позднее изменение;
 * локальную правку, которая ещё не ушла на сервер и новее серверной, не трогаем.
 */
export async function pullChanges(store: AppDb, api: RemoteRecords, householdId: string, page = PAGE): Promise<number> {
  let cursor = (await getMeta(store)).syncCursor ?? EPOCH;
  let total = 0;
  for (;;) {
    const rows = await api.changesSince(householdId, cursor, page);
    if (rows.length === 0) break;
    await store.transaction('rw', store.records, async () => {
      for (const row of rows) {
        const local = await store.records.get(row.id);
        const remoteWins = !local || row.updated_at > local.updatedAt || (row.updated_at === local.updatedAt && !local.dirty);
        if (remoteWins) {
          await store.records.put({
            id: row.id, kind: row.kind, data: row.data, updatedAt: row.updated_at, deleted: row.deleted ? 1 : 0, dirty: 0,
          });
        }
      }
    });
    total += rows.length;
    cursor = rows[rows.length - 1].synced_at;
    await setMeta({ syncCursor: cursor }, store);
    if (rows.length < page) break;
  }
  return total;
}
