import { describe, expect, it } from 'vitest';
import type { CookLogEntry, WasteEntry } from '../data/types';
import { monthStats, monthTitle, shiftMonth } from './stats';

const at = (iso: string) => new Date(`${iso}T12:00:00`).getTime();

const log: CookLogEntry[] = [
  { recipeId: 'syrniki', title: 'Сырники', portions: 2, cookedAt: at('2026-09-02'), rating: 3, rescued: ['Творог'] },
  { recipeId: 'syrniki', title: 'Сырники', portions: 2, cookedAt: at('2026-09-10'), rating: 5 },
  { recipeId: 'borscht', title: 'Борщ', portions: 6, cookedAt: at('2026-09-05'), rescued: ['Свёкла', 'Капуста'] },
  { recipeId: 'borscht', title: 'Борщ', portions: 0, cookedAt: at('2026-09-06'), rating: 5, ratedOnly: true },
  { recipeId: 'omelet', title: 'Омлет', portions: 2, cookedAt: at('2026-08-31') },
];

const waste: WasteEntry[] = [
  { id: 'w1', name: 'Хлеб', productKey: 'bread', qty: 1, unit: 'pcs', at: at('2026-09-03') },
  { id: 'w2', name: 'хлеб ', productKey: 'bread', qty: 1, unit: 'pcs', at: at('2026-09-20') },
  { id: 'w3', name: 'Кефир', productKey: 'kefir', qty: 500, unit: 'ml', at: at('2026-09-21') },
  { id: 'w4', name: 'Сыр', productKey: 'cheese', qty: 100, unit: 'g', at: at('2026-10-01') },
];

describe('итоги месяца', () => {
  const s = monthStats(log, waste, '2026-09');

  it('считает только блюда месяца, без оценок «не готовя»', () => {
    expect(s.cooked).toBe(3);
    expect(s.portions).toBe(10);
    expect(s.rescued).toBe(3);
  });

  it('частые блюда — с последней оценкой', () => {
    expect(s.topDishes[0]).toEqual({ recipeId: 'syrniki', title: 'Сырники', times: 2, lastRating: 5 });
    expect(s.topDishes.map((d) => d.recipeId)).toEqual(['syrniki', 'borscht']);
  });

  it('выброшенное группируется по названию без учёта регистра', () => {
    expect(s.wasted).toBe(3);
    expect(s.wasteByProduct).toEqual([{ name: 'Хлеб', times: 2 }, { name: 'Кефир', times: 1 }]);
  });

  it('месяцы переключаются через границу года', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(monthTitle('2026-09')).toBe('Сентябрь 2026');
  });
});
