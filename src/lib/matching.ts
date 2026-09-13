import type { InventoryItem } from '../data/types';
import { isDisliked, tasteOf, type RecipeTaste } from './taste';
import { daysLeft, freshness, RESCUE_DAYS } from '../shared/freshness';
import type { Ingredient, Recipe, Role, Substitute } from '../shared/recipeTypes';
import { convert, type RecipeUnit } from '../shared/units';

export const ROLE_WEIGHT: Record<Role, number> = { key: 3, secondary: 1, basic: 0 };

export interface MatchContext {
  /** Оценки семьи по рецептам (id → вкус); без них вкус нейтральный */
  tastes?: ReadonlyMap<string, RecipeTaste>;
  items: InventoryItem[];
  staples: ReadonlySet<string>;
  today: string;
  timeLimit: number;
}

export type IngredientState = 'have' | 'sub' | 'staple' | 'partial' | 'missing';

export interface IngredientMatch {
  ingredient: Ingredient;
  state: IngredientState;
  /** 0..1 — какая доля нужного количества есть дома */
  coverage: number;
  /** Замена, которой закрыли ингредиент */
  sub?: Substitute;
  /** Продукты из холодильника, которые пойдут в блюдо */
  itemIds: string[];
}

export interface RecipeMatch {
  recipe: Recipe;
  score: number;
  coverage: number;
  ingredients: IngredientMatch[];
  /** Недостающие ключевые и второстепенные ингредиенты */
  missing: IngredientMatch[];
  missingKey: number;
  /** Продукты со сроком ≤ 2 дней, которые использует блюдо */
  rescueItemIds: string[];
}

export type Shelf = 'rescue' | 'ready' | 'buy' | 'all';

function usableItems(ctx: MatchContext, productKey: string): InventoryItem[] {
  return ctx.items.filter((it) => it.productKey === productKey && freshness(it.expiresAt, ctx.today) !== 'expired' && it.qty > 0);
}

/** Сколько продукта есть дома в единицах рецепта. Infinity — есть, но количество не перевести */
export function available(ctx: MatchContext, productKey: string, unit: RecipeUnit): { amount: number; items: InventoryItem[] } {
  const items = usableItems(ctx, productKey);
  let amount = 0;
  for (const it of items) {
    const v = convert(it.qty, it.unit, unit, productKey);
    amount += v === null ? Infinity : v;
  }
  return { amount, items };
}

function coverageFor(ctx: MatchContext, key: string, qty: number, unit: RecipeUnit, factor: number) {
  const { amount, items } = available(ctx, key, unit);
  if (items.length === 0) return { coverage: 0, items };
  const needed = qty * factor;
  if (needed <= 0) return { coverage: 1, items };
  return { coverage: Math.min(1, amount / needed), items };
}

export function matchIngredient(ctx: MatchContext, ing: Ingredient, factor: number): IngredientMatch {
  if (!ing.key) return { ingredient: ing, state: 'missing', coverage: 0, itemIds: [] };
  if (ctx.staples.has(ing.key)) return { ingredient: ing, state: 'staple', coverage: 1, itemIds: [] };

  const direct = coverageFor(ctx, ing.key, ing.qty, ing.unit, factor);
  if (direct.coverage >= 0.9) {
    return { ingredient: ing, state: 'have', coverage: 1, itemIds: direct.items.map((i) => i.id) };
  }
  for (const sub of ing.subs ?? []) {
    const alt = ctx.staples.has(sub.key)
      ? { coverage: 1, items: [] as InventoryItem[] }
      : coverageFor(ctx, sub.key, sub.qty ?? ing.qty, sub.unit ?? ing.unit, factor);
    if (alt.coverage >= 0.9) {
      return { ingredient: ing, state: 'sub', coverage: 1, sub, itemIds: alt.items.map((i) => i.id) };
    }
  }
  if (direct.coverage > 0) {
    return { ingredient: ing, state: 'partial', coverage: direct.coverage, itemIds: direct.items.map((i) => i.id) };
  }
  return { ingredient: ing, state: 'missing', coverage: 0, itemIds: [] };
}

export function expiringItemIds(ctx: MatchContext): Set<string> {
  return new Set(
    ctx.items
      .filter((it) => {
        const left = daysLeft(it.expiresAt, ctx.today);
        return left !== null && left >= 0 && left <= RESCUE_DAYS;
      })
      .map((it) => it.id),
  );
}

/**
 * Рейтинг = 0,45·Совпадение + 0,25·Спасение + 0,15·Вкус + 0,15·Время − 0,1·Недостающие
 */
export function matchRecipe(ctx: MatchContext, recipe: Recipe, portions = recipe.servings, expiring = expiringItemIds(ctx)): RecipeMatch {
  const factor = portions / recipe.servings;
  const ingredients = recipe.ingredients.map((ing) => matchIngredient(ctx, ing, factor));

  let weightSum = 0;
  let covered = 0;
  for (const m of ingredients) {
    const w = ROLE_WEIGHT[m.ingredient.role];
    weightSum += w;
    covered += w * m.coverage;
  }
  // Если в холодильнике ничего нет, процент покрытия блюда из холодильника равен 0
  const coverage = ctx.items.length === 0 ? 0 : (weightSum ? covered / weightSum : 1);

  const missing = ingredients.filter((m) => m.ingredient.role !== 'basic' && (m.state === 'missing' || (m.state === 'partial' && m.coverage < 0.5)));
  const missingKey = missing.filter((m) => m.ingredient.role === 'key').length;

  const rescueItemIds = [...new Set(ingredients.flatMap((m) => m.itemIds).filter((id) => expiring.has(id)))];
  const rescue = expiring.size ? Math.min(1, rescueItemIds.length / Math.min(expiring.size, 2)) : 0;
  const time = recipe.time <= ctx.timeLimit ? 1 : Math.max(0, 1 - (recipe.time - ctx.timeLimit) / ctx.timeLimit);
  const taste = tasteOf(ctx.tastes, recipe.id).score;

  // Нелюбимые блюда опускаем в самый низ подборки
  const disliked = isDisliked(tasteOf(ctx.tastes, recipe.id)) ? 1 : 0;
  const score = 0.45 * coverage + 0.25 * rescue + 0.15 * taste + 0.15 * time - 0.1 * missing.length - 0.5 * disliked;
  return { recipe, score, coverage, ingredients, missing, missingKey, rescueItemIds };
}

export function onShelf(m: RecipeMatch, shelf: Shelf, hasItems = true): boolean {
  if (!hasItems && shelf !== 'all') return false;
  switch (shelf) {
    case 'rescue': return m.rescueItemIds.length > 0 && m.missingKey === 0 && m.missing.length <= 2;
    case 'ready': return m.missingKey === 0;
    case 'buy': return m.missingKey > 0 && m.missing.length <= 2;
    case 'all': return true;
  }
}

export function rankRecipes(ctx: MatchContext, recipes: Recipe[]): RecipeMatch[] {
  const expiring = expiringItemIds(ctx);
  return recipes.map((r) => matchRecipe(ctx, r, r.servings, expiring)).sort((a, b) => b.score - a.score);
}
