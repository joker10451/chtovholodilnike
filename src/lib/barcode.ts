// Сведения о товаре по штрихкоду.
// Порядок поиска: семейная база штрихкодов (работает офлайн и знает всё, что вы уже сканировали)
// → Open Food Facts → фото упаковки нейросетью. То, что узнали по фото, запоминается для следующего раза.
import { putRecord } from '../data/repo';
import { db } from '../data/db';
import type { Nutriments } from '../data/types';
import type { PackageInfo } from '../shared/aiSchemas';
import { addDays, isISODate } from '../shared/dates';
import { getProduct, guessProductKey, type BaseUnit, type Category, type Location } from '../shared/products';

export type ProductSource = 'memory' | 'openfoodfacts' | 'photo' | 'manual';

export interface ProductInfo {
  barcode: string | null;
  name: string;
  brand: string | null;
  productKey: string | null;
  category: Category;
  qty: number;
  unit: BaseUnit;
  location: Location;
  imageUrl: string | null;
  nutriments: Nutriments | null;
  fatPercent: number | null;
  /** Даты относятся к конкретной упаковке и в базу штрихкодов не сохраняются */
  expiresAt: string | null;
  manufacturedAt: string | null;
  shelfLifeDays: number | null;
  afterOpeningDays: number | null;
  storage: string | null;
  composition: string | null;
  source: ProductSource;
}

/** Хватает ли сведений, чтобы не просить сфотографировать упаковку */
export function isComplete(p: ProductInfo): boolean {
  return p.name.trim().length > 2 && p.qty > 0;
}

export function emptyProduct(barcode: string | null): ProductInfo {
  return {
    barcode, name: '', brand: null, productKey: null, category: 'other', qty: 1, unit: 'pcs', location: 'fridge',
    imageUrl: null, nutriments: null, fatPercent: null, expiresAt: null, manufacturedAt: null, shelfLifeDays: null,
    afterOpeningDays: null, storage: null, composition: null, source: 'manual',
  };
}

// ——— Семейная база штрихкодов ———

type RememberedProduct = Omit<ProductInfo, 'expiresAt' | 'manufacturedAt' | 'source'> & { barcode: string; savedAt: number };

const recordId = (code: string) => `barcode:${code}`;

export async function rememberProduct(p: ProductInfo): Promise<void> {
  if (!p.barcode || !p.name.trim()) return;
  const { expiresAt: _e, manufacturedAt: _m, source: _s, ...rest } = p;
  const data: RememberedProduct = { ...rest, barcode: p.barcode, name: p.name.trim(), savedAt: Date.now() };
  await putRecord('barcode', recordId(p.barcode), data);
}

async function fromMemory(code: string): Promise<ProductInfo | null> {
  const row = await db.records.get(recordId(code));
  if (!row || row.deleted) return null;
  const data = row.data as RememberedProduct;
  return { ...emptyProduct(code), ...data, expiresAt: null, manufacturedAt: null, source: 'memory' };
}

// ——— Open Food Facts ———

const OFF_FIELDS = [
  'product_name_ru', 'product_name', 'generic_name_ru', 'generic_name', 'brands', 'quantity', 'product_quantity',
  'product_quantity_unit', 'categories_tags', 'image_front_small_url', 'image_front_url', 'nutriments',
  'conservation_conditions_ru', 'conservation_conditions', 'ingredients_text_ru',
].join(',');

