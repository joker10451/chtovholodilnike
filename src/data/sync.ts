// Синхронизация «сначала локально»: всё пишется в IndexedDB на телефоне,
// а когда есть интернет, изменения уходят в Supabase и приходят обратно от второго телефона.
// При конфликте побеждает более позднее изменение (updated_at), это проверяет триггер в базе.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { supabase, type Household } from '../lib/supabase';
import { db, getMeta, setMeta } from './db';
import { onLocalChange, SETTINGS_ID } from './repo';
import type { SyncRecord } from './types';

export type SyncState = 'off' | 'signed-out' | 'no-household' | 'offline' | 'syncing' | 'idle' | 'error';

interface Status { state: SyncState; error: string | null; lastSyncAt: number | null }

let status: Status = { state: supabase ? 'signed-out' : 'off', error: null, lastSyncAt: null };
const statusListeners = new Set<() => void>();

function setStatus(patch: Partial<Status>) {
  status = { ...status, ...patch };
  statusListeners.forEach((fn) => fn());
}

export function useSyncStatus(): Status {
  return useSyncExternalStore(
    (fn) => { statusListeners.add(fn); return () => statusListeners.delete(fn); },
    () => status,
  );
}

interface RemoteRow {
  household_id: string;
  id: string;
  kind: SyncRecord['kind'];
  data: unknown;
  updated_at: number;
  deleted: boolean;
  synced_at: string;
}

const PAGE = 500;
let running: Promise<void> | null = null;
let again = false;
let channel: RealtimeChannel | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function push(householdId: string) {
  const dirty = await db.records.where('dirty').equals(1).toArray();
  for (let i = 0; i < dirty.length; i += PAGE) {
    const batch = dirty.slice(i, i + PAGE);
    const { error } = await supabase!.from('records').upsert(
      batch.map((r) => ({
        household_id: householdId, id: r.id, kind: r.kind, data: r.data, updated_at: r.updatedAt, deleted: r.deleted === 1,
      })),
      { onConflict: 'household_id,id' },
    );
    if (error) throw new Error(error.message);
    await db.transaction('rw', db.records, async () => {
      for (const sent of batch) {
        const current = await db.records.get(sent.id);
        if (current && current.updatedAt === sent.updatedAt) await db.records.update(sent.id, { dirty: 0 });
      }
    });
  }
}

async function pull(householdId: string) {
  let cursor = (await getMeta()).syncCursor ?? '1970-01-01T00:00:00Z';
  for (;;) {
    const { data, error } = await supabase!
      .from('records')
      .select('*')
      .eq('household_id', householdId)
      .gt('synced_at', cursor)
      .order('synced_at', { ascending: true })
      .limit(PAGE);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as RemoteRow[];
    if (rows.length === 0) break;

    await db.transaction('rw', db.records, async () => {
      for (const row of rows) {
        const local = await db.records.get(row.id);
        const remoteWins = !local || row.updated_at > local.updatedAt || (row.updated_at === local.updatedAt && !local.dirty);
        if (remoteWins) {
          await db.records.put({
            id: row.id, kind: row.kind, data: row.data, updatedAt: row.updated_at, deleted: row.deleted ? 1 : 0, dirty: 0,
          });
        }
      }
    });
    cursor = rows[rows.length - 1].synced_at;
    await setMeta({ syncCursor: cursor });
    if (rows.length < PAGE) break;
  }
}

async function syncOnce() {
  if (!supabase) return setStatus({ state: 'off' });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return setStatus({ state: 'signed-out' });
  const meta = await getMeta();
  if (!meta.householdId) return setStatus({ state: 'no-household' });
  if (!navigator.onLine) return setStatus({ state: 'offline' });

  setStatus({ state: 'syncing', error: null });
  try {
    await push(meta.householdId);
    await pull(meta.householdId);
    const now = Date.now();
    await setMeta({ lastSyncAt: now });
    setStatus({ state: 'idle', lastSyncAt: now });
    subscribe(meta.householdId);
  } catch (e) {
    const offline = !navigator.onLine || (e instanceof TypeError);
    setStatus({ state: offline ? 'offline' : 'error', error: offline ? null : (e as Error).message });
  }
}

/** Запускает синхронизацию; повторные вызовы во время работы склеиваются в один */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
  })().finally(() => { running = null; });
  return running;
}

function scheduleSync(delay = 1500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void syncNow(); }, delay);
}

function subscribe(householdId: string) {
  if (!supabase || channel) return;
  channel = supabase
    .channel(`records-${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `household_id=eq.${householdId}` }, () => scheduleSync(500))
    .subscribe();
}

async function unsubscribe() {
  if (channel && supabase) await supabase.removeChannel(channel);
  channel = null;
}

export function startSync(): () => void {
  if (!supabase) return () => {};
  const offChange = onLocalChange(() => scheduleSync());
  const onOnline = () => void syncNow();
  const onVisible = () => { if (document.visibilityState === 'visible') void syncNow(); };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(() => { if (document.visibilityState === 'visible') void syncNow(); }, 60_000);
  const { data: auth } = supabase.auth.onAuthStateChange(() => scheduleSync(200));
  void syncNow();
  return () => {
    offChange();
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
    auth.subscription.unsubscribe();
    void unsubscribe();
  };
}

// ——— Вход и дом ———

export async function sendLoginCode(email: string): Promise<void> {
  const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}

export async function verifyLoginCode(email: string, code: string): Promise<void> {
  const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) throw new Error('Код не подошёл. Проверьте последнее письмо или запросите новый код.');
  await restoreHousehold();
}

/** После входа находит дом, в котором уже состоит пользователь */
async function restoreHousehold() {
  const { data, error } = await supabase!.rpc('my_household');
  if (error) throw new Error(error.message);
  const household = (Array.isArray(data) ? data[0] : data) as Household | null;
  if (household?.id) await attachHousehold(household, false);
}

async function attachHousehold(household: Household, joiningExisting: boolean) {
  await db.transaction('rw', db.records, db.meta, async () => {
    // Всё, что уже есть на телефоне, отправим в общий дом
    await db.records.toCollection().modify({ dirty: 1 });
    // Настройки дома, к которому присоединяемся, важнее локальных
    if (joiningExisting) await db.records.update(SETTINGS_ID, { updatedAt: 1 });
    await setMeta({ householdId: household.id, householdName: household.name, inviteCode: household.invite_code, syncCursor: null });
  });
  await unsubscribe();
  await syncNow();
}

export async function createHousehold(name: string): Promise<void> {
  const { data, error } = await supabase!.rpc('create_household', { p_name: name.trim() || 'Наш дом' });
  if (error) throw new Error(error.message);
  await attachHousehold(data as Household, false);
}

export async function joinHousehold(code: string): Promise<void> {
  const { data, error } = await supabase!.rpc('join_household', { p_code: code.trim().toUpperCase() });
  if (error) throw new Error(error.message.includes('not found') ? 'Дом с таким кодом не найден.' : error.message);
  await attachHousehold(data as Household, true);
}

export async function signOut(): Promise<void> {
  await unsubscribe();
  await supabase?.auth.signOut();
  await setMeta({ householdId: null, householdName: null, inviteCode: null, syncCursor: null });
  setStatus({ state: 'signed-out' });
}
