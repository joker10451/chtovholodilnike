import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { BASE_RECIPES } from '../shared/recipes';
import { DEFAULT_STAPLES } from '../shared/products';
import type { Recipe } from '../shared/recipeTypes';
import { db, DEFAULT_META, getMeta, newId } from './db';
import type { CookLogEntry, DeviceMeta, HouseholdSettings, InventoryItem, RecordKind, ScanJob, SyncRecord } from './types';

export const SETTINGS_ID = 'settings';

export const DEFAULT_SETTINGS: HouseholdSettings = {
  servings: 2,
  staples: DEFAULT_STAPLES,
  timeLimit: 45,
};

type Listener = () => void;
const changeListeners = new Set<Listener>();

/** Подписка на локальные изменения — синхронизация отправляет их на сервер */
export function onLocalChange(fn: Listener): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

function notify() {
  changeListeners.forEach((fn) => fn());
}

export async function putRecord<T>(kind: RecordKind, id: string, data: T): Promise<void> {
  await db.records.put({ id, kind, data, updatedAt: Date.now(), deleted: 0, dirty: 1 });
  notify();
}

export async function putRecords<T>(kind: RecordKind, rows: { id: string; data: T }[]): Promise<void> {
  const now = Date.now();
  await db.records.bulkPut(rows.map((r) => ({ id: r.id, kind, data: r.data, updatedAt: now, deleted: 0 as const, dirty: 1 as const })));
  notify();
}

export async function deleteRecords(ids: string[]): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.records, async () => {
    for (const id of ids) {
      await db.records.update(id, { deleted: 1, dirty: 1, updatedAt: now });
    }
  });
  notify();
}

async function liveOf<T>(kind: RecordKind): Promise<T[]> {
  const rows = (await db.records.where('kind').equals(kind).toArray()) as SyncRecord<T>[];
  return rows.filter((r) => !r.deleted).map((r) => r.data);
}

// ——— Продукты ———

export function useItems(): InventoryItem[] | undefined {
  return useLiveQuery(() => liveOf<InventoryItem>('item'), []);
}

export async function getItems(): Promise<InventoryItem[]> {
  return liveOf<InventoryItem>('item');
}

export function saveItem(item: InventoryItem): Promise<void> {
  return putRecord('item', item.id, item);
}

export function saveItems(items: InventoryItem[]): Promise<void> {
  return putRecords('item', items.map((data) => ({ id: data.id, data })));
}

// ——— Рецепты ———

export function useCustomRecipes(): Recipe[] | undefined {
  return useLiveQuery(() => liveOf<Recipe>('recipe'), []);
}

export function useAllRecipes(): Recipe[] {
  const custom = useCustomRecipes();
  return useMemo(() => [...(custom ?? []).sort((a, b) => a.title.localeCompare(b.title, 'ru')), ...BASE_RECIPES], [custom]);
}

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  const base = BASE_RECIPES.find((r) => r.id === id);
  if (base) return base;
  const row = await db.records.get(id);
  return row && !row.deleted ? (row.data as Recipe) : undefined;
}

export function saveRecipe(recipe: Recipe): Promise<void> {
  return putRecord('recipe', recipe.id, recipe);
}

// ——— Журнал готовки ———

export function logCooking(entry: CookLogEntry): Promise<void> {
  return putRecord('cooklog', newId(), entry);
}

export function useCookLog(): CookLogEntry[] | undefined {
  return useLiveQuery(async () => (await liveOf<CookLogEntry>('cooklog')).sort((a, b) => b.cookedAt - a.cookedAt), []);
}

// ——— Настройки ———

export function useSettings(): HouseholdSettings {
  const row = useLiveQuery(() => db.records.get(SETTINGS_ID), []);
  return { ...DEFAULT_SETTINGS, ...((row?.data as Partial<HouseholdSettings>) ?? {}) };
}

export async function getSettings(): Promise<HouseholdSettings> {
  const row = await db.records.get(SETTINGS_ID);
  return { ...DEFAULT_SETTINGS, ...((row?.data as Partial<HouseholdSettings>) ?? {}) };
}

export async function saveSettings(patch: Partial<HouseholdSettings>): Promise<void> {
  await putRecord('settings', SETTINGS_ID, { ...(await getSettings()), ...patch });
}

/** undefined — ещё загружается */
export function useMetaLoading(): DeviceMeta | undefined {
  return useLiveQuery(() => getMeta(), []);
}

export function useMeta(): DeviceMeta {
  return useMetaLoading() ?? DEFAULT_META;
}

// ——— Сканы ———

export function useScans(): ScanJob[] | undefined {
  return useLiveQuery(() => db.scans.orderBy('createdAt').reverse().toArray(), []);
}

export function useScan(id: string): ScanJob | undefined | null {
  return useLiveQuery(async () => (await db.scans.get(id)) ?? null, [id]);
}
