// Итоги месяца: что готовили, что спасли от выброса и что всё-таки выбросили.
import type { CookLogEntry, WasteEntry } from '../data/types';

export interface DishStat {
  recipeId: string;
  title: string;
  times: number;
  lastRating: 1 | 3 | 5 | null;
}

export interface WasteStat {
  name: string;
  times: number;
}

export interface MonthStats {
  /** YYYY-MM */
  month: string;
  cooked: number;
  portions: number;
  rescued: number;
  wasted: number;
  topDishes: DishStat[];
  wasteByProduct: WasteStat[];
}

/** YYYY-MM по местному времени */
export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const name = new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long' });
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}

export function monthStats(log: CookLogEntry[], waste: WasteEntry[], month: string): MonthStats {
  const cookedThisMonth = log.filter((e) => !e.ratedOnly && monthKey(e.cookedAt) === month);
  const dishes = new Map<string, DishStat & { lastAt: number }>();
  for (const e of cookedThisMonth) {
    const d = dishes.get(e.recipeId) ?? { recipeId: e.recipeId, title: e.title, times: 0, lastRating: null, lastAt: 0 };
    d.times += 1;
    if (e.cookedAt >= d.lastAt) {
      d.lastAt = e.cookedAt;
      d.lastRating = e.rating ?? d.lastRating;
    }
    dishes.set(e.recipeId, d);
  }

  const wasteThisMonth = waste.filter((w) => monthKey(w.at) === month);
  const byName = new Map<string, WasteStat>();
  for (const w of wasteThisMonth) {
    const name = w.name.trim();
    const key = name.toLowerCase();
    const s = byName.get(key) ?? { name, times: 0 };
    s.times += 1;
    byName.set(key, s);
  }

  return {
    month,
    cooked: cookedThisMonth.length,
    portions: cookedThisMonth.reduce((sum, e) => sum + (e.portions || 0), 0),
    rescued: cookedThisMonth.reduce((sum, e) => sum + (e.rescued?.length ?? 0), 0),
    wasted: wasteThisMonth.length,
    topDishes: [...dishes.values()]
      .sort((a, b) => b.times - a.times || b.lastAt - a.lastAt)
      .slice(0, 5)
      .map(({ lastAt: _lastAt, ...d }) => d),
    wasteByProduct: [...byName.values()].sort((a, b) => b.times - a.times || a.name.localeCompare(b.name, 'ru')),
  };
}
