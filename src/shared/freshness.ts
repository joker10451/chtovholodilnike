import { addDays, daysBetween, shortDate } from './dates.js';
import { CATEGORY_LIFE, getProduct, type Category, type Location } from './products.js';

export type Freshness = 'fresh' | 'soon' | 'today' | 'expired' | 'unknown';

/** Сколько дней до конца срока считается «скоро» */
export const SOON_DAYS = 3;
/** Продукты с таким запасом дней рецепты стараются «спасти» */
export const RESCUE_DAYS = 2;

export function daysLeft(expiresAt: string | null, today: string): number | null {
  return expiresAt ? daysBetween(today, expiresAt) : null;
}

export function freshness(expiresAt: string | null, today: string): Freshness {
  const left = daysLeft(expiresAt, today);
  if (left === null) return 'unknown';
  if (left < 0) return 'expired';
  if (left === 0) return 'today';
  if (left <= SOON_DAYS) return 'soon';
  return 'fresh';
}

export function stickerText(expiresAt: string | null, isEstimate: boolean, today: string): string {
  const f = freshness(expiresAt, today);
  if (f === 'unknown' || !expiresAt) return 'без срока';
  if (f === 'expired') return 'истёк';
  if (f === 'today') return 'сегодня';
  return `${isEstimate ? '~' : 'до '}${shortDate(expiresAt)}`;
}

export interface ExpiryInput {
  productKey: string | null;
  category: Category;
  location: Location;
  purchasedAt: string;
  openedAt: string | null;
  /** Дата «годен до» с упаковки, если известна */
  packageDate: string | null;
}

export function shelfLifeDays(productKey: string | null, category: Category, location: Location): number | null {
  const life = getProduct(productKey)?.life ?? CATEGORY_LIFE[category];
  return life[location] ?? CATEGORY_LIFE[category][location] ?? null;
}

/**
 * Срок = min(дата с упаковки или покупка + норма, вскрытие + норма после вскрытия).
 * В морозилке считаем от даты покупки по норме заморозки.
 */
export function estimateExpiry(input: ExpiryInput): { expiresAt: string | null; isEstimate: boolean } {
  const { productKey, category, location, purchasedAt, openedAt, packageDate } = input;
  const product = getProduct(productKey);
  let expiresAt: string | null = null;
  let isEstimate = true;

  if (location === 'freezer') {
    const days = shelfLifeDays(productKey, category, 'freezer');
    expiresAt = days === null ? packageDate : addDays(purchasedAt, days);
    if (days === null && packageDate) isEstimate = false;
    return { expiresAt, isEstimate };
  }

  if (packageDate) {
    expiresAt = packageDate;
    isEstimate = false;
  } else {
    const days = shelfLifeDays(productKey, category, location);
    expiresAt = days === null ? null : addDays(purchasedAt, days);
  }

  const openedLife = product?.opened;
  if (openedAt && openedLife !== undefined) {
    const afterOpen = addDays(openedAt, openedLife);
    if (!expiresAt || afterOpen < expiresAt) {
      expiresAt = afterOpen;
      isEstimate = true;
    }
  }
  return { expiresAt, isEstimate };
}
