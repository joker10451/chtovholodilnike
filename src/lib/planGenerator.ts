import { addShoppingItems } from '../data/repo';
import type { InventoryItem, MealSlot, PlannedMeal } from '../data/types';
import { addDays, getWeekDays, shortDate, todayISO } from '../shared/dates';
import { CATEGORY_LIFE, getProduct, type Category } from '../shared/products';
import type { Recipe } from '../shared/recipeTypes';
import { convert, toBase, type ItemUnit } from '../shared/units';
import type { MatchContext } from './matching';
import { purchaseAmount } from './shoppingMath';
import { isDisliked, tasteOf } from './taste';

export interface PlanOptions {
  meals: MealSlot[];
  /** Дни, когда готовим впрок: 0 — понедельник … 6 — воскресенье */
  cookDays: number[];
}

export const DEFAULT_PLAN_OPTIONS: PlanOptions = { meals: ['breakfast', 'lunch', 'dinner'], cookDays: [0, 2, 5, 6] };

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
const PROTEIN: Category[] = ['meat', 'poultry', 'fish', 'eggs'];
/** Продукт, который испортится в эти дни, стараемся пустить в блюдо */
const RESCUE_WINDOW = 2;

const isDrink = (r: Recipe) => r.tags.includes('напиток');
const fitsSlot = (r: Recipe, slot: MealSlot) =>
  !isDrink(r) && (slot === 'breakfast'
    ? r.tags.includes('завтрак')
    : !r.tags.includes('гарнир') && (r.tags.includes('обед') || r.tags.includes('ужин')));

/** Партия продукта «на полке» при планировании: то, что есть дома, и хвосты купленных упаковок */
interface Lot {
  key: string;
  name: string;
  qty: number;
  unit: ItemUnit;
  expiresAt: string | null;
  bought: boolean;
}

interface Simulation {
  lots: Lot[];
}

function initialLots(items: InventoryItem[], today: string): Lot[] {
  return items
    .filter((i) => i.productKey && i.qty > 0 && (!i.expiresAt || i.expiresAt >= today))
    .map((i) => ({ key: i.productKey!, name: i.name, qty: i.qty, unit: i.unit, expiresAt: i.expiresAt, bought: false }));
}

interface Usage {
  coverage: number;
  rescued: string[];
  missing: number;
  overlap: number;
  takes: { lot: Lot; qty: number }[];
  buys: { key: string; need: number; unit: ItemUnit; date: string }[];
}

/** Как рецепт ляжет на текущие запасы в день date */
function evaluate(sim: Simulation, recipe: Recipe, portions: number, date: string, staples: ReadonlySet<string>): Usage {
  const factor = portions / recipe.servings;
  const usage: Usage = { coverage: 0, rescued: [], missing: 0, overlap: 0, takes: [], buys: [] };
  let weight = 0;
  let covered = 0;
  const reserved = new Map<Lot, number>();

  for (const ing of recipe.ingredients) {
    const w = ing.role === 'key' ? 3 : ing.role === 'secondary' ? 1 : 0;
    if (!ing.key || w === 0) continue;
    weight += w;
    if (staples.has(ing.key)) { covered += w; continue; }

    const base = toBase(ing.qty * factor, ing.unit, ing.key);
    if (base.qty <= 0) { covered += w; continue; }
    let need = base.qty;
    const lots = sim.lots
      .filter((l) => l.key === ing.key && l.qty - (reserved.get(l) ?? 0) > 0 && (!l.expiresAt || l.expiresAt >= date))
      .sort((a, b) => (a.expiresAt ?? '9999').localeCompare(b.expiresAt ?? '9999'));
    for (const lot of lots) {
      if (need <= 0) break;
      const free = lot.qty - (reserved.get(lot) ?? 0);
      const freeInBase = convert(free, lot.unit, base.unit, ing.key);
      if (freeInBase === null) continue;
      const take = Math.min(freeInBase, need);
      const takeInLot = convert(take, base.unit, lot.unit, ing.key) ?? 0;
      reserved.set(lot, (reserved.get(lot) ?? 0) + takeInLot);
      usage.takes.push({ lot, qty: takeInLot });
      need -= take;
      if (lot.bought) usage.overlap += 1;
      if (!lot.bought && lot.expiresAt && lot.expiresAt <= addDays(date, RESCUE_WINDOW) && !usage.rescued.includes(lot.name)) usage.rescued.push(lot.name);
    }
    const share = Math.max(0, Math.min(1, 1 - need / base.qty));
    covered += w * share;
    if (need > base.qty * 0.1) {
      usage.missing += 1;
      usage.buys.push({ key: ing.key, need, unit: base.unit, date });
    }
  }
  usage.coverage = weight ? covered / weight : 1;
  return usage;
}

