import type { CookLogEntry } from '../data/types';

/** Оценка блюда семьёй: 1 — не понравилось, 3 — нормально, 5 — очень вкусно */
export type Rating = 1 | 3 | 5;

export const RATING_LABELS: Record<Rating, string> = {
  1: 'Не очень',
  3: 'Нормально',
  5: 'Вкусно',
};

export interface RecipeTaste {
  /** 0..1, 0.5 — ещё не оценивали */
  score: number;
  /** Средняя оценка, если есть */
  average: number | null;
  cooked: number;
  last: Rating | null;
}

const NEUTRAL: RecipeTaste = { score: 0.5, average: null, cooked: 0, last: null };

/** Вкусы семьи по журналу готовки: последние оценки весят больше */
export function tastesFromLog(log: CookLogEntry[]): Map<string, RecipeTaste> {
  const byRecipe = new Map<string, CookLogEntry[]>();
  for (const e of log) {
    const list = byRecipe.get(e.recipeId) ?? [];
    list.push(e);
    byRecipe.set(e.recipeId, list);
  }
  const result = new Map<string, RecipeTaste>();
  for (const [id, entries] of byRecipe) {
    entries.sort((a, b) => b.cookedAt - a.cookedAt);
    const rated = entries.filter((e) => e.rating);
    let weight = 0;
    let sum = 0;
    rated.slice(0, 5).forEach((e, i) => {
      const w = 1 / (i + 1);
      weight += w;
      sum += w * e.rating!;
    });
    const average = weight ? sum / weight : null;
    result.set(id, {
      score: average === null ? 0.5 : (average - 1) / 4,
      average,
      cooked: entries.filter((e) => !e.ratedOnly).length,
      last: rated[0]?.rating ?? null,
    });
  }
  return result;
}

export function tasteOf(tastes: ReadonlyMap<string, RecipeTaste> | undefined, recipeId: string): RecipeTaste {
  return tastes?.get(recipeId) ?? NEUTRAL;
}

/** Семья блюдо не любит — в рацион и подборку «Всё есть» не предлагаем */
export function isDisliked(t: RecipeTaste): boolean {
  return t.average !== null && t.average < 2;
}

export function isFavorite(t: RecipeTaste): boolean {
  return t.average !== null && t.average >= 4;
}
