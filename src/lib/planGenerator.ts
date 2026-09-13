import { addShoppingItems } from '../data/repo';
import type { InventoryItem, MealSlot, PlannedMeal } from '../data/types';
import { getWeekDays, todayISO } from '../shared/dates';
import { getProduct } from '../shared/products';
import type { Recipe } from '../shared/recipeTypes';
import { convert, toBase, type ItemUnit } from '../shared/units';
import { matchRecipe, type MatchContext } from './matching';

const isDrink = (r: Recipe) => r.tags.includes('напиток');
const isMain = (r: Recipe) => !isDrink(r) && !r.tags.includes('гарнир') && (r.tags.includes('обед') || r.tags.includes('ужин'));

/**
 * Рацион на неделю: завтраки — из завтраков, обеды и ужины — из основных блюд.
 * Выше ставятся блюда, которые спасают истекающие продукты и для которых больше есть дома.
 * Блюдо не повторяется в течение недели, пока хватает рецептов.
 * Если ужин приготовлен впрок (порций больше, чем едоков), на следующий обед — его остатки.
 */
export function generateWeekPlan({
  mondayIso,
  ctx,
  recipes,
  existingMeals = [],
  servings = 2,
}: {
  mondayIso: string;
  ctx: MatchContext;
  recipes: Recipe[];
  existingMeals?: PlannedMeal[];
  servings?: number;
}): PlannedMeal[] {
  const days = getWeekDays(mondayIso);
  const locked = new Map(existingMeals.filter((m) => m.locked).map((m) => [m.id, m]));
  const byId = new Map(recipes.map((r) => [r.id, r]));

  // Рейтинг как в подборке рецептов: совпадение с холодильником + спасение истекающего
  const score = new Map(recipes.map((r) => [r.id, matchRecipe(ctx, r).score]));
  const ranked = (pool: Recipe[]) => [...pool].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0));

  const breakfasts = ranked(recipes.filter((r) => !isDrink(r) && r.tags.includes('завтрак')));
  const mains = ranked(recipes.filter(isMain));
  const lunches = [...mains.filter((r) => r.tags.includes('обед')), ...mains.filter((r) => !r.tags.includes('обед'))];
  const dinners = [...mains.filter((r) => r.tags.includes('ужин')), ...mains.filter((r) => !r.tags.includes('ужин'))];

  const used = new Set<string>([...locked.values()].map((m) => m.recipeId));
  const pick = (pool: Recipe[], dayUsed: Set<string>): Recipe | undefined => {
    const fresh = pool.find((r) => !used.has(r.id) && !dayUsed.has(r.id)) ?? pool.find((r) => !dayUsed.has(r.id)) ?? pool[0] ?? recipes[0];
    if (fresh) used.add(fresh.id);
    return fresh;
  };

  const now = Date.now();
  const meal = (date: string, slot: MealSlot, r: Recipe, extra: Partial<PlannedMeal> = {}): PlannedMeal => ({
    id: `${date}_${slot}`, date, slot, recipeId: r.id, title: r.title, servings, createdAt: now, ...extra,
  });

  const result: PlannedMeal[] = [];
  let prevDinner: Recipe | null = null;

  for (const date of days) {
    const dayUsed = new Set<string>();
    const take = (slot: MealSlot, pool: Recipe[], leftover?: Recipe | null) => {
      const id = `${date}_${slot}`;
      const kept = locked.get(id);
      if (kept) {
        dayUsed.add(kept.recipeId);
        result.push(kept);
        return byId.get(kept.recipeId) ?? null;
      }
      if (leftover) {
        result.push(meal(date, slot, leftover, { isLeftover: true, leftoverFromDate: result.find((m) => m.slot === 'dinner' && m.recipeId === leftover.id)?.date }));
        dayUsed.add(leftover.id);
        return leftover;
      }
      const r = pick(pool, dayUsed);
      if (!r) return null;
      dayUsed.add(r.id);
      result.push(meal(date, slot, r));
      return r;
    };

    take('breakfast', breakfasts);
    const cookedExtra = prevDinner && prevDinner.servings >= servings * 2 ? prevDinner : null;
    take('lunch', lunches, cookedExtra);
    prevDinner = take('dinner', dinners);
  }

  return result;
}

export async function addWeekPlanToShopping({
  meals,
  recipes,
  inventoryItems,
  staples,
}: {
  meals: PlannedMeal[];
  recipes: Recipe[];
  inventoryItems: InventoryItem[];
  staples: ReadonlySet<string> | Set<string>;
}): Promise<number> {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));

  // Суммируем потребности по всем приёмам пищи (кроме остатков)
  const needed = new Map<
    string,
    { name: string; productKey: string | null; qty: number; unit: ItemUnit; recipes: Set<string> }
  >();

  for (const m of meals) {
    if (m.isLeftover) continue; // остатки уже заложены в ужин
    const r = recipeMap.get(m.recipeId);
    if (!r) continue;

    const factor = m.servings / r.servings;
    for (const ing of r.ingredients) {
      if (ing.role === 'basic' || (ing.key && staples.has(ing.key))) {
        continue; // базовые запасы (соль, масло) не покупаем
      }

      const key = ing.key ?? ing.name ?? '';
      const prod = getProduct(ing.key);
      // Ложки переводим в граммы/мл, чтобы складывать одно и то же количество из разных рецептов
      const base = toBase((ing.qty ?? 0) * factor, ing.unit, ing.key);
      const unit: ItemUnit = base.unit;
      if (base.qty <= 0) continue;

      const curr = needed.get(key) ?? {
        name: ing.name ?? prod?.name ?? key,
        productKey: ing.key,
        qty: 0,
        unit,
        recipes: new Set(),
      };
      curr.qty += convert(base.qty, unit, curr.unit, ing.key) ?? base.qty;
      curr.recipes.add(r.title);
      needed.set(key, curr);
    }
  }

  // Вычитаем то, что уже лежит в холодильнике
  const toBuy: Array<{
    name: string;
    productKey?: string | null;
    category?: any;
    qty: number;
    unit: ItemUnit;
    recipeTitle?: string;
  }> = [];

  const today = todayISO();
  for (const [, req] of needed) {
    // Просроченное не считаем, количества переводим в единицы рецепта
    const onHand = inventoryItems
      .filter((it) => (req.productKey ? it.productKey === req.productKey : it.name.toLowerCase() === req.name.toLowerCase()))
      .filter((it) => !it.expiresAt || it.expiresAt >= today)
      .reduce((sum, it) => sum + (convert(it.qty, it.unit, req.unit, req.productKey) ?? 0), 0);

    const diff = req.qty - onHand;
    if (diff > 0) {
      const prod = getProduct(req.productKey);
      toBuy.push({
        name: req.name,
        productKey: req.productKey,
        category: prod?.category,
        qty: Math.ceil(diff),
        unit: req.unit,
        recipeTitle: Array.from(req.recipes).slice(0, 2).join(', '),
      });
    }
  }

  if (toBuy.length > 0) {
    await addShoppingItems(toBuy);
  }

  return toBuy.length;
}