/** Записывает выбранное блюдо в симуляцию: тратим запасы, докупленное кладём «в холодильник» хвостом упаковки */
function commit(sim: Simulation, usage: Usage) {
  for (const t of usage.takes) t.lot.qty -= t.qty;
  for (const b of usage.buys) {
    const product = getProduct(b.key);
    const bought = purchaseAmount(b.key, b.need, b.unit);
    const needInBought = convert(b.need, b.unit, bought.unit, b.key) ?? bought.qty;
    const tail = bought.qty - needInBought;
    if (tail > 0 && product) {
      const life = product.opened ?? product.life.fridge ?? CATEGORY_LIFE[product.category].fridge ?? 3;
      sim.lots.push({ key: b.key, name: product.name, qty: tail, unit: bought.unit, expiresAt: addDays(b.date, life), bought: true });
    }
  }
  sim.lots = sim.lots.filter((l) => l.qty > 0.001);
}

function mainProtein(r: Recipe): Category | null {
  for (const ing of r.ingredients) {
    const cat = getProduct(ing.key)?.category;
    if (ing.role === 'key' && cat && PROTEIN.includes(cat)) return cat;
  }
  return null;
}

/**
 * Рацион на неделю. По дням и приёмам пищи выбирает блюдо с лучшей оценкой:
 * совпадение с запасами (с учётом уже запланированного), спасение истекающего,
 * использование хвостов купленных упаковок, вкус семьи, время и разнообразие.
 * В дни готовки ужин готовится на две трапезы — на следующий обед идут остатки.
 * Дни раньше сегодняшнего не планируются.
 */
export function generateWeekPlan({
  mondayIso,
  ctx,
  recipes,
  existingMeals = [],
  servings = 2,
  options = DEFAULT_PLAN_OPTIONS,
}: {
  mondayIso: string;
  ctx: MatchContext;
  recipes: Recipe[];
  existingMeals?: PlannedMeal[];
  servings?: number;
  options?: PlanOptions;
}): PlannedMeal[] {
  const days = getWeekDays(mondayIso);
  const locked = new Map(existingMeals.filter((m) => m.locked).map((m) => [m.id, m]));
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const pool = recipes.filter((r) => !isDisliked(tasteOf(ctx.tastes, r.id)));
  const sim: Simulation = { lots: initialLots(ctx.items, ctx.today) };
  const used = new Set([...locked.values()].map((m) => m.recipeId));
  const meals = SLOTS.filter((s) => options.meals.includes(s));

  const now = Date.now();
  const result: PlannedMeal[] = [];
  let prevMain: Recipe | null = null;
  let prevDinnerBatch: { recipe: Recipe; date: string } | null = null;

  days.forEach((date, dayIndex) => {
    // Прошедшие дни не переписываем: что было — то было
    if (date < ctx.today) {
      result.push(...existingMeals.filter((m) => m.date === date));
      return;
    }
    const cookDay = options.cookDays.includes(dayIndex);
    const dayUsed = new Set<string>();

    for (const slot of meals) {
      const id = `${date}_${slot}`;
      const kept = locked.get(id);
      if (kept) {
        const r = byId.get(kept.recipeId);
        if (r && !kept.isLeftover) commit(sim, evaluate(sim, r, kept.servings, date, ctx.staples));
        result.push(kept);
        dayUsed.add(kept.recipeId);
        if (r && slot !== 'breakfast') prevMain = r;
        if (slot === 'dinner') prevDinnerBatch = r && kept.servings >= servings * 2 ? { recipe: r, date } : null;
        continue;
      }

      // Обед из остатков вчерашнего ужина, приготовленного впрок
      if (slot === 'lunch' && prevDinnerBatch && prevDinnerBatch.date === addDays(date, -1)) {
        result.push({
          id, date, slot, recipeId: prevDinnerBatch.recipe.id, title: prevDinnerBatch.recipe.title, servings,
          isLeftover: true, leftoverFromDate: prevDinnerBatch.date, createdAt: now,
        });
        dayUsed.add(prevDinnerBatch.recipe.id);
        prevDinnerBatch = null;
        continue;
      }

      const batch = slot === 'dinner' && cookDay && meals.includes('lunch');
      let best: { r: Recipe; usage: Usage; portions: number; score: number } | null = null;
      for (const r of pool) {
        if (!fitsSlot(r, slot) || dayUsed.has(r.id)) continue;
        const makesBatch = batch && r.servings >= servings * 2;
        const portions = makesBatch ? servings * 2 : servings;
        const usage = evaluate(sim, r, portions, date, ctx.staples);
        const taste = tasteOf(ctx.tastes, r.id).score;
        let score = 0.45 * usage.coverage
          + 0.25 * Math.min(2, usage.rescued.length)
          + 0.08 * Math.min(2, usage.overlap)
          + 0.4 * (taste - 0.5)
          - 0.05 * usage.missing;
        if (used.has(r.id)) score -= 1;
        if (makesBatch) score += 0.2;
        if (slot !== 'breakfast' && !cookDay && r.time > ctx.timeLimit) score -= 0.25;
        const protein = mainProtein(r);
        if (slot !== 'breakfast' && protein && prevMain && protein === mainProtein(prevMain)) score -= 0.15;
        if (!best || score > best.score) best = { r, usage, portions, score };
      }
      if (!best) continue;

      commit(sim, best.usage);
      used.add(best.r.id);
      dayUsed.add(best.r.id);
      const rescued = best.usage.rescued;
      result.push({
        id, date, slot, recipeId: best.r.id, title: best.r.title, servings: best.portions, createdAt: now,
        ...(rescued.length ? { note: `доедает: ${rescued.slice(0, 2).join(', ').toLowerCase()}` } : {}),
      });
      if (slot !== 'breakfast') prevMain = best.r;
      if (slot === 'dinner') prevDinnerBatch = best.portions > servings ? { recipe: best.r, date } : null;
    }
  });

  return result;
}