type OffProduct = Record<string, unknown> & { nutriments?: Record<string, unknown> };

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
/** В Open Food Facts поля часто заполнены на языке страны производителя — показываем только русский текст */
const russianOnly = (s: string | null) => (s && /[а-яё]/i.test(s) ? s : null);
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export function parseOffProduct(code: string, p: OffProduct): ProductInfo | null {
  const brand = str(p.brands)?.split(',')[0].trim() ?? null;
  const rawName = str(p.product_name_ru) ?? str(p.generic_name_ru) ?? str(p.product_name) ?? str(p.generic_name);
  if (!rawName) return null;
  const name = brand ? rawName.replace(new RegExp(`\\s*${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), ' ').trim() || rawName : rawName;

  let { qty, unit } = parseQuantity(str(p.quantity) ?? undefined);
  const pq = num(p.product_quantity);
  const pqUnit = str(p.product_quantity_unit)?.toLowerCase();
  if (pq && pq > 0 && (pqUnit === 'g' || pqUnit === 'ml')) {
    qty = Math.round(pq);
    unit = pqUnit;
  }

  const n = p.nutriments ?? {};
  const nutriments: Nutriments = {
    kcal: num(n['energy-kcal_100g']) ?? undefined,
    proteins: round1(num(n['proteins_100g'])) ?? undefined,
    fat: round1(num(n['fat_100g'])) ?? undefined,
    carbs: round1(num(n['carbohydrates_100g'])) ?? undefined,
  };
  if (nutriments.kcal !== undefined) nutriments.kcal = Math.round(nutriments.kcal);
  const hasNutriments = Object.values(nutriments).some((v) => v !== undefined);

  const productKey = guessProductKey(name);
  const known = getProduct(productKey);
  const tags = Array.isArray(p.categories_tags) ? (p.categories_tags as string[]) : undefined;
  const category = known?.category ?? mapCategories(tags);
  const fat = name.match(/(\d+(?:[.,]\d+)?)\s*%/);

  return {
    ...emptyProduct(code),
    name,
    brand,
    productKey,
    category,
    qty,
    unit,
    location: known?.location ?? (category === 'frozen' ? 'freezer' : ['grains', 'canned', 'sweets', 'spices', 'nuts'].includes(category) ? 'pantry' : 'fridge'),
    imageUrl: str(p.image_front_small_url) ?? str(p.image_front_url),
    nutriments: hasNutriments ? nutriments : null,
    fatPercent: fat ? parseFloat(fat[1].replace(',', '.')) : null,
    storage: russianOnly(str(p.conservation_conditions_ru) ?? str(p.conservation_conditions)),
    composition: russianOnly(str(p.ingredients_text_ru))?.slice(0, 160) ?? null,
    source: 'openfoodfacts',
  };
}

async function fromOpenFoodFacts(code: string): Promise<ProductInfo | null> {
  if (!navigator.onLine) return null;
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}&lc=ru`, {
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: number; product?: OffProduct };
    return data.status === 1 && data.product ? parseOffProduct(code, data.product) : null;
  } catch {
    return null;
  }
}

export async function lookupBarcode(code: string): Promise<ProductInfo | null> {
  return (await fromMemory(code)) ?? (await fromOpenFoodFacts(code));
}

// ——— Фото упаковки ———

export function fromPackage(pkg: PackageInfo, barcode: string | null): ProductInfo {
  const productKey = pkg.product_key && getProduct(pkg.product_key) ? pkg.product_key : guessProductKey(pkg.name);
  const nutriments: Nutriments = {
    kcal: pkg.kcal === null ? undefined : Math.round(pkg.kcal),
    proteins: round1(pkg.proteins) ?? undefined,
    fat: round1(pkg.fat) ?? undefined,
    carbs: round1(pkg.carbs) ?? undefined,
  };
  return {
    barcode: barcode ?? (pkg.barcode && /^\d{8,14}$/.test(pkg.barcode) ? pkg.barcode : null),
    name: pkg.name.trim(),
    brand: pkg.brand?.trim() || null,
    productKey,
    category: pkg.category,
    qty: pkg.qty > 0 ? Math.round(pkg.qty * 100) / 100 : 1,
    unit: pkg.unit,
    location: pkg.location,
    imageUrl: null,
    nutriments: Object.values(nutriments).some((v) => v !== undefined) ? nutriments : null,
    fatPercent: pkg.fat_percent,
    expiresAt: isISODate(pkg.expires_at) ? pkg.expires_at : null,
    manufacturedAt: isISODate(pkg.manufactured_at) ? pkg.manufactured_at : null,
    shelfLifeDays: pkg.shelf_life_days && pkg.shelf_life_days > 0 ? Math.round(pkg.shelf_life_days) : null,
    afterOpeningDays: pkg.after_opening_days && pkg.after_opening_days > 0 ? Math.round(pkg.after_opening_days) : null,
    storage: cleanText(pkg.storage),
    composition: cleanText(pkg.composition)?.slice(0, 160) ?? null,
    source: 'photo',
  };
}

/** Модель иногда возвращает служебные символы вместо «…» и пробелов */
function cleanText(s: string | null): string | null {
  const t = s?.replace(/[\x00-\x08\x0b-\x1f\x7f]+/g, '…').replace(/\s+/g, ' ').trim();
  return t || null;
}

/** Дополняет известное о товаре новыми сведениями, не затирая заполненное пустым */
export function mergeProduct(base: ProductInfo, extra: ProductInfo): ProductInfo {
  const pick = <K extends keyof ProductInfo>(k: K): ProductInfo[K] => {
    const v = extra[k];
    return v === null || v === undefined || v === '' ? base[k] : v;
  };
  return {
    barcode: base.barcode ?? extra.barcode,
    name: base.name.trim() ? base.name : extra.name,
    brand: pick('brand'),
    productKey: pick('productKey'),
    category: extra.category !== 'other' ? extra.category : base.category,
    qty: extra.qty > 1 || base.qty <= 1 ? extra.qty : base.qty,
    unit: extra.qty > 1 || base.qty <= 1 ? extra.unit : base.unit,
    location: extra.source === 'photo' ? extra.location : base.location,
    imageUrl: pick('imageUrl'),
    nutriments: pick('nutriments'),
    fatPercent: pick('fatPercent'),
    expiresAt: pick('expiresAt'),
    manufacturedAt: pick('manufacturedAt'),
    shelfLifeDays: pick('shelfLifeDays'),
    afterOpeningDays: pick('afterOpeningDays'),
    storage: pick('storage'),
    composition: pick('composition'),
    source: base.source === 'manual' ? extra.source : base.source,
  };
}

/** Дата «годен до» для этой упаковки: напечатанная или изготовление + срок */
export function packageExpiry(p: Pick<ProductInfo, 'expiresAt' | 'manufacturedAt' | 'shelfLifeDays'>): string | null {
  if (p.expiresAt) return p.expiresAt;
  if (p.manufacturedAt && p.shelfLifeDays) return addDays(p.manufacturedAt, p.shelfLifeDays);
  return null;
}

// ——— Разбор полей Open Food Facts ———

export function parseQuantity(raw?: string): { qty: number; unit: BaseUnit } {
  if (!raw) return { qty: 1, unit: 'pcs' };
  const text = raw.toLowerCase().replace(',', '.').trim();
  const match = text.match(/(\d+(?:\.\d+)?)\s*(кг|kg|г|гр|g|л|l|мл|ml|шт|pcs|уп)/);
  if (match) {
    const val = parseFloat(match[1]);
    const u = match[2];
    if (u === 'кг' || u === 'kg') return { qty: Math.round(val * 1000), unit: 'g' };
    if (u === 'г' || u === 'гр' || u === 'g') return { qty: Math.round(val), unit: 'g' };
    if (u === 'л' || u === 'l') return { qty: Math.round(val * 1000), unit: 'ml' };
    if (u === 'мл' || u === 'ml') return { qty: Math.round(val), unit: 'ml' };
    return { qty: Math.max(1, Math.round(val)), unit: 'pcs' };
  }
  return { qty: 1, unit: 'pcs' };
}

export function mapCategories(tags?: string[]): Category {
  if (!tags || tags.length === 0) return 'other';
  const s = tags.join(' ').toLowerCase();
  const has = (...words: string[]) => words.some((w) => s.includes(w));

  if (has('frozen', 'ice-cream')) return 'frozen';
  if (has('dair', 'milk', 'yogurt', 'cheese', 'butter', 'cottage', 'kefir', 'sour-cream')) return 'dairy';
  if (has('en:eggs')) return 'eggs';
  if (has('poultry', 'chicken', 'turkey')) return 'poultry';
  if (has('meat', 'pork', 'beef', 'sausage', 'ham')) return 'meat';
  if (has('fish', 'seafood', 'salmon', 'tuna')) return 'fish';
  if (has('beverage', 'drink', 'juice', 'water', 'tea', 'coffee', 'soda')) return 'drinks';
  if (has('canned', 'preserve')) return 'canned';
  if (has('vegetable', 'tomato', 'cucumber', 'carrot', 'potato', 'salad')) return 'vegetables';
  if (has('fruit', 'apple', 'banana', 'citrus', 'berr')) return 'fruits';
  if (has('bread', 'bakery', 'toast', 'croissant')) return 'bakery';
  if (has('cereal', 'grain', 'pasta', 'rice', 'flour', 'buckwheat', 'oat')) return 'grains';
  if (has('sauce', 'condiment', 'ketchup', 'mayo', 'mustard')) return 'sauces';
  if (has('sweet', 'chocolate', 'candy', 'biscuit', 'cake', 'cookie')) return 'sweets';
  if (has('nuts', 'seeds', 'almond', 'walnut')) return 'nuts';
  if (has('spice', 'seasoning', 'salt')) return 'spices';
  return 'other';
}
