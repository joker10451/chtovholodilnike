import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { estimateExpiry, freshness } from '../shared/freshness';
import { emptyProduct, fromPackage, mergeProduct, packageExpiry, parseOffProduct } from './barcode';
import { isValidGtin, normalizeCode } from './scanner';

const TODAY = '2026-09-13';
const GS = String.fromCharCode(29);

describe('штрихкоды', () => {
  it('проверяет контрольную цифру EAN', () => {
    expect(isValidGtin('4607004891694')).toBe(true);
    expect(isValidGtin('4607004891695')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true);
    expect(isValidGtin('12345')).toBe(false);
  });

  it('достаёт EAN-13 из кода «Честного знака»', () => {
    expect(normalizeCode(`0104607004891694215!aB3cD${GS}93dGVz`, 'data_matrix')).toBe('4607004891694');
    expect(normalizeCode('4607004891694', 'ean_13')).toBe('4607004891694');
    expect(normalizeCode('4607004891695', 'ean_13')).toBeNull();
  });
});

describe('сведения о товаре', () => {
  it('разбирает Open Food Facts и отделяет бренд', () => {
    const p = parseOffProduct('4607004891694', {
      product_name_ru: 'Молоко Простоквашино 3,2%', brands: 'Простоквашино,Danone', quantity: '930 мл',
      categories_tags: ['en:dairies', 'en:milks'],
      nutriments: { 'energy-kcal_100g': 58.4, proteins_100g: 3, fat_100g: 3.2, carbohydrates_100g: 4.7 },
    })!;
    expect(p.name).toBe('Молоко 3,2%');
    expect(p.brand).toBe('Простоквашино');
    expect(p.productKey).toBe('milk');
    expect([p.qty, p.unit, p.location]).toEqual([930, 'ml', 'fridge']);
    expect(p.nutriments).toEqual({ kcal: 58, proteins: 3, fat: 3.2, carbs: 4.7 });
    expect(p.fatPercent).toBe(3.2);
  });

  it('без названия товар считается ненайденным', () => {
    expect(parseOffProduct('123', { brands: 'X' })).toBeNull();
  });

  it('считает срок по дате изготовления и дополняет карточку данными с фото', () => {
    const photo = fromPackage({
      found: true, name: 'Творог 5%', brand: 'Савушкин', product_key: 'cottage_cheese', category: 'dairy', qty: 180, unit: 'g',
      fat_percent: 5, kcal: 121, proteins: 17, fat: 5, carbs: 1.8, expires_at: null, manufactured_at: '2026-09-10',
      shelf_life_days: 14, after_opening_days: 3, storage: 'при +2…+6 °C', location: 'fridge', barcode: null,
      composition: null, confidence: 0.9,
    }, '4810268031234');
    expect(packageExpiry(photo)).toBe('2026-09-24');

    const merged = mergeProduct({ ...emptyProduct('4810268031234'), name: 'Творог', source: 'memory' }, photo);
    expect(merged.name).toBe('Творог');
    expect(merged.qty).toBe(180);
    expect(merged.storage).toBe('при +2…+6 °C');
    expect(merged.nutriments?.kcal).toBe(121);
    expect(merged.source).toBe('memory');
  });

  it('просроченная дата «годен до» остаётся просроченной', () => {
    const r = estimateExpiry({ productKey: 'kefir', category: 'dairy', location: 'fridge', purchasedAt: TODAY, openedAt: null, packageDate: '2026-09-10' });
    expect(r).toEqual({ expiresAt: '2026-09-10', isEstimate: false });
    expect(freshness(r.expiresAt, TODAY)).toBe('expired');
  });
});
