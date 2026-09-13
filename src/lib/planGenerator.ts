import { addShoppingItems } from '../data/repo';
import type { InventoryItem, PlannedMeal } from '../data/types';
import { getWeekDays } from '../shared/dates';
import { expiringItemIds, type MatchContext } from './matching';
import { getProduct } from '../shared/products';
import type { Recipe } from '../shared/recipeTypes';
import { convert, toBase, type ItemUnit } from '../shared/units';
import { todayISO } from '../shared/dates';

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
  const lockedMap = new Map<string, PlannedMeal>();
  for (const m of existingMeals) {
    if (m.locked) {
      lockedMap.set(m.id, m);
    }
  }

  // Находим спасаемые продукты
  const rescueIds = new Set(expiringItemIds(ctx));

  // Разделяем рецепты
  const breakfastPool = recipes.filter(
    (r) => r.tags.includes('завтрак') || r.time <= 20,
  );
  const dinnerPool = recipes.filter(
    (r) => r.tags.includes('ужин') || r.tags.includes('обед') || r.time >= 20,
  );
  const allPool = [...recipes];

  // Сортируем: сначала те, что спасают продукты из холодильника
  const sortByRescue = (a: Recipe, b: Recipe) => {
    const aRescues = a.ingredients.some((i) =>
      ctx.items.some((it) => rescueIds.has(it.id) && it.productKey === i.key),
    );
    const bRescues = b.ingredients.some((i) =>
      ctx.items.some((it) => rescueIds.has(it.id) && it.productKey === i.key),
    );
    if (aRescues && !bRescues) return -1;
    if (!aRescues && bRescues) return 1;
    return 0;
  };

  const sortedBreakfast = [...breakfastPool].sort(sortByRescue);
  const sortedDinner = [...dinnerPool].sort(sortByRescue);

  const result: PlannedMeal[] = [];
  let bIdx = 0;
  let dIdx = 0;
  let prevDinnerRecipe: Recipe | null = null;
  const now = Date.now();

  for (let d = 0; d < days.length; d++) {
    const date = days[d];

    // 1. ЗАВТРАК
    const bId = `${date}_breakfast`;
    if (lockedMap.has(bId)) {
      result.push(lockedMap.get(bId)!);
    } else {
      const bRecipe = sortedBreakfast[bIdx % sortedBreakfast.length] ?? allPool[0];
      bIdx++;
      result.push({
        id: bId,
        date,
        slot: 'breakfast',
        recipeId: bRecipe.id,
        title: bRecipe.title,
        servings,
        createdAt: now,
      });
    }

    // 2. ОБЕД (во вторник и четверг пробуем остатки вчерашнего ужина, иначе лёгкое блюдо)
    const lId = `${date}_lunch`;
    if (lockedMap.has(lId)) {
      result.push(lockedMap.get(lId)!);
    } else if ((d === 1 || d === 3) && prevDinnerRecipe) {
      // Вторник и Четверг — обед доедает ужин предыдущего дня
      result.push({
        id: lId,
        date,
        slot: 'lunch',
        recipeId: prevDinnerRecipe.id,
        title: prevDinnerRecipe.title,
        servings,
        isLeftover: true,
        leftoverFromDate: days[d - 1],
        createdAt: now,
      });
    } else {
      // Свежий быстрый обед
      const lRecipe = sortedDinner[(dIdx + 5) % sortedDinner.length] ?? allPool[0];
      result.push({
        id: lId,
        date,
        slot: 'lunch',
        recipeId: lRecipe.id,
        title: lRecipe.title,
        servings,
        createdAt: now,
      });
    }

    // 3. УЖИН
    const dId = `${date}_dinner`;
    if (lockedMap.has(dId)) {
      const lockedMeal = lockedMap.get(dId)!;
      result.push(lockedMeal);
      prevDinnerRecipe = recipes.find((r) => r.id === lockedMeal.recipeId) ?? null;
    } else {
      const dRecipe = sortedDinner[dIdx % sortedDinner.length] ?? allPool[0];
      dIdx++;
      prevDinnerRecipe = dRecipe;
      result.push({
        id: dId,
        date,
        slot: 'dinner',
        recipeId: dRecipe.id,
        title: dRecipe.title,
        servings,
        createdAt: now,
      });
    }
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