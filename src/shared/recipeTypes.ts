import type { RecipeUnit } from './units.js';

/**
 * key — без него блюдо не получится (вес 3),
 * secondary — желательно (вес 1),
 * basic — соль, масло, специи: не влияет на подбор (вес 0).
 */
export type Role = 'key' | 'secondary' | 'basic';

export interface Substitute {
  key: string;
  /** Если не задано — то же количество в тех же единицах */
  qty?: number;
  unit?: RecipeUnit;
}

export interface Ingredient {
  key: string | null;
  /** Название для ингредиентов вне справочника или уточнение («филе трески») */
  name?: string;
  /** 0 — «по вкусу» */
  qty: number;
  unit: RecipeUnit;
  role: Role;
  subs?: Substitute[];
}

export interface Step {
  text: string;
  /** Таймер в секундах */
  timer?: number;
}

export interface Recipe {
  id: string;
  title: string;
  /** Минут на всё */
  time: number;
  servings: number;
  kcal?: number;
  tags: string[];
  /** Цвет «тарелки» на карточке */
  color: string;
  ingredients: Ingredient[];
  steps: Step[];
  source: 'base' | 'ai';
  /** Фото блюда (для рецептов из каталога) */
  image?: string;
  /** Откуда рецепт: ссылка или название источника */
  origin?: string;
}
