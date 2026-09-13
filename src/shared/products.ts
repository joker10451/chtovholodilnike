// Справочник продуктов: названия, нормы хранения и типовые упаковки.
// Используется и в приложении, и на сервере (в подсказке для нейросети).

export type Category =
  | 'vegetables' | 'greens' | 'fruits' | 'dairy' | 'eggs' | 'meat' | 'poultry' | 'fish'
  | 'grains' | 'bakery' | 'canned' | 'sauces' | 'frozen' | 'sweets' | 'drinks' | 'spices'
  | 'nuts' | 'ready' | 'other';

export type Location = 'fridge' | 'freezer' | 'pantry';
export type BaseUnit = 'g' | 'ml' | 'pcs';

export const CATEGORIES: Category[] = [
  'vegetables', 'greens', 'fruits', 'dairy', 'eggs', 'meat', 'poultry', 'fish', 'grains', 'bakery',
  'canned', 'sauces', 'frozen', 'sweets', 'drinks', 'spices', 'nuts', 'ready', 'other',
];

export const CATEGORY_LABELS: Record<Category, string> = {
  vegetables: 'Овощи', greens: 'Зелень', fruits: 'Фрукты', dairy: 'Молочное', eggs: 'Яйца',
  meat: 'Мясо', poultry: 'Птица', fish: 'Рыба', grains: 'Крупы и макароны', bakery: 'Хлеб',
  canned: 'Консервы', sauces: 'Соусы', frozen: 'Заморозка', sweets: 'Сладкое', drinks: 'Напитки',
  spices: 'Специи', nuts: 'Орехи', ready: 'Готовая еда', other: 'Другое',
};

export const LOCATIONS: Location[] = ['fridge', 'freezer', 'pantry'];
export const LOCATION_LABELS: Record<Location, string> = {
  fridge: 'Холодильник', freezer: 'Морозилка', pantry: 'Шкаф',
};

export interface ShelfLife { fridge?: number; freezer?: number; pantry?: number }

export interface Product {
  key: string;
  name: string;
  aliases: string[];
  category: Category;
  unit: BaseUnit;
  /** Вес одной штуки в граммах (для перевода шт ↔ г) */
  each?: number;
  /** Где обычно хранится */
  location: Location;
  /** Срок хранения в днях по месту хранения */
  life: ShelfLife;
  /** Сколько дней хранится после вскрытия упаковки */
  opened?: number;
  /** Может быть «базовым запасом» (соль, масло…) */
  staple?: boolean;
  /** Жидкость в таре: остаток удобно задавать шкалой */
  liquid?: boolean;
  /** Типовая упаковка в базовых единицах */
  pack?: number;
}

/** Срок по категории, если продукта нет в справочнике */
export const CATEGORY_LIFE: Record<Category, ShelfLife> = {
  vegetables: { fridge: 7, pantry: 5, freezer: 240 },
  greens: { fridge: 5, freezer: 180 },
  fruits: { fridge: 10, pantry: 5, freezer: 240 },
  dairy: { fridge: 7, freezer: 60 },
  eggs: { fridge: 25 },
  meat: { fridge: 3, freezer: 180 },
  poultry: { fridge: 2, freezer: 180 },
  fish: { fridge: 2, freezer: 120 },
  grains: { pantry: 365 },
  bakery: { pantry: 4, freezer: 90, fridge: 7 },
  canned: { pantry: 730, fridge: 3 },
  sauces: { pantry: 180, fridge: 30 },
  frozen: { freezer: 180, fridge: 2 },
  sweets: { pantry: 180 },
  drinks: { pantry: 180, fridge: 5 },
  spices: { pantry: 730 },
  nuts: { pantry: 180 },
  ready: { fridge: 3, freezer: 60 },
  other: { fridge: 7, pantry: 90, freezer: 90 },
};

type Extra = Partial<Pick<Product, 'each' | 'opened' | 'staple' | 'liquid' | 'pack'>> & { aliases?: string[] };

function p(
  key: string, name: string, category: Category, unit: BaseUnit, location: Location,
  life: ShelfLife, extra: Extra = {},
): Product {
  const { aliases = [], ...rest } = extra;
  return { key, name, category, unit, location, life, aliases, ...rest };
}

