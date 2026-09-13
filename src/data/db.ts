import Dexie, { type EntityTable } from 'dexie';
import type { DeviceMeta, ScanJob, SyncRecord } from './types';

/** Ответ нейросети, сохранённый, чтобы не отправлять одно и то же фото повторно */
export interface AiCacheRow {
  key: string;
  value: unknown;
  createdAt: number;
}

export type AppDb = Dexie & {
  records: EntityTable<SyncRecord, 'id'>;
  scans: EntityTable<ScanJob, 'id'>;
  meta: EntityTable<{ key: string; value: unknown }, 'key'>;
  aicache: EntityTable<AiCacheRow, 'key'>;
};

export function openDb(name: string): AppDb {
  const d = new Dexie(name) as AppDb;
  d.version(1).stores({
    records: 'id, kind, dirty, updatedAt',
    scans: 'id, createdAt, status',
    meta: 'key',
  });
  d.version(2).stores({ aicache: 'key, createdAt' });
  return d;
}

export const db = openDb('holodilnik');

export const DEFAULT_META: DeviceMeta = {
  onboarded: false,
  accessCode: '',
  lastBackupAt: null,
};

export async function getMeta(store: AppDb = db): Promise<DeviceMeta> {
  const row = await store.meta.get('device');
  return { ...DEFAULT_META, ...((row?.value as Partial<DeviceMeta>) ?? {}) };
}

export async function setMeta(patch: Partial<DeviceMeta>, store: AppDb = db): Promise<DeviceMeta> {
  return store.transaction('rw', store.meta, async () => {
    const next = { ...(await getMeta(store)), ...patch };
    await store.meta.put({ key: 'device', value: next });
    return next;
  });
}

export function newId(): string {
  // randomUUID есть только на https и localhost, а телефон в локальной сети открывает dev-сервер по http
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
