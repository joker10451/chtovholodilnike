import { getProduct, type BaseUnit } from './products.js';

export type { BaseUnit };

export type ItemUnit = BaseUnit | 'portion';
export type RecipeUnit = BaseUnit | 'tbsp' | 'tsp' | 'pinch';

export const UNIT_LABELS: Record<ItemUnit | RecipeUnit, string> = {
  g: 'г', ml: 'мл', pcs: 'шт', portion: 'порц.', tbsp: 'ст. л.', tsp: 'ч. л.', pinch: 'щеп.',
};

const SPOON: Record<'tbsp' | 'tsp' | 'pinch', number> = { tbsp: 15, tsp: 5, pinch: 1 };

/** Приводит ложки и щепотки к граммам/миллилитрам */
export function toBase(qty: number, unit: RecipeUnit, productKey: string | null): { qty: number; unit: BaseUnit } {
  if (unit === 'tbsp' || unit === 'tsp' || unit === 'pinch') {
    const product = getProduct(productKey);
    return { qty: qty * SPOON[unit], unit: product?.unit === 'ml' ? 'ml' : 'g' };
  }
  return { qty, unit };
}

/**
 * Перевод количества между единицами одного продукта.
 * г ↔ мл считаем 1:1, шт ↔ г — через вес одной штуки.
 * null — перевести нельзя (например, шт → г без веса штуки).
 */
export function convert(qty: number, from: ItemUnit | RecipeUnit, to: ItemUnit | RecipeUnit, productKey: string | null): number | null {
  if (from === 'portion' || to === 'portion') return from === to ? qty : null;
  const a = toBase(qty, from, productKey);
  const target = to === 'tbsp' || to === 'tsp' || to === 'pinch' ? null : to;
  if (target === null) {
    const perUnit = toBase(1, to as RecipeUnit, productKey).qty;
    const inBase = convert(a.qty, a.unit, toBase(1, to as RecipeUnit, productKey).unit, productKey);
    return inBase === null ? null : inBase / perUnit;
  }
  if (a.unit === target) return a.qty;
  const mass = a.unit === 'g' || a.unit === 'ml';
  const targetMass = target === 'g' || target === 'ml';
  if (mass && targetMass) return a.qty;
  const each = getProduct(productKey)?.each;
  if (!each) return null;
  if (a.unit === 'pcs' && targetMass) return a.qty * each;
  if (mass && target === 'pcs') return a.qty / each;
  return null;
}

export function roundQty(qty: number, unit: ItemUnit | RecipeUnit): number {
  if (unit === 'g' || unit === 'ml') return qty >= 100 ? Math.round(qty / 10) * 10 : Math.round(qty);
  if (unit === 'pcs' || unit === 'portion') return Math.round(qty * 2) / 2;
  return Math.round(qty * 2) / 2;
}

export function formatQty(qty: number, unit: ItemUnit | RecipeUnit): string {
  if (qty <= 0) return 'по вкусу';
  const r = roundQty(qty, unit);
  if ((unit === 'g' || unit === 'ml') && r >= 1000) {
    const big = Math.round(r / 100) / 10;
    return `${String(big).replace('.', ',')} ${unit === 'g' ? 'кг' : 'л'}`;
  }
  const shown = r === 0.5 ? '½' : String(r).replace('.', ',').replace(',5', '½');
  return `${shown} ${UNIT_LABELS[unit]}`;
}
