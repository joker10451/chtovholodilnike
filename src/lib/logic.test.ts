import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { InventoryItem } from '../data/types';
import { GeneratedRecipeSchema, RecognitionSchema } from '../shared/aiSchemas';
import { addDays, daysBetween } from '../shared/dates';
import { estimateExpiry, freshness, stickerText } from '../shared/freshness';
import { guessProductKey, PRODUCTS } from '../shared/products';
import { BASE_RECIPES } from '../shared/recipes';
import { convert, formatQty } from '../shared/units';
import { planDeduction } from './cooking';
import { matchRecipe, onShelf, rankRecipes, type MatchContext } from './matching';
import { parseProductsText } from './parseText';

const TODAY = '2026-09-13';

function item(p: Partial<InventoryItem> & Pick<InventoryItem, 'productKey' | 'qty' | 'unit'>): InventoryItem {
  return {
    id: p.productKey ?? 'x', name: p.productKey ?? 'x', category: 'other', location: 'fridge',
    purchasedAt: TODAY, openedAt: null, expiresAt: addDays(TODAY, 10), isEstimate: true, source: 'manual', createdAt: 0,
    ...p,
  };
}

function ctx(items: InventoryItem[], staples = ['salt', 'sugar', 'flour', 'baking_powder', 'vegetable_oil', 'spices', 'black_pepper']): MatchContext {
  return { items, staples: new Set(staples), today: TODAY, timeLimit: 45 };
}

describe('даты и сроки', () => {
  it('считает дни через границу месяца', () => {
    expect(addDays('2026-09-29', 3)).toBe('2026-10-02');
    expect(daysBetween('2026-09-13', '2026-09-15')).toBe(2);
  });

  it('определяет свежесть', () => {
    expect(freshness('2026-09-20', TODAY)).toBe('fresh');
    expect(freshness('2026-09-15', TODAY)).toBe('soon');
    expect(freshness(TODAY, TODAY)).toBe('today');
    expect(freshness('2026-09-12', TODAY)).toBe('expired');
    expect(stickerText('2026-09-15', true, TODAY)).toBe('~15.09');
    expect(stickerText('2026-09-15', false, TODAY)).toBe('до 15.09');
  });

  it('вскрытая упаковка сокращает срок', () => {
    const closed = estimateExpiry({ productKey: 'kefir', category: 'dairy', location: 'fridge', purchasedAt: TODAY, openedAt: null, packageDate: '2026-09-23' });
    expect(closed).toEqual({ expiresAt: '2026-09-23', isEstimate: false });
    const opened = estimateExpiry({ productKey: 'kefir', category: 'dairy', location: 'fridge', purchasedAt: TODAY, openedAt: TODAY, packageDate: '2026-09-23' });
    expect(opened).toEqual({ expiresAt: '2026-09-16', isEstimate: true });
  });

  it('морозилка продлевает срок', () => {
    const r = estimateExpiry({ productKey: 'chicken_thigh', category: 'poultry', location: 'freezer', purchasedAt: TODAY, openedAt: null, packageDate: null });
    expect(daysBetween(TODAY, r.expiresAt!)).toBe(180);
  });
});

describe('единицы', () => {
  it('переводит штуки в граммы и ложки в мл', () => {
    expect(convert(2, 'pcs', 'g', 'egg')).toBe(110);
    expect(convert(2, 'tbsp', 'ml', 'vegetable_oil')).toBe(30);
    expect(convert(1, 'pcs', 'g', 'chicken_thigh')).toBeNull();
  });

  it('форматирует количество', () => {
    expect(formatQty(1500, 'g')).toBe('1,5 кг');
    expect(formatQty(0.5, 'pcs')).toBe('½ шт');
    expect(formatQty(0, 'pinch')).toBe('по вкусу');
  });
});

