import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { BASE_RECIPES } from '../shared/recipes';
import { DEFAULT_STAPLES, getProduct, guessProductKey, type Category } from '../shared/products';
import { estimateExpiry } from '../shared/freshness';
import { convert, type ItemUnit } from '../shared/units';
import type { Recipe } from '../shared/recipeTypes';
import { db, DEFAULT_META, getMeta, newId } from './db';
import type { CookLogEntry, DeviceMeta, HouseholdSettings, InventoryItem, PlannedMeal, RecordKind, ScanJob, ShoppingItem, SyncRecord } from './types';
import { getWeekDays } from '../shared/dates';

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
  const id = newId();
  return putRecord('cooklog', id, { ...entry, id });
}

/** Ставит оценку последнему приготовлению блюда; если по приложению не готовили — сохраняет отдельную оценку */
export async function rateRecipe(recipeId: string, title: string, rating: 1 | 3 | 5): Promise<void> {
  const rows = (await db.records.where('kind').equals('cooklog').toArray()) as SyncRecord<CookLogEntry>[];
  const latest = rows
    .filter((r) => !r.deleted && r.data.recipeId === recipeId)
    .sort((a, b) => b.data.cookedAt - a.data.cookedAt)[0];
  if (latest) await putRecord('cooklog', latest.id, { ...latest.data, id: latest.id, rating });
  else await logCooking({ recipeId, title, portions: 0, cookedAt: Date.now(), rating, ratedOnly: true });
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

// ——— Список покупок ———

export function useShoppingList(): ShoppingItem[] | undefined {
  return useLiveQuery(async () => {
    const rows = await liveOf<ShoppingItem>('shopping');
    return rows.sort((a, b) => (a.checked ? 1 : 0) - (b.checked ? 1 : 0) || b.createdAt - a.createdAt);
  }, []);
}

export async function addShoppingItems(
  items: Array<{
    name: string;
    productKey?: string | null;
    category?: Category;
    qty?: number;
    unit?: ItemUnit;
    recipeTitle?: string;
  }>,
): Promise<void> {
  const existing = await liveOf<ShoppingItem>('shopping');
  const now = Date.now();
  const toAdd: { id: string; data: ShoppingItem }[] = [];

  for (const item of items) {
    const key = item.productKey ?? guessProductKey(item.name);
    const prod = getProduct(key);
    const cat = item.category ?? prod?.category ?? 'other';
    const unit = item.unit ?? (prod?.unit as ItemUnit) ?? 'pcs';
    const qty = item.qty ?? 1;

    // Складываем только то, что можно перевести в одни единицы: 2 шт яиц + 10 шт, 500 г + 1 кг
    const sameQty = (e: ShoppingItem) => convert(qty, unit, e.unit, key);
    const duplicate = existing.find(
      (e) => !e.checked && ((key && e.productKey === key) || e.name.toLowerCase() === item.name.toLowerCase()) && sameQty(e) !== null,
    );

    if (duplicate) {
      await putRecord<ShoppingItem>('shopping', duplicate.id, {
        ...duplicate,
        qty: Math.round((duplicate.qty + (sameQty(duplicate) ?? 0)) * 100) / 100,
        recipeTitle: item.recipeTitle
          ? duplicate.recipeTitle
            ? `${duplicate.recipeTitle}, ${item.recipeTitle}`
            : item.recipeTitle
          : duplicate.recipeTitle,
      });
    } else {
      const id = newId();
      toAdd.push({
        id,
        data: {
          id,
          name: item.name,
          productKey: key,
          category: cat,
          qty,
          unit,
          checked: false,
          recipeTitle: item.recipeTitle,
          createdAt: now,
        },
      });
    }
  }

  if (toAdd.length > 0) {
    await putRecords('shopping', toAdd);
  }
}

export async function toggleShoppingItem(id: string, checked: boolean): Promise<void> {
  const row = await db.records.get(id);
  if (!row || row.deleted) return;
  const current = row.data as ShoppingItem;
  await putRecord<ShoppingItem>('shopping', id, { ...current, checked });
}

export async function deleteShoppingItem(id: string): Promise<void> {
  await deleteRecords([id]);
}

export async function clearCheckedShoppingItems(): Promise<void> {
  const rows = await liveOf<ShoppingItem>('shopping');
  const doneIds = rows.filter((r) => r.checked).map((r) => r.id);
  if (doneIds.length > 0) {
    await deleteRecords(doneIds);
  }
}

export async function transferCheckedToFridge(today: string): Promise<number> {
  const rows = await liveOf<ShoppingItem>('shopping');
  const checked = rows.filter((r) => r.checked);
  if (checked.length === 0) return 0;

  const now = Date.now();
  const newItems: { id: string; data: InventoryItem }[] = [];

  for (const s of checked) {
    const prod = getProduct(s.productKey);
    const loc = prod?.location ?? 'fridge';
    const expiry = estimateExpiry({
      productKey: s.productKey,
      category: s.category,
      location: loc,
      purchasedAt: today,
      openedAt: null,
      packageDate: null,
    });

    const id = newId();
    newItems.push({
      id,
      data: {
        id,
        name: s.name,
        productKey: s.productKey,
        category: s.category,
        qty: s.qty,
        unit: s.unit,
        location: loc,
        purchasedAt: today,
        openedAt: null,
        expiresAt: expiry.expiresAt,
        isEstimate: expiry.isEstimate,
        source: 'manual',
        createdAt: now,
      },
    });
  }

  await putRecords('item', newItems);
  await deleteRecords(checked.map((c) => c.id));
  return checked.length;
}

// ——— Рацион (план питания) ———

export function useMealPlan(mondayIso: string): PlannedMeal[] | undefined {
  return useLiveQuery(async () => {
    const rows = await liveOf<PlannedMeal>('plan');
    const weekDays = new Set(getWeekDays(mondayIso));
    return rows.filter((r) => weekDays.has(r.date));
  }, [mondayIso]);
}

export async function savePlannedMeal(meal: PlannedMeal): Promise<void> {
  await putRecord<PlannedMeal>('plan', meal.id, meal);
}

export async function deletePlannedMeal(id: string): Promise<void> {
  await deleteRecords([id]);
}

export async function saveFullMealPlan(meals: PlannedMeal[]): Promise<void> {
  const rows = meals.map((m) => ({ id: m.id, data: m }));
  await putRecords('plan', rows);
}