export interface ShoppingLine {
  name: string;
  productKey: string | null;
  category?: Category;
  qty: number;
  unit: ItemUnit;
  recipeTitle?: string;
}

/** Что докупить к рациону: суммируем по неделе, вычитаем годное на день готовки и округляем до упаковок */
export function planShoppingList({
  meals, recipes, inventoryItems, staples, today = todayISO(),
}: {
  meals: PlannedMeal[];
  recipes: Recipe[];
  inventoryItems: InventoryItem[];
  staples: ReadonlySet<string>;
  today?: string;
}): ShoppingLine[] {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const needed = new Map<string, { name: string; productKey: string | null; qty: number; unit: ItemUnit; firstDate: string; recipes: Set<string> }>();

  for (const m of [...meals].sort((a, b) => a.date.localeCompare(b.date))) {
    if (m.isLeftover || m.date < today) continue;
    const r = recipeMap.get(m.recipeId);
    if (!r) continue;
    const factor = m.servings / r.servings;
    for (const ing of r.ingredients) {
      if (ing.role === 'basic' || (ing.key && staples.has(ing.key))) continue;
      const base = toBase(ing.qty * factor, ing.unit, ing.key);
      if (base.qty <= 0) continue;
      const k = ing.key ?? (ing.name ?? '').toLowerCase();
      const cur = needed.get(k) ?? { name: getProduct(ing.key)?.name ?? ing.name ?? k, productKey: ing.key, qty: 0, unit: base.unit, firstDate: m.date, recipes: new Set<string>() };
      cur.qty += convert(base.qty, base.unit, cur.unit, ing.key) ?? base.qty;
      cur.recipes.add(r.title);
      needed.set(k, cur);
    }
  }

  const lines: ShoppingLine[] = [];
  for (const req of needed.values()) {
    // Дома учитываем только то, что не испортится к первому блюду с этим продуктом
    const onHand = inventoryItems
      .filter((it) => (req.productKey ? it.productKey === req.productKey : it.name.toLowerCase() === req.name.toLowerCase()))
      .filter((it) => !it.expiresAt || it.expiresAt >= req.firstDate)
      .reduce((sum, it) => sum + (convert(it.qty, it.unit, req.unit, req.productKey) ?? 0), 0);
    const diff = req.qty - onHand;
    if (diff <= req.qty * 0.05) continue;
    const buy = purchaseAmount(req.productKey, diff, req.unit);
    const titles = [...req.recipes];
    lines.push({
      name: req.name,
      productKey: req.productKey,
      category: getProduct(req.productKey)?.category,
      qty: buy.qty,
      unit: buy.unit,
      recipeTitle: titles.slice(0, 2).join(', ') + (titles.length > 2 ? ` и ещё ${titles.length - 2}` : ''),
    });
  }
  return lines;
}

export async function addWeekPlanToShopping(args: {
  meals: PlannedMeal[];
  recipes: Recipe[];
  inventoryItems: InventoryItem[];
  staples: ReadonlySet<string>;
  today?: string;
}): Promise<number> {
  const lines = planShoppingList(args);
  if (lines.length) await addShoppingItems(lines);
  return lines.length;
}

/** Подпись для обеда из остатков */
export function leftoverLabel(m: PlannedMeal): string {
  return `остатки ужина${m.leftoverFromDate ? ` ${shortDate(m.leftoverFromDate)}` : ''}`;
}