describe('справочник', () => {
  it('находит продукт по названию с упаковки', () => {
    expect(guessProductKey('Молоко Простоквашино 3,2%')).toBe('milk');
    expect(guessProductKey('Сливочное масло 82%')).toBe('butter');
    expect(guessProductKey('Филе трески')).toBe('white_fish');
    expect(guessProductKey('Куриное бедро')).toBe('chicken_thigh');
  });

  it('ключи уникальны, а рецепты ссылаются только на существующие продукты', () => {
    const keys = new Set(PRODUCTS.map((p) => p.key));
    expect(keys.size).toBe(PRODUCTS.length);
    for (const r of BASE_RECIPES) {
      for (const ing of r.ingredients) {
        expect(keys.has(ing.key!), `${r.id}: ${ing.key}`).toBe(true);
        for (const s of ing.subs ?? []) expect(keys.has(s.key), `${r.id}: ${s.key}`).toBe(true);
      }
    }
  });
});

describe('подбор рецептов', () => {
  const chickenRice = BASE_RECIPES.find((r) => r.id === 'chicken-rice-zucchini')!;

  it('всё есть — полное совпадение и полка «Всё есть»', () => {
    const c = ctx([
      item({ productKey: 'chicken_thigh', qty: 800, unit: 'g' }),
      item({ productKey: 'rice', qty: 900, unit: 'g' }),
      item({ productKey: 'zucchini', qty: 2, unit: 'pcs' }),
      item({ productKey: 'onion', qty: 3, unit: 'pcs' }),
      item({ productKey: 'carrot', qty: 2, unit: 'pcs' }),
      item({ productKey: 'garlic', qty: 10, unit: 'pcs' }),
    ]);
    const m = matchRecipe(c, chickenRice);
    expect(m.coverage).toBe(1);
    expect(m.missing).toHaveLength(0);
    expect(onShelf(m, 'ready')).toBe(true);
  });

  it('замена закрывает ингредиент, а нехватка ключевого — отправляет в «Докупить»', () => {
    const c = ctx([
      item({ productKey: 'chicken_breast', qty: 900, unit: 'g' }),
      item({ productKey: 'zucchini', qty: 1, unit: 'pcs' }),
    ]);
    const m = matchRecipe(c, chickenRice);
    expect(m.ingredients[0].state).toBe('sub');
    expect(m.missingKey).toBe(1);
    expect(onShelf(m, 'buy', true)).toBe(false); // не хватает риса, лука, моркови и чеснока — больше двух
  });

  it('при пустом холодильнике рецепты не попадают в «Докупить» или «Всё есть»', () => {
    const c = ctx([]); // холодильник пуст
    const m = matchRecipe(c, chickenRice);
    expect(m.coverage).toBe(0);
    expect(onShelf(m, 'buy', false)).toBe(false);
    expect(onShelf(m, 'ready', false)).toBe(false);
    expect(onShelf(m, 'rescue', false)).toBe(false);
    expect(onShelf(m, 'all', false)).toBe(true);
  });

  it('истекающие продукты поднимают рецепт выше', () => {
    const fresh = ctx([item({ productKey: 'kefir', qty: 900, unit: 'ml' }), item({ productKey: 'egg', qty: 6, unit: 'pcs' })]);
    const expiring = ctx([item({ productKey: 'kefir', qty: 900, unit: 'ml', expiresAt: addDays(TODAY, 1) }), item({ productKey: 'egg', qty: 6, unit: 'pcs' })]);
    const pancakes = BASE_RECIPES.find((r) => r.id === 'kefir-pancakes')!;
    expect(matchRecipe(expiring, pancakes).score).toBeGreaterThan(matchRecipe(fresh, pancakes).score);
    expect(onShelf(matchRecipe(expiring, pancakes), 'rescue')).toBe(true);
    expect(rankRecipes(ctx([item({ productKey: 'kefir', qty: 900, unit: 'ml', expiresAt: TODAY })]), BASE_RECIPES)[0].recipe.id).toBe('kefir-pancakes');
  });

  it('просроченное не считается', () => {
    const c = ctx([item({ productKey: 'egg', qty: 10, unit: 'pcs', expiresAt: '2026-09-10' })]);
    const omelet = BASE_RECIPES.find((r) => r.id === 'eggs-tomatoes')!;
    expect(matchRecipe(c, omelet).ingredients[0].state).toBe('missing');
  });
});

