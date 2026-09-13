import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '../data/types';
import { addDays, getMonday } from '../shared/dates';
import { BASE_RECIPES } from '../shared/recipes';
import type { MatchContext } from './matching';
import { generateWeekPlan, planShoppingList } from './planGenerator';
import { packHint, purchaseAmount } from './shoppingMath';
import { tastesFromLog } from './taste';

const MONDAY = getMonday('2026-09-14');
const recipe = (id: string) => BASE_RECIPES.find((r) => r.id === id)!;

function item(productKey: string, qty: number, unit: InventoryItem['unit'], expiresAt: string | null): InventoryItem {
  return {
    id: productKey, name: productKey, productKey, category: 'other', qty, unit, location: 'fridge',
    purchasedAt: MONDAY, openedAt: null, expiresAt, isEstimate: false, source: 'manual', createdAt: 0,
  };
}

function ctx(items: InventoryItem[] = [], extra: Partial<MatchContext> = {}): MatchContext {
  return { items, staples: new Set(['salt', 'sugar', 'flour', 'vegetable_oil', 'spices', 'black_pepper', 'baking_powder']), today: MONDAY, timeLimit: 45, ...extra };
}

describe('рацион: блюда по своим местам', () => {
  const plan = generateWeekPlan({ mondayIso: MONDAY, ctx: ctx(), recipes: BASE_RECIPES, servings: 2 });

  it('на завтрак только завтраки, напитки не попадают в рацион', () => {
    for (const m of plan) {
      const r = recipe(m.recipeId);
      expect(r.tags, `${m.slot}: ${r.title}`).not.toContain('напиток');
      if (m.slot === 'breakfast') expect(r.tags).toContain('завтрак');
      else expect(r.tags.some((t) => t === 'обед' || t === 'ужин')).toBe(true);
    }
  });

  it('ужины не повторяются за неделю', () => {
    const dinners = plan.filter((m) => m.slot === 'dinner').map((m) => m.recipeId);
    expect(new Set(dinners).size).toBe(dinners.length);
  });

  it('в день готовки ужин готовится впрок, а на следующий обед — его остатки', () => {
    const mondayDinner = plan.find((m) => m.date === MONDAY && m.slot === 'dinner')!;
    expect(mondayDinner.servings).toBe(4);
    const tuesdayLunch = plan.find((m) => m.date === addDays(MONDAY, 1) && m.slot === 'lunch')!;
    expect(tuesdayLunch.isLeftover).toBe(true);
    expect(tuesdayLunch.recipeId).toBe(mondayDinner.recipeId);
    // Во вторник не день готовки — в среду обед не из остатков
    expect(plan.find((m) => m.date === addDays(MONDAY, 2) && m.slot === 'lunch')?.isLeftover).toBeFalsy();
  });

  it('можно планировать только ужины', () => {
    const dinnersOnly = generateWeekPlan({ mondayIso: MONDAY, ctx: ctx(), recipes: BASE_RECIPES, options: { meals: ['dinner'], cookDays: [] } });
    expect(dinnersOnly).toHaveLength(7);
    expect(dinnersOnly.every((m) => m.slot === 'dinner' && m.servings === 2)).toBe(true);
  });
});

describe('рацион: прошедшие дни', () => {
  it('в середине недели планирует только с сегодняшнего дня, прошлое не трогает', () => {
    const wednesday = addDays(MONDAY, 2);
    const past = { id: `${MONDAY}_dinner`, date: MONDAY, slot: 'dinner' as const, recipeId: 'borscht', title: 'Борщ', servings: 2, createdAt: 0 };
    const plan = generateWeekPlan({ mondayIso: MONDAY, ctx: ctx([], { today: wednesday }), recipes: BASE_RECIPES, existingMeals: [past] });
    expect(plan.filter((m) => m.date < wednesday)).toEqual([past]);
    expect(plan.filter((m) => m.date >= wednesday)).toHaveLength(15);
  });
});

