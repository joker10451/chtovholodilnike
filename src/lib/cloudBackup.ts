// Облачная резервная копия: раз в день, если данные изменились, телефон сам сохраняет
// зашифрованную копию на сервер. Восстановить можно на любом телефоне по коду доступа.
import { db, getMeta, setMeta } from '../data/db';
import type { SyncRecord } from '../data/types';
import { BackupCodeError, openBackup, sealBackup } from './backupCodec';

export { BackupCodeError };

export interface CloudBackupInfo {
  id: number;
  createdAt: string;
  records: number;
  products: number;
  size: number;
}

export interface BackupFile {
  app: 'holodilnik';
  version: 1;
  exportedAt: string;
  records: SyncRecord[];
}

const DAY = 24 * 3600 * 1000;
/** Автокопия не чаще, чем раз в это время */
const AUTO_INTERVAL = 20 * 3600 * 1000;

export async function localRecords(): Promise<SyncRecord[]> {
  const rows = await db.records.filter((r) => !r.deleted).toArray();
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

export function backupFile(records: SyncRecord[]): BackupFile {
  return { app: 'holodilnik', version: 1, exportedAt: new Date().toISOString(), records };
}

export function parseBackupFile(text: string): BackupFile {
  const parsed = JSON.parse(text) as Partial<BackupFile>;
  if (parsed.app !== 'holodilnik' || !Array.isArray(parsed.records)) throw new Error('Это не резервная копия приложения');
  return parsed as BackupFile;
}

/** Кладёт записи из копии на телефон. Совпадающие по id заменяются, остальные остаются */
export async function applyBackupRecords(records: SyncRecord[]): Promise<void> {
  const now = Date.now();
  await db.records.bulkPut(records.map((r) => ({ ...r, updatedAt: now, dirty: 1 as const })));
}

async function fingerprint(records: SyncRecord[]): Promise<string> {
  const text = JSON.stringify(records.map((r) => [r.id, r.data]));
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function api<T>(path: string, init?: RequestInit, code?: string): Promise<T> {
  const accessCode = code ?? (await getMeta()).accessCode;
  if (!accessCode) throw new Error('Введите код доступа — им защищена и зашифрована копия.');
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', 'x-access-code': encodeURIComponent(accessCode), ...init?.headers },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error('Нет связи с сервером. Проверьте интернет (и VPN).');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Сервер ответил ошибкой ${res.status}`);
  return data;
}

export async function listCloudBackups(code?: string): Promise<CloudBackupInfo[]> {
  return (await api<{ backups: CloudBackupInfo[] }>('/api/backup', undefined, code)).backups;
}

export async function saveCloudBackup(): Promise<void> {
  const { accessCode } = await getMeta();
  const records = await localRecords();
  const payload = await sealBackup(JSON.stringify(backupFile(records)), accessCode);
  await api('/api/backup', {
    method: 'POST',
    body: JSON.stringify({ payload, records: records.length, products: records.filter((r) => r.kind === 'item').length }),
  });
  await setMeta({ lastCloudBackupAt: Date.now(), cloudBackupHash: await fingerprint(records) });
}

/** Скачивает и расшифровывает копию. Ничего не меняет на телефоне */
export async function fetchCloudBackup(id: number, code?: string): Promise<BackupFile> {
  const accessCode = code ?? (await getMeta()).accessCode;
  const { payload } = await api<{ payload: string }>(`/api/backup?id=${id}`, undefined, accessCode);
  return parseBackupFile(await openBackup(payload, accessCode));
}

let running = false;

/**
 * Тихая автокопия. Не сохраняет, если ничего не изменилось, если прошло меньше суток,
 * и если на телефоне заметно меньше данных, чем в последней копии (похоже на новую установку —
 * такая копия вытеснила бы настоящие данные).
 */
export async function maybeAutoBackup(): Promise<void> {
  if (running || !navigator.onLine || !crypto.subtle) return;
  running = true;
  try {
    const meta = await getMeta();
    if (!meta.accessCode || !meta.onboarded) return;
    if (meta.lastCloudBackupAt && Date.now() - meta.lastCloudBackupAt < AUTO_INTERVAL) return;
    const records = await localRecords();
    if (records.length === 0) return;
    if ((await fingerprint(records)) === meta.cloudBackupHash) return;

    const [latest] = await listCloudBackups();
    const fresh = latest && Date.now() - new Date(latest.createdAt).getTime() < 30 * DAY;
    if (fresh && records.length < latest.records / 2 && latest.records - records.length > 10) return;

    await saveCloudBackup();
  } catch {
    // Повторим при следующем запуске
  } finally {
    running = false;
  }
}

export function formatBackupDate(iso: string | number): string {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}
