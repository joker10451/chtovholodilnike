import { newId } from '../data/db';
import type { InventoryItem, ItemSource } from '../data/types';
import type { GeneratedRecipe, RecognizedItem } from '../shared/aiSchemas';
import { normalizeToISODate } from '../shared/dates';
import { estimateExpiry } from '../shared/freshness';
import { getProduct, guessProductKey, type Category, type Location } from '../shared/products';
import type { Recipe } from '../shared/recipeTypes';
import type { ItemUnit } from '../shared/units';

export interface ItemDraftInput {
  name: string;
  productKey?: string | null;
  category?: Category;
  qty: number;
  unit: ItemUnit;
  location?: Location;
  packageDate?: string | null;
  purchasedAt: string;
  opened?: boolean;
  source: ItemSource;
  nutriments?: import('../data/types').Nutriments;
}

/** Собирает продукт холодильника, заполняя недостающее из справочника */
export function makeItem(input: ItemDraftInput): InventoryItem {
  const productKey = input.productKey && getProduct(input.productKey) ? input.productKey : guessProductKey(input.name);
  const product = getProduct(productKey);
  const category = input.category ?? product?.category ?? 'other';
  const location = input.location ?? product?.location ?? 'fridge';
  const openedAt = input.opened ? input.purchasedAt : null;
  const packageDate = normalizeToISODate(input.packageDate);
  const { expiresAt, isEstimate } = estimateExpiry({
    productKey, category, location, purchasedAt: input.purchasedAt, openedAt, packageDate,
  });
  return {
    id: newId(),
    name: input.name.trim() || product?.name || 'Продукт',
    productKey,
    category,
    qty: Math.max(0, input.qty),
    unit: input.unit,
    location,
    purchasedAt: input.purchasedAt,
    openedAt,
    expiresAt,
    isEstimate,
    source: input.source,
    createdAt: Date.now(),
    nutriments: input.nutriments,
  };
}

/** Позиция из распознавания → черновик для экрана проверки */
export interface ReviewDraft {
  uid: string;
  include: boolean;
  name: string;
  productKey: string | null;
  category: Category;
  qty: number;
  unit: ItemUnit;
  /** Остаток в таре 0..1, null — полная/не тара */
  fill: number | null;
  location: Location;
  packageDate: string | null;
  confidence: number;
  photoIndex: number;
  box: RecognizedItem['box'];
  question: RecognizedItem['question'];
  answered: boolean;
}

export function toReviewDraft(item: RecognizedItem, index: number): ReviewDraft {
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const productKey = item.product_key && getProduct(item.product_key) ? item.product_key : guessProductKey(item.name);
  return {
    uid: `${index}`,
    include: true,
    name: item.name,
    productKey,
    category: item.category,
    qty: Math.max(0, Math.round(item.qty * 100) / 100),
    unit: item.unit,
    fill: item.fill === null ? null : clamp(Math.round(item.fill * 4) / 4),
    location: item.location,
    packageDate: normalizeToISODate(item.expires_at),
    confidence: clamp(item.confidence),
    photoIndex: Math.max(0, Math.round(item.photo_index)),
    box: item.box && { x: clamp(item.box.x), y: clamp(item.box.y), w: clamp(item.box.w), h: clamp(item.box.h) },
    question: item.question && item.question.options.length >= 2 ? item.question : null,
    answered: false,
  };
}

export function draftToItem(d: ReviewDraft, purchasedAt: string, source: ItemSource): InventoryItem {
  const fill = d.fill ?? 1;
  return makeItem({
    name: d.name,
    productKey: d.productKey,
    category: d.category,
    qty: d.qty * fill,
    unit: d.unit,
    location: d.location,
    packageDate: d.packageDate,
    purchasedAt,
    opened: false,
    source,
  });
}

const PLATE_COLORS = ['#C9793A', '#E0A94B', '#7BA94A', '#C1502E', '#D9C28A', '#8A5A3B', '#E58B2F', '#A9C27A'];

export function generatedToRecipe(g: GeneratedRecipe, origin?: string): Recipe {
  return {
    id: `ai-${newId()}`,
    title: g.title,
    time: Math.max(5, Math.round(g.time_min)),
    servings: Math.max(1, Math.round(g.servings)),
    kcal: g.kcal_per_serving ? Math.round(g.kcal_per_serving) : undefined,
    tags: [...new Set([...g.tags.map((t) => t.toLowerCase()), origin ? origin : 'нейросеть'])].slice(0, 5),
    color: PLATE_COLORS[Math.floor(Math.random() * PLATE_COLORS.length)],
    ingredients: g.ingredients.map((i) => {
      const key = i.product_key && getProduct(i.product_key) ? i.product_key : guessProductKey(i.name);
      const productName = getProduct(key)?.name;
      return {
        key,
        name: productName && productName.toLowerCase() === i.name.toLowerCase() ? undefined : i.name,
        qty: Math.max(0, i.qty),
        unit: i.unit,
        role: i.role,
      };
    }),
    steps: g.steps.map((s) => (s.timer_min ? { text: s.text, timer: Math.round(s.timer_min * 60) } : { text: s.text })),
    source: 'ai',
  };
}
