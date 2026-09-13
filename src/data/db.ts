import Dexie, { type EntityTable } from 'dexie';
import type { DeviceMeta, ScanJob, SyncRecord } from './types';

export const db = new Dexie('holodilnik') as Dexie & {
  records: EntityTable<SyncRecord, 'id'>;
  scans: EntityTable<ScanJob, 'id'>;
  meta: EntityTable<{ key: string; value: unknown }, 'key'>;
};

db.version(1).stores({
  records: 'id, kind, dirty, updatedAt',
  scans: 'id, createdAt, status',
  meta: 'key',
});

export const DEFAULT_META: DeviceMeta = {
  onboarded: false,
  accessCode: '',
  householdId: null,
  householdName: null,
  inviteCode: null,
  syncCursor: null,
  lastSyncAt: null,
};

export async function getMeta(): Promise<DeviceMeta> {
  const row = await db.meta.get('device');
  return { ...DEFAULT_META, ...((row?.value as Partial<DeviceMeta>) ?? {}) };
}

export async function setMeta(patch: Partial<DeviceMeta>): Promise<DeviceMeta> {
  return db.transaction('rw', db.meta, async () => {
    const next = { ...(await getMeta()), ...patch };
    await db.meta.put({ key: 'device', value: next });
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
