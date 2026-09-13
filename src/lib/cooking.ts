import type { InventoryItem } from '../data/types';
import { freshness } from '../shared/freshness';
import { getProduct } from '../shared/products';
import type { Recipe } from '../shared/recipeTypes';
import { convert, type ItemUnit } from '../shared/units';
import { matchIngredient, type MatchContext } from './matching';

export interface DeductionLine {
  /** Уникален в пределах списка */
  key: string;
  ingredientName: string;
  itemId: string;
  itemName: string;
  take: number;
  unit: ItemUnit;
  before: number;
  after: number;
}

const LEFT_EPSILON: Record<ItemUnit, number> = { g: 5, ml: 5, pcs: 0.2, portion: 0.2 };

/** Раньше тратим открытое и то, что скорее испортится */
function byUrgency(a: InventoryItem, b: InventoryItem): number {
  if (!!a.openedAt !== !!b.openedAt) return a.openedAt ? -1 : 1;
  return (a.expiresAt ?? '9999-12-31').localeCompare(b.expiresAt ?? '9999-12-31');
}

/** Что и сколько списать из холодильника после приготовления блюда */
export function planDeduction(ctx: MatchContext, recipe: Recipe, portions: number): DeductionLine[] {
  const factor = portions / recipe.servings;
  const lines: DeductionLine[] = [];
  const left = new Map(ctx.items.map((it) => [it.id, it.qty]));

  for (const ing of recipe.ingredients) {
    if (ing.qty <= 0) continue;
    const match = matchIngredient(ctx, ing, factor);
    if (match.state === 'staple' || match.state === 'missing') continue;

    const productKey = match.sub?.key ?? ing.key;
    const unit = match.sub?.unit ?? ing.unit;
    let need = (match.sub?.qty ?? ing.qty) * factor;
    const name = getProduct(productKey)?.name ?? ing.name ?? '';

    const candidates = ctx.items
      .filter((it) => it.productKey === productKey && freshness(it.expiresAt, ctx.today) !== 'expired')
      .sort(byUrgency);

    for (const it of candidates) {
      if (need <= 0) break;
      const have = left.get(it.id) ?? 0;
      if (have <= 0) continue;
      const needInItemUnit = convert(need, unit, it.unit, productKey);
      if (needInItemUnit === null) continue;
      const take = Math.min(have, needInItemUnit);
      let after = have - take;
      if (after < LEFT_EPSILON[it.unit]) after = 0;
      left.set(it.id, after);
      lines.push({
        key: `${ing.key}:${it.id}`, ingredientName: name, itemId: it.id, itemName: it.name,
        take: have - after, unit: it.unit, before: have, after,
      });
      const takenInRecipeUnit = convert(take, it.unit, unit, productKey) ?? need;
      need -= takenInRecipeUnit;
    }
  }
  return lines;
}