export const PRODUCTS: Product[] = [
  // Овощи
  p('potato', 'Картофель', 'vegetables', 'g', 'pantry', { pantry: 30, fridge: 45 }, { each: 120, aliases: ['картошка', 'картофелина'] }),
  p('onion', 'Лук репчатый', 'vegetables', 'pcs', 'pantry', { pantry: 30, fridge: 45 }, { each: 100, aliases: ['лук', 'луковица', 'красный лук'] }),
  p('carrot', 'Морковь', 'vegetables', 'pcs', 'fridge', { fridge: 21, pantry: 7 }, { each: 100, aliases: ['морковка'] }),
  p('garlic', 'Чеснок', 'vegetables', 'pcs', 'pantry', { pantry: 60, fridge: 60 }, { each: 5, aliases: ['зубчик чеснока', 'головка чеснока'] }),
  p('tomato', 'Помидоры', 'vegetables', 'pcs', 'fridge', { fridge: 7, pantry: 4 }, { each: 120, aliases: ['помидор', 'томаты', 'томат', 'черри'] }),
  p('cucumber', 'Огурцы', 'vegetables', 'pcs', 'fridge', { fridge: 7 }, { each: 110, aliases: ['огурец'] }),
  p('zucchini', 'Кабачок', 'vegetables', 'pcs', 'fridge', { fridge: 10 }, { each: 300, aliases: ['кабачки', 'цукини'] }),
  p('bell_pepper', 'Перец болгарский', 'vegetables', 'pcs', 'fridge', { fridge: 10 }, { each: 150, aliases: ['сладкий перец', 'перец'] }),
  p('cabbage', 'Капуста белокочанная', 'vegetables', 'g', 'fridge', { fridge: 30 }, { each: 1500, aliases: ['капуста'] }),
  p('broccoli', 'Брокколи', 'vegetables', 'g', 'fridge', { fridge: 5, freezer: 240 }, { each: 400 }),
  p('cauliflower', 'Цветная капуста', 'vegetables', 'g', 'fridge', { fridge: 7, freezer: 240 }, { each: 600 }),
  p('eggplant', 'Баклажан', 'vegetables', 'pcs', 'fridge', { fridge: 7 }, { each: 250, aliases: ['баклажаны'] }),
  p('beet', 'Свёкла', 'vegetables', 'pcs', 'fridge', { fridge: 30 }, { each: 200, aliases: ['свекла', 'свёкла варёная'] }),
  p('pumpkin', 'Тыква', 'vegetables', 'g', 'pantry', { pantry: 60, fridge: 10 }, { each: 1500, opened: 5 }),
  p('mushrooms', 'Шампиньоны', 'vegetables', 'g', 'fridge', { fridge: 5, freezer: 180 }, { aliases: ['грибы'], pack: 300 }),
  p('avocado', 'Авокадо', 'fruits', 'pcs', 'pantry', { pantry: 4, fridge: 7 }, { each: 200 }),
  // Зелень
  p('green_onion', 'Зелёный лук', 'greens', 'g', 'fridge', { fridge: 5 }, { each: 50, aliases: ['зеленый лук', 'лук-порей', 'порей'] }),
  p('dill', 'Укроп', 'greens', 'g', 'fridge', { fridge: 5, freezer: 180 }, { pack: 30 }),
  p('parsley', 'Петрушка', 'greens', 'g', 'fridge', { fridge: 5, freezer: 180 }, { pack: 30 }),
  p('cilantro', 'Кинза', 'greens', 'g', 'fridge', { fridge: 5 }, { pack: 30 }),
  p('lettuce', 'Салат листовой', 'greens', 'g', 'fridge', { fridge: 5 }, { each: 150, aliases: ['салат', 'айсберг', 'романо', 'руккола'] }),
  p('spinach', 'Шпинат', 'greens', 'g', 'fridge', { fridge: 4, freezer: 240 }, { pack: 125 }),
  // Фрукты
  p('lemon', 'Лимон', 'fruits', 'pcs', 'fridge', { fridge: 21, pantry: 7 }, { each: 120, aliases: ['лимоны'] }),
  p('apple', 'Яблоки', 'fruits', 'pcs', 'fridge', { fridge: 30, pantry: 10 }, { each: 180, aliases: ['яблоко'] }),
  p('banana', 'Бананы', 'fruits', 'pcs', 'pantry', { pantry: 5 }, { each: 150, aliases: ['банан'] }),
  p('orange', 'Апельсины', 'fruits', 'pcs', 'fridge', { fridge: 21, pantry: 10 }, { each: 200, aliases: ['апельсин', 'мандарины'] }),
  // Молочное
  p('milk', 'Молоко', 'dairy', 'ml', 'fridge', { fridge: 7 }, { opened: 3, liquid: true, pack: 930 }),
  p('kefir', 'Кефир', 'dairy', 'ml', 'fridge', { fridge: 10 }, { opened: 3, liquid: true, pack: 900, aliases: ['ряженка', 'айран'] }),
  p('sour_cream', 'Сметана', 'dairy', 'g', 'fridge', { fridge: 14 }, { opened: 4, pack: 300 }),
  p('cottage_cheese', 'Творог', 'dairy', 'g', 'fridge', { fridge: 7, freezer: 60 }, { opened: 3, pack: 200 }),
  p('yogurt', 'Йогурт натуральный', 'dairy', 'g', 'fridge', { fridge: 14 }, { opened: 4, pack: 400, aliases: ['йогурт', 'греческий йогурт'] }),
  p('butter', 'Сливочное масло', 'dairy', 'g', 'fridge', { fridge: 30, freezer: 180 }, { opened: 14, pack: 180, aliases: ['масло сливочное'] }),
  p('cheese', 'Сыр твёрдый', 'dairy', 'g', 'fridge', { fridge: 30 }, { opened: 14, pack: 200, aliases: ['сыр', 'российский сыр', 'гауда', 'пармезан', 'чеддер'] }),
  p('mozzarella', 'Моцарелла', 'dairy', 'g', 'fridge', { fridge: 14 }, { opened: 3, pack: 125 }),
  p('feta', 'Брынза', 'dairy', 'g', 'fridge', { fridge: 21 }, { opened: 5, pack: 200, aliases: ['фета', 'сулугуни'] }),
  p('cream', 'Сливки', 'dairy', 'ml', 'fridge', { fridge: 14 }, { opened: 3, liquid: true, pack: 200 }),
  p('cream_cheese', 'Сливочный сыр', 'dairy', 'g', 'fridge', { fridge: 30 }, { opened: 7, pack: 180, aliases: ['творожный сыр', 'филадельфия'] }),
  // Яйца
  p('egg', 'Яйца', 'eggs', 'pcs', 'fridge', { fridge: 25 }, { each: 55, pack: 10, aliases: ['яйцо', 'яйца куриные'] }),
  // Мясо и птица
  p('chicken_breast', 'Куриное филе', 'poultry', 'g', 'fridge', { fridge: 2, freezer: 180 }, { aliases: ['куриная грудка', 'грудка'] }),
  p('chicken_thigh', 'Куриные бёдра', 'poultry', 'g', 'fridge', { fridge: 2, freezer: 180 }, { aliases: ['куриное бедро', 'бедро', 'окорочка', 'голени'] }),
  p('chicken_whole', 'Курица целая', 'poultry', 'g', 'fridge', { fridge: 2, freezer: 180 }, { aliases: ['курица', 'цыплёнок'] }),
  p('minced_chicken', 'Куриный фарш', 'poultry', 'g', 'fridge', { fridge: 1, freezer: 90 }, { aliases: ['фарш из курицы', 'фарш индейки'] }),
  p('minced_meat', 'Фарш мясной', 'meat', 'g', 'fridge', { fridge: 1, freezer: 90 }, { aliases: ['фарш', 'говяжий фарш', 'свиной фарш'] }),
  p('pork', 'Свинина', 'meat', 'g', 'fridge', { fridge: 3, freezer: 180 }, { aliases: ['свиная лопатка', 'свиная шея', 'карбонад'] }),
  p('beef', 'Говядина', 'meat', 'g', 'fridge', { fridge: 3, freezer: 180 }, { aliases: ['телятина'] }),
  p('sausages', 'Сосиски', 'meat', 'g', 'fridge', { fridge: 10, freezer: 60 }, { opened: 3, pack: 400, aliases: ['сардельки'] }),
  p('ham', 'Ветчина', 'meat', 'g', 'fridge', { fridge: 10 }, { opened: 4, aliases: ['буженина'] }),
  p('bacon', 'Бекон', 'meat', 'g', 'fridge', { fridge: 14, freezer: 60 }, { opened: 5 }),
  p('salami', 'Колбаса', 'meat', 'g', 'fridge', { fridge: 30 }, { opened: 10, aliases: ['сервелат', 'салями', 'докторская'] }),
  // Рыба
  p('white_fish', 'Белая рыба', 'fish', 'g', 'fridge', { fridge: 2, freezer: 180 }, { aliases: ['треска', 'минтай', 'хек', 'филе трески'] }),
  p('salmon', 'Лосось', 'fish', 'g', 'fridge', { fridge: 2, freezer: 90 }, { aliases: ['сёмга', 'семга', 'форель', 'горбуша'] }),
  p('shrimp', 'Креветки', 'fish', 'g', 'freezer', { freezer: 180, fridge: 2 }),
  // Крупы, макароны, мука
  p('rice', 'Рис', 'grains', 'g', 'pantry', { pantry: 540 }, { pack: 900, staple: true }),
  p('buckwheat', 'Гречка', 'grains', 'g', 'pantry', { pantry: 540 }, { pack: 900, staple: true, aliases: ['гречневая крупа'] }),
  p('oats', 'Овсяные хлопья', 'grains', 'g', 'pantry', { pantry: 365 }, { pack: 400, aliases: ['овсянка', 'геркулес'] }),
  p('pasta', 'Макароны', 'grains', 'g', 'pantry', { pantry: 730 }, { pack: 450, staple: true, aliases: ['паста', 'спагетти', 'пенне', 'рожки'] }),
  p('bulgur', 'Булгур', 'grains', 'g', 'pantry', { pantry: 365 }, { pack: 500 }),
  p('lentils', 'Чечевица', 'grains', 'g', 'pantry', { pantry: 540 }, { pack: 450 }),
  p('flour', 'Мука', 'grains', 'g', 'pantry', { pantry: 365 }, { pack: 1000, staple: true }),
  p('dumplings', 'Пельмени', 'frozen', 'g', 'freezer', { freezer: 180 }, { pack: 800, aliases: ['вареники'] }),
  // Хлеб
  p('bread', 'Хлеб', 'bakery', 'g', 'pantry', { pantry: 4, freezer: 90 }, { aliases: ['батон', 'багет', 'тостовый хлеб'] }),
  p('lavash', 'Лаваш', 'bakery', 'g', 'pantry', { pantry: 5, fridge: 10 }, { pack: 240, aliases: ['тортилья'] }),
  // Консервы и соусы
  p('tuna_canned', 'Тунец консервированный', 'canned', 'g', 'pantry', { pantry: 730 }, { opened: 2, each: 185, aliases: ['тунец'] }),
  p('chickpeas_canned', 'Нут консервированный', 'canned', 'g', 'pantry', { pantry: 730 }, { opened: 3, each: 400, aliases: ['нут'] }),
  p('beans_canned', 'Фасоль консервированная', 'canned', 'g', 'pantry', { pantry: 730 }, { opened: 3, each: 400, aliases: ['фасоль'] }),
  p('corn_canned', 'Кукуруза консервированная', 'canned', 'g', 'pantry', { pantry: 730 }, { opened: 3, each: 340, aliases: ['кукуруза'] }),
  p('peas_canned', 'Горошек консервированный', 'canned', 'g', 'pantry', { pantry: 730 }, { opened: 3, each: 400, aliases: ['зелёный горошек', 'горошек'] }),
  p('tomatoes_canned', 'Томаты в собственном соку', 'canned', 'g', 'pantry', { pantry: 730 }, { opened: 3, each: 400, aliases: ['консервированные томаты', 'томаты в с/с', 'пассата'] }),
  p('tomato_paste', 'Томатная паста', 'sauces', 'g', 'pantry', { pantry: 540 }, { opened: 14, pack: 70 }),
  p('mayonnaise', 'Майонез', 'sauces', 'g', 'fridge', { fridge: 90, pantry: 90 }, { opened: 30, pack: 400 }),
  p('ketchup', 'Кетчуп', 'sauces', 'g', 'fridge', { fridge: 180, pantry: 180 }, { opened: 30, pack: 350 }),
  p('mustard', 'Горчица', 'sauces', 'g', 'fridge', { fridge: 180 }, { opened: 60 }),
  p('soy_sauce', 'Соевый соус', 'sauces', 'ml', 'pantry', { pantry: 730 }, { opened: 180, staple: true }),
  // Заморозка
  p('frozen_vegetables', 'Овощная смесь замороженная', 'frozen', 'g', 'freezer', { freezer: 240 }, { pack: 400, aliases: ['замороженные овощи', 'мексиканская смесь'] }),
  p('frozen_peas', 'Горошек замороженный', 'frozen', 'g', 'freezer', { freezer: 240 }, { pack: 400 }),
  p('frozen_berries', 'Ягоды замороженные', 'frozen', 'g', 'freezer', { freezer: 240 }, { pack: 300, aliases: ['ягоды', 'клубника', 'черника', 'малина'] }),
  // Сладкое, орехи, напитки
  p('honey', 'Мёд', 'sweets', 'g', 'pantry', { pantry: 730 }, { aliases: ['мед'] }),
  p('chocolate', 'Шоколад', 'sweets', 'g', 'pantry', { pantry: 180 }, { pack: 90 }),
  p('walnuts', 'Грецкие орехи', 'nuts', 'g', 'pantry', { pantry: 180 }, { aliases: ['орехи'] }),
  p('juice', 'Сок', 'drinks', 'ml', 'pantry', { pantry: 180 }, { opened: 3, liquid: true, pack: 1000 }),
  // Базовые запасы
  p('salt', 'Соль', 'spices', 'g', 'pantry', { pantry: 3650 }, { staple: true }),
  p('sugar', 'Сахар', 'spices', 'g', 'pantry', { pantry: 3650 }, { staple: true }),
  p('black_pepper', 'Чёрный перец', 'spices', 'g', 'pantry', { pantry: 730 }, { staple: true, aliases: ['перец молотый', 'черный перец'] }),
  p('vegetable_oil', 'Растительное масло', 'other', 'ml', 'pantry', { pantry: 365 }, { staple: true, aliases: ['подсолнечное масло', 'масло'] }),
  p('olive_oil', 'Оливковое масло', 'other', 'ml', 'pantry', { pantry: 365 }, { staple: true }),
  p('vinegar', 'Уксус', 'other', 'ml', 'pantry', { pantry: 730 }, { staple: true }),
  p('bay_leaf', 'Лавровый лист', 'spices', 'g', 'pantry', { pantry: 730 }, { staple: true }),
  p('paprika', 'Паприка молотая', 'spices', 'g', 'pantry', { pantry: 730 }, { staple: true, aliases: ['паприка'] }),
  p('spices', 'Специи', 'spices', 'g', 'pantry', { pantry: 730 }, { staple: true, aliases: ['приправа', 'прованские травы', 'зира', 'куркума', 'приправа для плова'] }),
  p('baking_powder', 'Разрыхлитель', 'spices', 'g', 'pantry', { pantry: 730 }, { staple: true, aliases: ['сода'] }),
];

