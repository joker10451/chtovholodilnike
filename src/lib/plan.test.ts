import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { getMonday } from '../shared/dates';
import { BASE_RECIPES } from '../shared/recipes';
import { generateWeekPlan } from './planGenerator';

const ctx = { items: [], staples: new Set<string>(), today: '2026-09-14', timeLimit: 45 };

describe('рацион: блюда по своим местам', () => {
  const plan = generateWeekPlan({ mondayIso: getMonday('2026-09-14'), ctx, recipes: BASE_RECIPES, servings: 2 });
  const recipe = (id: string) => BASE_RECIPES.find((r) => r.id === id)!;

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

  it('остатки на обед — только от ужина, приготовленного впрок', () => {
    for (const m of plan.filter((x) => x.isLeftover)) {
      expect(recipe(m.recipeId).servings).toBeGreaterThanOrEqual(4);
    }
  });
});