describe('рацион: продукты и вкусы', () => {
  it('истекающий продукт идёт в блюдо до конца срока', () => {
    const kefir = item('kefir', 900, 'ml', addDays(MONDAY, 1));
    const plan = generateWeekPlan({ mondayIso: MONDAY, ctx: ctx([kefir, item('egg', 10, 'pcs', addDays(MONDAY, 20))]), recipes: BASE_RECIPES });
    const usingKefir = plan.filter((m) => recipe(m.recipeId).ingredients.some((i) => i.key === 'kefir') && !m.isLeftover);
    expect(usingKefir.length).toBeGreaterThan(0);
    expect(usingKefir[0].date <= kefir.expiresAt!).toBe(true);
    expect(usingKefir[0].note).toMatch(/доедает/);
  });

  it('нелюбимое блюдо в рацион не попадает', () => {
    const tastes = tastesFromLog([{ recipeId: 'shakshuka', title: 'Шакшука', portions: 2, cookedAt: 1, rating: 1 }]);
    const plan = generateWeekPlan({ mondayIso: MONDAY, ctx: ctx([], { tastes }), recipes: BASE_RECIPES });
    expect(plan.some((m) => m.recipeId === 'shakshuka')).toBe(false);
  });

  it('любимое блюдо ставится раньше нейтрального', () => {
    const tastes = tastesFromLog([{ recipeId: 'borscht', title: 'Борщ', portions: 6, cookedAt: 1, rating: 5 }]);
    const plan = generateWeekPlan({ mondayIso: MONDAY, ctx: ctx([], { tastes }), recipes: BASE_RECIPES });
    expect(plan.some((m) => m.recipeId === 'borscht')).toBe(true);
  });

  it('закреплённое блюдо остаётся на месте', () => {
    const initial = generateWeekPlan({ mondayIso: MONDAY, ctx: ctx(), recipes: BASE_RECIPES });
    const locked = { ...initial[0], locked: true, recipeId: 'syrniki', title: 'Сырники' };
    const again = generateWeekPlan({ mondayIso: MONDAY, ctx: ctx(), recipes: BASE_RECIPES, existingMeals: [locked] });
    expect(again.find((m) => m.id === locked.id)).toEqual(locked);
  });
});

describe('покупки к рациону', () => {
  it('округляет до упаковок и учитывает то, что есть дома', () => {
    const meals = [
      { id: 'a', date: MONDAY, slot: 'breakfast' as const, recipeId: 'syrniki', title: 'Сырники', servings: 2, createdAt: 0 },
      { id: 'b', date: addDays(MONDAY, 1), slot: 'breakfast' as const, recipeId: 'cottage-casserole', title: 'Запеканка', servings: 4, createdAt: 0 },
    ];
    const lines = planShoppingList({ meals, recipes: BASE_RECIPES, inventoryItems: [item('egg', 1, 'pcs', addDays(MONDAY, 20))], staples: new Set(['flour', 'sugar', 'salt', 'baking_powder', 'vegetable_oil']), today: MONDAY });
    const cottage = lines.find((l) => l.productKey === 'cottage_cheese')!;
    expect(cottage.qty % 200).toBe(0); // пачками по 200 г
    expect(cottage.qty).toBeGreaterThanOrEqual(900);
    const eggs = lines.find((l) => l.productKey === 'egg')!;
    expect(eggs.qty).toBe(10); // нужно 3, дома 1 → одна упаковка
    expect(cottage.recipeTitle).toContain('Сырники');
  });

  it('продукт, который испортится до дня готовки, не считается имеющимся', () => {
    const meals = [{ id: 'd', date: addDays(MONDAY, 4), slot: 'dinner' as const, recipeId: 'chicken-rice-zucchini', title: 'Курица', servings: 4, createdAt: 0 }];
    const lines = planShoppingList({ meals, recipes: BASE_RECIPES, inventoryItems: [item('chicken_thigh', 800, 'g', addDays(MONDAY, 1))], staples: new Set(), today: MONDAY });
    expect(lines.some((l) => l.productKey === 'chicken_thigh')).toBe(true);
  });

  it('ложки переводятся в граммы, штучное — в упаковки', () => {
    expect(purchaseAmount('milk', 150, 'ml')).toEqual({ qty: 930, unit: 'ml' });
    expect(purchaseAmount('egg', 12, 'pcs')).toEqual({ qty: 20, unit: 'pcs' });
    expect(purchaseAmount('tomato', 2, 'pcs')).toEqual({ qty: 2, unit: 'pcs' });
    expect(packHint('milk', 1860, 'ml')).toBe('2 уп. по 930 мл');
  });
});
