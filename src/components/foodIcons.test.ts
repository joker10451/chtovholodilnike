import { describe, expect, it } from 'vitest';
import { dishKind } from './foodIcons';
import { BASE_RECIPES } from '../shared/recipes';

describe('сопоставление значков блюд (dishKind)', () => {
  it('ни одно базовое блюдо не остаётся со значком по умолчанию (dish)', () => {
    for (const r of BASE_RECIPES) {
      const kind = dishKind(r);
      expect(kind, `Блюдо "${r.title}" получило значок по умолчанию`).not.toBe('dish');
    }
  });

  it('типовые блюда получают правильные значки', () => {
    const byId = new Map(BASE_RECIPES.map((r) => [r.id, r]));

    expect(dishKind(byId.get('solyanka-meat')!)).toBe('soup');
    expect(dishKind(byId.get('kharcho')!)).toBe('soup');
    expect(dishKind(byId.get('shchi-fresh-cabbage')!)).toBe('soup');
    expect(dishKind(byId.get('lazy-khachapuri-pan')!)).toBe('pancakes');
    expect(dishKind(byId.get('beef-stroganoff')!)).toBe('pot');
    expect(dishKind(byId.get('potato-draniki')!)).toBe('fried');
    expect(dishKind(byId.get('broccoli-quiche-pastry')!)).toBe('baked');
    expect(dishKind(byId.get('apple-charlotte')!)).toBe('baked');
    expect(dishKind(byId.get('mussels-creamy-garlic')!)).toBe('fish');
    expect(dishKind(byId.get('menemen-eggs')!)).toBe('eggs');
    expect(dishKind(byId.get('sprat-sandwiches')!)).toBe('toast');
    expect(dishKind(byId.get('baked-mackerel-onion')!)).toBe('fish');
  });
});
