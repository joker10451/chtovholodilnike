import { getProduct } from '../shared/products';
import { convert, formatQty, toBase, type BaseUnit, type ItemUnit, type RecipeUnit } from '../shared/units';

/**
 * Сколько купить: переводим ложки в граммы и округляем до упаковки.
 * Нужно 150 мл молока → одна пачка 930 мл; нужно 12 яиц → две упаковки по 10.
 */
export function purchaseAmount(productKey: string | null, qty: number, unit: RecipeUnit | ItemUnit): { qty: number; unit: ItemUnit } {
  if (unit === 'portion') return { qty: Math.ceil(qty), unit };
  const base = toBase(qty, unit, productKey);
  const product = getProduct(productKey);
  if (!product?.pack || base.qty <= 0) return { qty: roundUp(base.qty, base.unit), unit: base.unit };
  const inPackUnit = convert(base.qty, base.unit, product.unit, productKey);
  if (inPackUnit === null) return { qty: roundUp(base.qty, base.unit), unit: base.unit };
  const packs = Math.max(1, Math.ceil(inPackUnit / product.pack - 0.05));
  return { qty: packs * product.pack, unit: product.unit };
}

function roundUp(qty: number, unit: BaseUnit): number {
  if (qty <= 0) return 1;
  if (unit === 'pcs') return Math.ceil(qty - 0.05);
  if (qty < 100) return Math.ceil(qty / 10) * 10;
  return Math.ceil(qty / 50) * 50;
}

/** «2 уп. по 930 мл», если количество кратно типовой упаковке */
export function packHint(productKey: string | null, qty: number, unit: ItemUnit): string | null {
  const product = getProduct(productKey);
  if (!product?.pack || product.pack <= 1 || unit !== product.unit || qty <= 0) return null;
  const packs = qty / product.pack;
  if (Math.abs(packs - Math.round(packs)) > 0.01) return null;
  return `${Math.round(packs)} уп. по ${formatQty(product.pack, product.unit)}`;
}