export const DEFAULT_STAPLES = [
  'salt', 'sugar', 'black_pepper', 'vegetable_oil', 'flour', 'bay_leaf', 'spices', 'vinegar', 'baking_powder',
];

export const PRODUCT_BY_KEY: ReadonlyMap<string, Product> = new Map(PRODUCTS.map((x) => [x.key, x]));

export function getProduct(key: string | null | undefined): Product | undefined {
  return key ? PRODUCT_BY_KEY.get(key) : undefined;
}

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const ENDINGS = /(ами|ями|ого|его|ому|ему|ыми|ими|ов|ев|ей|ий|ый|ой|ая|яя|ое|ее|ые|ие|ам|ям|ах|ях|ом|ем|а|я|ы|и|у|ю|е|о|ь)$/;

/** Грубая основа слова: «помидора» → «помидор», «яиц» → «яйц» */
function stem(word: string): string {
  const w = word.replace(/иц$/, 'йц');
  const s = w.replace(ENDINGS, '');
  return s.length >= 3 ? s : w;
}

/** Находит продукт справочника по свободному названию («Молоко Простоквашино 3,2%» → milk) */
export function guessProductKey(name: string): string | null {
  const n = normalizeName(name);
  if (!n) return null;
  const nStems = new Set(n.split(' ').map(stem));
  let best: { key: string; score: number } | null = null;
  for (const prod of PRODUCTS) {
    for (const variant of [prod.name, ...prod.aliases]) {
      const v = normalizeName(variant);
      let score = 0;
      if (n === v) score = 100;
      else if (` ${n} `.includes(` ${v} `)) score = 50 + v.length;
      else if (v.split(' ').every((word) => nStems.has(stem(word)))) score = 40 + v.length;
      if (score > 0 && (!best || score > best.score)) best = { key: prod.key, score };
    }
  }
  return best?.key ?? null;
}
