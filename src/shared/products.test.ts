import { describe, expect, it } from 'vitest';
import { guessProductKey, normalizeName, PRODUCTS } from './products';

describe('справочник продуктов', () => {
  it('у разных продуктов нет общих названий — иначе строка из чека попадёт не туда', () => {
    const owners = new Map<string, string>();
    const clashes: string[] = [];
    for (const p of PRODUCTS) {
      for (const v of new Set([p.name, ...p.aliases].map(normalizeName))) {
        const other = owners.get(v);
        if (other && other !== p.key) clashes.push(`${v}: ${other}/${p.key}`);
        owners.set(v, p.key);
      }
    }
    expect(clashes).toEqual([]);
    expect(new Set(PRODUCTS.map((p) => p.key)).size).toBe(PRODUCTS.length);
  });

  it('узнаёт типичные строки из чеков', () => {
    const samples: Record<string, string> = {
      'Молоко Простоквашино 3,2% 930мл': 'milk', 'Ряженка Домик в деревне 4%': 'ryazhenka', 'Батон нарезной Хлебный дом': 'loaf',
      'Хлеб Бородинский': 'rye_bread', 'Мандарины Марокко': 'tangerine', 'Сыр Пармезан 40%': 'parmesan', 'Сулугуни Умалат': 'suluguni',
      'Вареники с картофелем': 'vareniki', 'Пельмени Сибирская коллекция': 'dumplings', 'Помидоры черри': 'cherry_tomato',
      'Огурцы': 'cucumber', 'Огурцы маринованные Дядя Ваня': 'pickles', 'Печень куриная охл': 'chicken_liver', 'Филе грудки индейки': 'turkey',
      'Сельдь слабосолёная филе': 'herring', 'Крабовые палочки Vici': 'crab_sticks', 'Гречка ядрица': 'buckwheat', 'Пшено шлифованное': 'millet',
      'Сода пищевая': 'soda', 'Сгущенное молоко Рогачев': 'condensed_milk', 'Сырок глазированный Б.Ю.Александров': 'curd_snack',
      'Капуста квашеная': 'sauerkraut', 'Капуста белокочанная': 'cabbage', 'Лук красный': 'red_onion', 'Лук репчатый': 'onion',
      'Перец болгарский красный': 'bell_pepper', 'Перец чили': 'chili', 'Яйцо куриное С1 10шт': 'egg', 'Творог 5% Савушкин': 'cottage_cheese',
      'Творог зерненый': 'grain_cottage', 'Фарш говяжий': 'minced_meat', 'Масло сливочное 82,5%': 'butter', 'Масло подсолнечное': 'vegetable_oil',
      'Кефир 2,5%': 'kefir', 'Сметана 20%': 'sour_cream', 'Колбаса докторская': 'salami', 'Сосиски молочные': 'sausages',
      'Тушенка говяжья': 'stew_canned', 'Квас Очаковский': 'kvass', 'Чай Greenfield': 'tea',
    };
    const wrong = Object.entries(samples).filter(([name, key]) => guessProductKey(name) !== key).map(([name]) => `${name} → ${guessProductKey(name)}`);
    expect(wrong).toEqual([]);
  });
});
