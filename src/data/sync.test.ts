import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type AppDb } from './db';
import { pullChanges, pushDirty, type RemoteRecords, type RemoteRow } from './syncCore';
import type { RecordKind } from './types';

const HOUSE = 'house-1';

/** Сервер как в supabase/schema.sql: старая версия не перезаписывает новую, synced_at растёт */
function fakeServer() {
  const rows = new Map<string, RemoteRow>();
  let clock = 0;
  const api: RemoteRecords & { rows: Map<string, RemoteRow>; offline: boolean } = {
    rows,
    offline: false,
    async upsert(input) {
      if (api.offline) throw new TypeError('Failed to fetch');
      for (const r of input) {
        const key = `${r.household_id}/${r.id}`;
        const old = rows.get(key);
        if (old && r.updated_at < old.updated_at) continue;
        rows.set(key, { ...r, synced_at: new Date(Date.UTC(2026, 0, 1) + ++clock).toISOString() });
      }
    },
    async changesSince(householdId, cursor, limit) {
      if (api.offline) throw new TypeError('Failed to fetch');
      return [...rows.values()]
        .filter((r) => r.household_id === householdId && r.synced_at > cursor)
        .sort((a, b) => a.synced_at.localeCompare(b.synced_at))
        .slice(0, limit);
    },
  };
  return api;
}

let seq = 0;
async function phone(): Promise<AppDb> {
  const d = openDb(`test-phone-${++seq}`);
  await d.open();
  return d;
}

async function write(store: AppDb, id: string, data: unknown, updatedAt: number, kind: RecordKind = 'item', deleted = false) {
  await store.records.put({ id, kind, data, updatedAt, deleted: deleted ? 1 : 0, dirty: 1 });
}

async function sync(store: AppDb, server: RemoteRecords, page?: number) {
  await pushDirty(store, server, HOUSE, page);
  await pullChanges(store, server, HOUSE, page);
}

describe('синхронизация двух телефонов', () => {
  let server: ReturnType<typeof fakeServer>;
  let wife: AppDb;
  let husband: AppDb;

  beforeEach(async () => {
    server = fakeServer();
    wife = await phone();
    husband = await phone();
  });

  it('продукт, добавленный на одном телефоне, появляется на другом', async () => {
    await write(wife, 'kefir', { name: 'Кефир' }, 100);
    await sync(wife, server);
    await sync(husband, server);
    const row = await husband.records.get('kefir');
    expect(row?.data).toEqual({ name: 'Кефир' });
    expect(row?.dirty).toBe(0);
    expect((await wife.records.get('kefir'))?.dirty).toBe(0);
  });

  it('при правке одного продукта на двух телефонах побеждает более поздняя', async () => {
    await write(wife, 'milk', { qty: 1000 }, 100);
    await sync(wife, server);
    await sync(husband, server);

    // Оба без интернета поменяли одно и то же: жена позже
    await write(husband, 'milk', { qty: 500 }, 200);
    await write(wife, 'milk', { qty: 250 }, 300);

    // Первым синхронизировался муж, потом жена, потом снова муж
    await sync(husband, server);
    await sync(wife, server);
    await sync(husband, server);

    expect((await wife.records.get('milk'))?.data).toEqual({ qty: 250 });
    expect((await husband.records.get('milk'))?.data).toEqual({ qty: 250 });
    expect(server.rows.get(`${HOUSE}/milk`)?.data).toEqual({ qty: 250 });
  });

  it('старое изменение, отправленное позже, не затирает новое', async () => {
    await write(wife, 'eggs', { qty: 10 }, 500);
    await sync(wife, server);
    await write(husband, 'eggs', { qty: 3 }, 400); // правка сделана раньше, но без интернета
    await sync(husband, server);
    expect((await husband.records.get('eggs'))?.data).toEqual({ qty: 10 });
    expect(server.rows.get(`${HOUSE}/eggs`)?.data).toEqual({ qty: 10 });
  });

  it('удаление доходит до второго телефона, а более поздняя правка его отменяет', async () => {
    await write(wife, 'cheese', { name: 'Сыр' }, 100);
    await sync(wife, server);
    await sync(husband, server);

    await write(wife, 'cheese', { name: 'Сыр' }, 200, 'item', true);
    await sync(wife, server);
    await sync(husband, server);
    expect((await husband.records.get('cheese'))?.deleted).toBe(1);

    await write(husband, 'cheese', { name: 'Сыр, новая пачка' }, 300);
    await sync(husband, server);
    await sync(wife, server);
    const row = await wife.records.get('cheese');
    expect(row?.deleted).toBe(0);
    expect(row?.data).toEqual({ name: 'Сыр, новая пачка' });
  });

  it('несинхронизированная локальная правка не теряется при получении изменений', async () => {
    await write(wife, 'bread', { qty: 1 }, 100);
    await sync(wife, server);
    await sync(husband, server);
    await write(husband, 'bread', { qty: 0.5 }, 200); // ещё не отправлено
    await pullChanges(husband, server, HOUSE);
    expect((await husband.records.get('bread'))?.data).toEqual({ qty: 0.5 });
    expect((await husband.records.get('bread'))?.dirty).toBe(1);
  });

  it('большой холодильник переносится полностью, по частям', async () => {
    for (let i = 0; i < 23; i++) await write(wife, `item-${i}`, { i }, 100 + i);
    await sync(wife, server, 5);
    await sync(husband, server, 5);
    expect(await husband.records.count()).toBe(23);
    expect(await wife.records.where('dirty').equals(1).count()).toBe(0);
  });

  it('без интернета ничего не помечается отправленным', async () => {
    await write(wife, 'tomato', { qty: 4 }, 100);
    server.offline = true;
    await expect(sync(wife, server)).rejects.toThrow();
    expect((await wife.records.get('tomato'))?.dirty).toBe(1);
    server.offline = false;
    await sync(wife, server);
    expect((await wife.records.get('tomato'))?.dirty).toBe(0);
  });
});