describe('списание после готовки', () => {
  it('сначала тратит открытое и то, что скорее испортится', () => {
    const omelet = BASE_RECIPES.find((r) => r.id === 'eggs-tomatoes')!;
    const c = ctx([
      item({ id: 'late', productKey: 'egg', qty: 10, unit: 'pcs', expiresAt: '2026-10-01' }),
      item({ id: 'early', productKey: 'egg', qty: 3, unit: 'pcs', expiresAt: '2026-09-18' }),
      item({ id: 'tom', productKey: 'tomato', qty: 500, unit: 'g' }),
    ]);
    const lines = planDeduction(c, omelet, 2);
    const eggs = lines.filter((l) => l.ingredientName === 'Яйца');
    expect(eggs.map((l) => [l.itemId, l.take])).toEqual([['early', 3], ['late', 1]]);
    const tomato = lines.find((l) => l.itemId === 'tom')!;
    expect(tomato.take).toBe(240);
    expect(tomato.after).toBe(260);
  });
});

describe('разбор фразы без интернета', () => {
  it('понимает числа словами и единицы', () => {
    const lines = parseProductsText('десяток яиц, 1 л молока, полкило фарша и 3 помидора');
    expect(lines).toEqual([
      { name: 'Яйца', productKey: 'egg', qty: 10, unit: 'pcs' },
      { name: 'Молоко', productKey: 'milk', qty: 1000, unit: 'ml' },
      { name: 'Фарш мясной', productKey: 'minced_meat', qty: 500, unit: 'g' },
      { name: 'Помидоры', productKey: 'tomato', qty: 3, unit: 'pcs' },
    ]);
  });
});

import { generateWeekPlan, addWeekPlanToShopping } from './planGenerator';
import { getMonday } from '../shared/dates';

describe('схемы для нейросети', () => {
  it('переводятся в JSON Schema без ошибок', () => {
    expect(() => z.toJSONSchema(RecognitionSchema)).not.toThrow();
    expect(() => z.toJSONSchema(GeneratedRecipeSchema)).not.toThrow();
  });
});

describe('рацион на неделю', () => {
  const mon = getMonday('2026-09-14');

  it('формирует план на 7 дней по 3 приёма пищи', () => {
    const c = ctx([item({ productKey: 'egg', qty: 10, unit: 'pcs' })]);
    const plan = generateWeekPlan({
      mondayIso: mon,
      ctx: c,
      recipes: BASE_RECIPES,
      servings: 2,
    });

    expect(plan).toHaveLength(21);
    const breakfasts = plan.filter((m) => m.slot === 'breakfast');
    const lunches = plan.filter((m) => m.slot === 'lunch');
    const dinners = plan.filter((m) => m.slot === 'dinner');

    expect(breakfasts).toHaveLength(7);
    expect(lunches).toHaveLength(7);
    expect(dinners).toHaveLength(7);
  });

  it('сохраняет заблокированные пользователем блюда при пересборке', () => {
    const c = ctx([]);
    const initial = generateWeekPlan({
      mondayIso: mon,
      ctx: c,
      recipes: BASE_RECIPES,
      servings: 2,
    });

    // Блокируем завтрак понедельника
    const lockedMeal = { ...initial[0], locked: true, title: 'Мой любимый омлет' };
    const regenerated = generateWeekPlan({
      mondayIso: mon,
      ctx: c,
      recipes: BASE_RECIPES,
      existingMeals: [lockedMeal],
      servings: 2,
    });

    const b0 = regenerated.find((m) => m.id === lockedMeal.id);
    expect(b0?.title).toBe('Мой любимый омлет');
    expect(b0?.locked).toBe(true);
  });

  it('выгружает недостающие ингредиенты плана в список покупок', async () => {
    const c = ctx([]);
    const plan = generateWeekPlan({
      mondayIso: mon,
      ctx: c,
      recipes: BASE_RECIPES,
      servings: 2,
    });

    const count = await addWeekPlanToShopping({
      meals: plan.slice(0, 3), // берем первые 3 приема пищи
      recipes: BASE_RECIPES,
      inventoryItems: [],
      staples: new Set(),
    });

    expect(count).toBeGreaterThan(0);
  });
});
