import type { Ingredient, Recipe, Step, Substitute } from './recipeTypes.js';
import type { RecipeUnit } from './units.js';

const MIN = 60;

export function key(k: string, qty: number, unit: RecipeUnit, subs?: Substitute[], name?: string): Ingredient {
  return { key: k, qty, unit, role: 'key', subs, name };
}
export function sec(k: string, qty: number, unit: RecipeUnit, subs?: Substitute[], name?: string): Ingredient {
  return { key: k, qty, unit, role: 'secondary', subs, name };
}
export function basic(k: string, qty = 0, unit: RecipeUnit = 'pinch'): Ingredient {
  return { key: k, qty, unit, role: 'basic' };
}
export function st(text: string, timerMin?: number): Step {
  return timerMin ? { text, timer: Math.round(timerMin * MIN) } : { text };
}

export type Meta = Pick<Recipe, 'time' | 'servings' | 'tags' | 'color'> & { kcal?: number };

export function r(id: string, title: string, meta: Meta, ingredients: Ingredient[], steps: Step[]): Recipe {
  return { id, title, ...meta, ingredients, steps, source: 'base' };
}
