// Синхронизация «сначала локально»: всё пишется в IndexedDB на телефоне,
// а когда есть интернет, изменения уходят в Supabase и приходят обратно от второго телефона.
// При конфликте побеждает более позднее изменение (updated_at), это проверяет триггер в базе.
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { getSupabase, syncConfigured, type Household } from '../lib/supabase';
import { db, getMeta, setMeta } from './db';
import { onLocalChange, SETTINGS_ID } from './repo';
import { pullChanges, pushDirty, type RemoteRecords, type RemoteRow } from './syncCore';

export type SyncState = 'off' | 'signed-out' | 'no-household' | 'offline' | 'syncing' | 'idle' | 'error';

interface Status { state: SyncState; error: string | null; lastSyncAt: number | null }

let status: Status = { state: syncConfigured ? 'signed-out' : 'off', error: null, lastSyncAt: null };
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

let running: Promise<void> | null = null;
let again = false;
let channel: RealtimeChannel | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function remote(sb: SupabaseClient): RemoteRecords {
  return {
    async upsert(rows) {
      const { error } = await sb.from('records').upsert(rows, { onConflict: 'household_id,id' });
      if (error) throw new Error(error.message);
    },
    async changesSince(householdId, cursor, limit) {
      const { data, error } = await sb
        .from('records')
        .select('*')
        .eq('household_id', householdId)
        .gt('synced_at', cursor)
        .order('synced_at', { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as RemoteRow[];
    },
  };
}

/** Сообщения сервера — понятными словами */
function humanError(message: string): string {
  if (/jwt|token|auth/i.test(message)) return 'Вход устарел. Выйдите и войдите снова.';
  if (/row-level security|permission|policy/i.test(message)) return 'Нет доступа к дому. Попросите новый код приглашения.';
  if (/check constraint|records_kind_check/i.test(message)) return 'База на сервере устарела: выполните обновление из supabase/schema.sql.';
  return message;
}

async function syncOnce() {
  if (!syncConfigured) return setStatus({ state: 'off' });
  if (!navigator.onLine) return setStatus({ state: 'offline' });
  try {
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return setStatus({ state: 'signed-out' });
    const meta = await getMeta();
    if (!meta.householdId) return setStatus({ state: 'no-household' });

    setStatus({ state: 'syncing', error: null });
    const api = remote(sb);
    await pushDirty(db, api, meta.householdId);
    await pullChanges(db, api, meta.householdId);
    const now = Date.now();
    await setMeta({ lastSyncAt: now });
    setStatus({ state: 'idle', lastSyncAt: now });
    subscribe(sb, meta.householdId);
  } catch (e) {
    const offline = !navigator.onLine || e instanceof TypeError;
    setStatus({ state: offline ? 'offline' : 'error', error: offline ? null : humanError((e as Error).message) });
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

function subscribe(sb: SupabaseClient, householdId: string) {
  if (channel) return;
  channel = sb
    .channel(`records-${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `household_id=eq.${householdId}` }, () => scheduleSync(500))
    .subscribe();
}

async function unsubscribe() {
  if (!channel) return;
  const sb = await getSupabase();
  await sb.removeChannel(channel);
  channel = null;
}

export function startSync(): () => void {
  if (!syncConfigured) return () => {};
  let stopAuth: (() => void) | null = null;
  let stopped = false;
  const offChange = onLocalChange(() => scheduleSync());
  const onOnline = () => void syncNow();
  const onVisible = () => { if (document.visibilityState === 'visible') void syncNow(); };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(() => { if (document.visibilityState === 'visible') void syncNow(); }, 60_000);
  void getSupabase().then((sb) => {
    if (stopped) return;
    const { data } = sb.auth.onAuthStateChange(() => scheduleSync(200));
    stopAuth = () => data.subscription.unsubscribe();
  });
  // Первую синхронизацию откладываем, чтобы не мешать открытию приложения
  scheduleSync(800);
  return () => {
    stopped = true;
    offChange();
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
    stopAuth?.();
    void unsubscribe();
  };
}

// ——— Вход и дом ———

export async function sendLoginCode(email: string): Promise<void> {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw new Error(/rate limit/i.test(error.message) ? 'Письмо уже отправлено. Подождите минуту перед новой попыткой.' : error.message);
}

export async function verifyLoginCode(email: string, code: string): Promise<void> {
  const sb = await getSupabase();
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) throw new Error('Код не подошёл. Проверьте последнее письмо или запросите новый код.');
  await restoreHousehold(sb);
}

/** После входа находит дом, в котором уже состоит пользователь */
async function restoreHousehold(sb: SupabaseClient) {
  const { data, error } = await sb.rpc('my_household');
  if (error) throw new Error(humanError(error.message));
  const household = (Array.isArray(data) ? data[0] : data) as Household | null;
  if (household?.id) await attachHousehold(household, false);
  else scheduleSync(0);
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
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('create_household', { p_name: name.trim() || 'Наш дом' });
  if (error) throw new Error(humanError(error.message));
  await attachHousehold(data as Household, false);
}

export async function joinHousehold(code: string): Promise<void> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('join_household', { p_code: code.trim().toUpperCase() });
  if (error) throw new Error(error.message.includes('not found') ? 'Дом с таким кодом не найден.' : humanError(error.message));
  await attachHousehold(data as Household, true);
}

export async function signOut(): Promise<void> {
  await unsubscribe();
  if (syncConfigured) await (await getSupabase()).auth.signOut();
  await setMeta({ householdId: null, householdName: null, inviteCode: null, syncCursor: null });
  setStatus({ state: 'signed-out' });
}
