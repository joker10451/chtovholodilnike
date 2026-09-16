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
  spices: 'Специи', nuts: 'Орехи и сухофрукты', ready: 'Готовая еда', other: 'Другое',
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
  p('onion', 'Лук репчатый', 'vegetables', 'pcs', 'pantry', { pantry: 30, fridge: 45 }, { each: 100, aliases: ['лук', 'луковица'] }),
  p('carrot', 'Морковь', 'vegetables', 'pcs', 'fridge', { fridge: 21, pantry: 7 }, { each: 100, aliases: ['морковка'] }),
  p('garlic', 'Чеснок', 'vegetables', 'pcs', 'pantry', { pantry: 60, fridge: 60 }, { each: 5, aliases: ['зубчик чеснока', 'головка чеснока'] }),
  p('tomato', 'Помидоры', 'vegetables', 'pcs', 'fridge', { fridge: 7, pantry: 4 }, { each: 120, aliases: ['помидор', 'томаты', 'томат'] }),
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
  p('green_onion', 'Зелёный лук', 'greens', 'g', 'fridge', { fridge: 5 }, { each: 50, aliases: ['зеленый лук', 'перья лука'] }),
  p('dill', 'Укроп', 'greens', 'g', 'fridge', { fridge: 5, freezer: 180 }, { pack: 30 }),
  p('parsley', 'Петрушка', 'greens', 'g', 'fridge', { fridge: 5, freezer: 180 }, { pack: 30 }),
  p('cilantro', 'Кинза', 'greens', 'g', 'fridge', { fridge: 5 }, { pack: 30 }),
  p('mint', 'Мята', 'greens', 'g', 'fridge', { fridge: 10 }, { pack: 30, aliases: ['свежая мята', 'мята перечная'] }),
  p('lettuce', 'Салат листовой', 'greens', 'g', 'fridge', { fridge: 5 }, { each: 150, aliases: ['салат', 'айсберг', 'романо', 'латук'] }),
  p('spinach', 'Шпинат', 'greens', 'g', 'fridge', { fridge: 4, freezer: 240 }, { pack: 125 }),
  // Фрукты
  p('lemon', 'Лимон', 'fruits', 'pcs', 'fridge', { fridge: 21, pantry: 7 }, { each: 120, aliases: ['лимоны'] }),
  p('apple', 'Яблоки', 'fruits', 'pcs', 'fridge', { fridge: 30, pantry: 10 }, { each: 180, aliases: ['яблоко'] }),
  p('banana', 'Бананы', 'fruits', 'pcs', 'pantry', { pantry: 5 }, { each: 150, aliases: ['банан'] }),
  p('orange', 'Апельсины', 'fruits', 'pcs', 'fridge', { fridge: 21, pantry: 10 }, { each: 200, aliases: ['апельсин'] }),
  // Молочное
  p('milk', 'Молоко', 'dairy', 'ml', 'fridge', { fridge: 7 }, { opened: 3, liquid: true, pack: 930 }),
  p('kefir', 'Кефир', 'dairy', 'ml', 'fridge', { fridge: 10 }, { opened: 3, liquid: true, pack: 900, aliases: ['кефир 1%', 'кефир 3,2%'] }),
  p('sour_cream', 'Сметана', 'dairy', 'g', 'fridge', { fridge: 14 }, { opened: 4, pack: 300 }),
  p('cottage_cheese', 'Творог', 'dairy', 'g', 'fridge', { fridge: 7, freezer: 60 }, { opened: 3, pack: 200 }),
  p('yogurt', 'Йогурт натуральный', 'dairy', 'g', 'fridge', { fridge: 14 }, { opened: 4, pack: 400, aliases: ['йогурт', 'греческий йогурт'] }),
  p('butter', 'Сливочное масло', 'dairy', 'g', 'fridge', { fridge: 30, freezer: 180 }, { opened: 14, pack: 180, aliases: ['масло сливочное'] }),
  p('cheese', 'Сыр твёрдый', 'dairy', 'g', 'fridge', { fridge: 30 }, { opened: 14, pack: 200, aliases: ['сыр', 'российский сыр', 'гауда', 'чеддер', 'маасдам'] }),
  p('mozzarella', 'Моцарелла', 'dairy', 'g', 'fridge', { fridge: 14 }, { opened: 3, pack: 125 }),
  p('feta', 'Брынза', 'dairy', 'g', 'fridge', { fridge: 21 }, { opened: 5, pack: 200, aliases: ['фета'] }),
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
  p('dumplings', 'Пельмени', 'frozen', 'g', 'freezer', { freezer: 180 }, { pack: 800, aliases: ['пельмени замороженные'] }),
  // Хлеб
  p('bread', 'Хлеб', 'bakery', 'g', 'pantry', { pantry: 4, freezer: 90 }, { aliases: ['хлеб белый', 'хлеб пшеничный', 'хлеб нарезной'] }),
  p('lavash', 'Лаваш', 'bakery', 'g', 'pantry', { pantry: 5, fridge: 10 }, { pack: 240, aliases: ['лаваш тонкий', 'армянский лаваш'] }),
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
  p('frozen_berries', 'Ягоды замороженные', 'frozen', 'g', 'freezer', { freezer: 240 }, { pack: 300, aliases: ['ягоды замороженные', 'ягодная смесь', 'вишня замороженная'] }),
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
  p('baking_powder', 'Разрыхлитель', 'spices', 'g', 'pantry', { pantry: 730 }, { staple: true, aliases: ['разрыхлитель теста'] }),

  // ——— Расширенный справочник ———
  // Овощи
  p('red_onion', 'Лук красный', 'vegetables', 'pcs', 'pantry', { pantry: 30, fridge: 45 }, { each: 120, aliases: ['красный лук', 'ялтинский лук'] }),
  p('leek', 'Лук-порей', 'vegetables', 'pcs', 'fridge', { fridge: 14 }, { each: 250, aliases: ['порей'] }),
  p('radish', 'Редис', 'vegetables', 'g', 'fridge', { fridge: 10 }, { pack: 250, aliases: ['редиска'] }),
  p('daikon', 'Дайкон', 'vegetables', 'g', 'fridge', { fridge: 21 }, { each: 500, aliases: ['редька', 'редька белая'] }),
  p('celery', 'Сельдерей черешковый', 'vegetables', 'g', 'fridge', { fridge: 14 }, { each: 400, aliases: ['сельдерей', 'стебли сельдерея'] }),
  p('celery_root', 'Корень сельдерея', 'vegetables', 'g', 'fridge', { fridge: 30 }, { each: 500, opened: 5, aliases: ['сельдерей корневой'] }),
  p('sweet_potato', 'Батат', 'vegetables', 'g', 'pantry', { pantry: 21, fridge: 21 }, { each: 300, aliases: ['сладкий картофель'] }),
  p('cherry_tomato', 'Помидоры черри', 'vegetables', 'g', 'fridge', { fridge: 7, pantry: 4 }, { pack: 250, aliases: ['черри', 'томаты черри'] }),
  p('chinese_cabbage', 'Пекинская капуста', 'vegetables', 'g', 'fridge', { fridge: 14 }, { each: 800, aliases: ['китайская капуста'] }),
  p('red_cabbage', 'Краснокочанная капуста', 'vegetables', 'g', 'fridge', { fridge: 30 }, { each: 1200, aliases: ['красная капуста'] }),
  p('brussels_sprouts', 'Брюссельская капуста', 'vegetables', 'g', 'freezer', { freezer: 240, fridge: 5 }, { pack: 400 }),
  p('green_beans', 'Стручковая фасоль', 'vegetables', 'g', 'freezer', { freezer: 240, fridge: 4 }, { pack: 400, aliases: ['фасоль стручковая', 'зелёная фасоль'] }),
  p('corn_cob', 'Кукуруза в початках', 'vegetables', 'pcs', 'fridge', { fridge: 3, freezer: 240 }, { each: 300, aliases: ['початок кукурузы'] }),
  p('chili', 'Перец чили', 'vegetables', 'pcs', 'fridge', { fridge: 14 }, { each: 15, aliases: ['острый перец', 'халапеньо'] }),
  p('ginger', 'Имбирь', 'vegetables', 'g', 'fridge', { fridge: 21, freezer: 180 }, { each: 100, aliases: ['корень имбиря'] }),
  p('asparagus', 'Спаржа', 'vegetables', 'g', 'fridge', { fridge: 4, freezer: 240 }, { pack: 250 }),
  p('oyster_mushrooms', 'Вешенки', 'vegetables', 'g', 'fridge', { fridge: 4, freezer: 180 }, { pack: 300 }),
  p('forest_mushrooms', 'Грибы лесные замороженные', 'frozen', 'g', 'freezer', { freezer: 240 }, { pack: 400, aliases: ['опята', 'белые грибы', 'лисички', 'подосиновики'] }),
  p('pickles', 'Огурцы солёные', 'canned', 'g', 'pantry', { pantry: 365, fridge: 60 }, { opened: 30, pack: 680, aliases: ['огурцы маринованные', 'корнишоны', 'солёные огурцы'] }),
  p('sauerkraut', 'Квашеная капуста', 'canned', 'g', 'fridge', { fridge: 60 }, { opened: 14, pack: 500, aliases: ['капуста квашеная', 'капуста провансаль'] }),
  p('olives', 'Оливки', 'canned', 'g', 'pantry', { pantry: 730 }, { opened: 14, pack: 300, aliases: ['маслины'] }),
  p('pickled_mushrooms', 'Грибы маринованные', 'canned', 'g', 'pantry', { pantry: 730 }, { opened: 7, pack: 580, aliases: ['опята маринованные', 'шампиньоны маринованные'] }),
  p('squash_caviar', 'Кабачковая икра', 'canned', 'g', 'pantry', { pantry: 730 }, { opened: 5, pack: 500, aliases: ['икра кабачковая', 'икра баклажанная'] }),
  // Зелень
  p('basil', 'Базилик', 'greens', 'g', 'fridge', { fridge: 5 }, { pack: 30 }),
  p('arugula', 'Руккола', 'greens', 'g', 'fridge', { fridge: 4 }, { pack: 100, aliases: ['рукола'] }),
  p('sorrel', 'Щавель', 'greens', 'g', 'fridge', { fridge: 5, freezer: 180 }, { pack: 100 }),
  p('rosemary', 'Розмарин', 'greens', 'g', 'fridge', { fridge: 10 }, { pack: 20, aliases: ['тимьян', 'чабрец'] }),
  // Фрукты и ягоды
  p('pear', 'Груши', 'fruits', 'pcs', 'fridge', { fridge: 14, pantry: 5 }, { each: 180, aliases: ['груша'] }),
  p('tangerine', 'Мандарины', 'fruits', 'pcs', 'fridge', { fridge: 21, pantry: 10 }, { each: 80, aliases: ['мандарин', 'клементины'] }),
  p('grapefruit', 'Грейпфрут', 'fruits', 'pcs', 'fridge', { fridge: 21, pantry: 10 }, { each: 350 }),
  p('lime', 'Лайм', 'fruits', 'pcs', 'fridge', { fridge: 14 }, { each: 70 }),
  p('grapes', 'Виноград', 'fruits', 'g', 'fridge', { fridge: 7 }, { pack: 500 }),
  p('kiwi', 'Киви', 'fruits', 'pcs', 'fridge', { fridge: 21, pantry: 5 }, { each: 80 }),
  p('pomegranate', 'Гранат', 'fruits', 'pcs', 'fridge', { fridge: 30 }, { each: 350 }),
  p('persimmon', 'Хурма', 'fruits', 'pcs', 'fridge', { fridge: 10, pantry: 5 }, { each: 200 }),
  p('peach', 'Персики', 'fruits', 'pcs', 'fridge', { fridge: 5, pantry: 3 }, { each: 150, aliases: ['персик', 'нектарины', 'нектарин'] }),
  p('apricot', 'Абрикосы', 'fruits', 'g', 'fridge', { fridge: 5, pantry: 2 }, { pack: 500, aliases: ['абрикос'] }),
  p('plum', 'Сливы', 'fruits', 'g', 'fridge', { fridge: 7, pantry: 3 }, { pack: 500, aliases: ['слива'] }),
  p('strawberry', 'Клубника', 'fruits', 'g', 'fridge', { fridge: 3, freezer: 240 }, { pack: 500, aliases: ['земляника'] }),
  p('raspberry', 'Малина', 'fruits', 'g', 'fridge', { fridge: 2, freezer: 240 }, { pack: 125 }),
  p('blueberry', 'Черника', 'fruits', 'g', 'fridge', { fridge: 5, freezer: 240 }, { pack: 125, aliases: ['голубика'] }),
  p('cherry', 'Вишня', 'fruits', 'g', 'fridge', { fridge: 4, freezer: 240 }, { pack: 500, aliases: ['черешня'] }),
  p('watermelon', 'Арбуз', 'fruits', 'g', 'pantry', { pantry: 14, fridge: 14 }, { each: 7000, opened: 2 }),
  p('melon', 'Дыня', 'fruits', 'g', 'pantry', { pantry: 10, fridge: 10 }, { each: 2000, opened: 2 }),
  p('pineapple', 'Ананас', 'fruits', 'pcs', 'pantry', { pantry: 4, fridge: 7 }, { each: 1500, opened: 3 }),
  p('mango', 'Манго', 'fruits', 'pcs', 'pantry', { pantry: 5, fridge: 7 }, { each: 350 }),
  // Молочное
  p('ryazhenka', 'Ряженка', 'dairy', 'ml', 'fridge', { fridge: 10 }, { opened: 3, liquid: true, pack: 500, aliases: ['варенец', 'снежок'] }),
  p('ayran', 'Айран', 'dairy', 'ml', 'fridge', { fridge: 14 }, { opened: 3, liquid: true, pack: 500, aliases: ['тан'] }),
  p('drinking_yogurt', 'Йогурт питьевой', 'dairy', 'ml', 'fridge', { fridge: 21 }, { opened: 2, liquid: true, pack: 270, aliases: ['актимель', 'бифидок', 'питьевой йогурт'] }),
  p('fruit_yogurt', 'Йогурт фруктовый', 'dairy', 'g', 'fridge', { fridge: 21 }, { opened: 2, each: 125, aliases: ['йогурт с наполнителем', 'десерт творожный'] }),
  p('curd_snack', 'Сырок глазированный', 'dairy', 'pcs', 'fridge', { fridge: 14 }, { each: 40, aliases: ['творожный сырок', 'сырок'] }),
  p('grain_cottage', 'Зернёный творог', 'dairy', 'g', 'fridge', { fridge: 10 }, { opened: 3, pack: 350, aliases: ['творог зернёный', 'зерненый творог', 'деревенский творог'] }),
  p('parmesan', 'Пармезан', 'dairy', 'g', 'fridge', { fridge: 60 }, { opened: 21, pack: 200, aliases: ['пармезан тёртый', 'грана падано'] }),
  p('suluguni', 'Сулугуни', 'dairy', 'g', 'fridge', { fridge: 30 }, { opened: 5, pack: 300, aliases: ['чечил'] }),
  p('adyghe_cheese', 'Адыгейский сыр', 'dairy', 'g', 'fridge', { fridge: 21 }, { opened: 4, pack: 300, aliases: ['адыгейский'] }),
  p('processed_cheese', 'Плавленый сыр', 'dairy', 'g', 'fridge', { fridge: 60 }, { opened: 5, pack: 100, aliases: ['сыр плавленый', 'дружба', 'хохланд'] }),
  p('mascarpone', 'Маскарпоне', 'dairy', 'g', 'fridge', { fridge: 30 }, { opened: 4, pack: 250, aliases: ['рикотта'] }),
  p('ghee', 'Масло топлёное', 'dairy', 'g', 'pantry', { pantry: 270, fridge: 270 }, { opened: 60, pack: 350, aliases: ['топлёное масло', 'гхи'] }),
  p('plant_milk', 'Растительное молоко', 'drinks', 'ml', 'pantry', { pantry: 270 }, { opened: 5, liquid: true, pack: 1000, aliases: ['овсяное молоко', 'миндальное молоко', 'соевое молоко', 'кокосовый напиток'] }),
  p('quail_egg', 'Яйца перепелиные', 'eggs', 'pcs', 'fridge', { fridge: 45 }, { each: 12, pack: 20, aliases: ['перепелиные яйца'] }),
  // Мясо
  p('pork_ribs', 'Свиные рёбра', 'meat', 'g', 'fridge', { fridge: 3, freezer: 180 }, { aliases: ['рёбрышки', 'ребра свиные'] }),
  p('lamb', 'Баранина', 'meat', 'g', 'fridge', { fridge: 3, freezer: 180 }, { aliases: ['ягнятина', 'бараньи рёбра'] }),
  p('beef_liver', 'Печень говяжья', 'meat', 'g', 'fridge', { fridge: 1, freezer: 90 }, { aliases: ['говяжья печень', 'печень свиная'] }),
  p('salo', 'Сало', 'meat', 'g', 'fridge', { fridge: 30, freezer: 180 }, { aliases: ['шпик', 'грудинка копчёная'] }),
  p('smoked_sausage', 'Колбаса копчёная', 'meat', 'g', 'fridge', { fridge: 30 }, { opened: 14, aliases: ['сырокопчёная колбаса', 'охотничьи колбаски'] }),
  p('stew_canned', 'Тушёнка', 'canned', 'g', 'pantry', { pantry: 1095 }, { opened: 2, each: 325, aliases: ['говядина тушёная', 'свинина тушёная'] }),
  p('frozen_cutlets', 'Котлеты замороженные', 'frozen', 'g', 'freezer', { freezer: 120 }, { pack: 500, aliases: ['котлеты полуфабрикат', 'наггетсы', 'фрикадельки замороженные'] }),
  // Птица
  p('chicken_liver', 'Печень куриная', 'poultry', 'g', 'fridge', { fridge: 1, freezer: 90 }, { pack: 500, aliases: ['куриная печень'] }),
  p('chicken_hearts', 'Сердечки куриные', 'poultry', 'g', 'fridge', { fridge: 1, freezer: 90 }, { pack: 500, aliases: ['куриные сердечки', 'желудки куриные'] }),
  p('chicken_wings', 'Крылья куриные', 'poultry', 'g', 'fridge', { fridge: 2, freezer: 180 }, { aliases: ['куриные крылья', 'крылышки'] }),
  p('turkey', 'Индейка', 'poultry', 'g', 'fridge', { fridge: 2, freezer: 180 }, { aliases: ['филе индейки', 'бедро индейки', 'грудка индейки'] }),
  // Рыба и морепродукты
  p('mackerel', 'Скумбрия', 'fish', 'g', 'fridge', { fridge: 2, freezer: 120 }, { aliases: ['скумбрия копчёная'] }),
  p('herring', 'Сельдь', 'fish', 'g', 'fridge', { fridge: 10 }, { opened: 3, pack: 250, aliases: ['селёдка', 'сельдь слабосолёная', 'сельдь в масле'] }),
  p('salted_salmon', 'Сёмга слабосолёная', 'fish', 'g', 'fridge', { fridge: 10 }, { opened: 3, pack: 150, aliases: ['форель слабосолёная', 'красная рыба слабосолёная'] }),
  p('squid', 'Кальмары', 'fish', 'g', 'freezer', { freezer: 180, fridge: 2 }, { pack: 500, aliases: ['кальмар', 'тушки кальмара'] }),
  p('mussels', 'Мидии', 'fish', 'g', 'freezer', { freezer: 180, fridge: 2 }, { pack: 500, aliases: ['морской коктейль'] }),
  p('crab_sticks', 'Крабовые палочки', 'fish', 'g', 'fridge', { fridge: 10, freezer: 90 }, { opened: 2, pack: 200, aliases: ['крабовое мясо'] }),
  p('red_caviar', 'Икра красная', 'fish', 'g', 'fridge', { fridge: 60 }, { opened: 3, pack: 100, aliases: ['красная икра', 'икра лососёвая'] }),
  p('sprats', 'Шпроты', 'canned', 'g', 'pantry', { pantry: 730 }, { opened: 2, each: 160, aliases: ['шпроты в масле'] }),
  p('saury_canned', 'Сайра консервированная', 'canned', 'g', 'pantry', { pantry: 730 }, { opened: 2, each: 250, aliases: ['сайра', 'горбуша консервированная', 'рыбные консервы'] }),
  p('cod_liver', 'Печень трески', 'canned', 'g', 'pantry', { pantry: 730 }, { opened: 1, each: 230 }),
  p('fish_sticks', 'Рыбные палочки', 'frozen', 'g', 'freezer', { freezer: 180 }, { pack: 300 }),
  // Крупы, бобовые, макароны
  p('millet', 'Пшено', 'grains', 'g', 'pantry', { pantry: 270 }, { pack: 800, aliases: ['пшённая крупа'] }),
  p('pearl_barley', 'Перловка', 'grains', 'g', 'pantry', { pantry: 540 }, { pack: 800, aliases: ['перловая крупа', 'ячневая крупа'] }),
  p('semolina', 'Манка', 'grains', 'g', 'pantry', { pantry: 365 }, { pack: 700, aliases: ['манная крупа'] }),
  p('corn_grits', 'Кукурузная крупа', 'grains', 'g', 'pantry', { pantry: 365 }, { pack: 700, aliases: ['полента'] }),
  p('couscous', 'Кускус', 'grains', 'g', 'pantry', { pantry: 365 }, { pack: 500 }),
  p('quinoa', 'Киноа', 'grains', 'g', 'pantry', { pantry: 540 }, { pack: 350 }),
  p('split_peas', 'Горох колотый', 'grains', 'g', 'pantry', { pantry: 540 }, { pack: 800, aliases: ['горох', 'горох сухой'] }),
  p('dry_beans', 'Фасоль сухая', 'grains', 'g', 'pantry', { pantry: 540 }, { pack: 450, aliases: ['фасоль красная сухая', 'фасоль белая'] }),
  p('dry_chickpeas', 'Нут сухой', 'grains', 'g', 'pantry', { pantry: 540 }, { pack: 450 }),
  p('noodles', 'Лапша', 'grains', 'g', 'pantry', { pantry: 540 }, { pack: 300, aliases: ['лапша яичная', 'удон', 'рисовая лапша', 'гречневая лапша', 'соба'] }),
  p('vermicelli', 'Вермишель', 'grains', 'g', 'pantry', { pantry: 730 }, { pack: 450, aliases: ['паутинка'] }),
  p('lasagna_sheets', 'Листы для лазаньи', 'grains', 'g', 'pantry', { pantry: 730 }, { pack: 500 }),
  p('breadcrumbs', 'Панировочные сухари', 'grains', 'g', 'pantry', { pantry: 180 }, { pack: 250, aliases: ['сухари панировочные', 'панко'] }),
  p('muesli', 'Мюсли', 'grains', 'g', 'pantry', { pantry: 180 }, { opened: 60, pack: 400, aliases: ['гранола', 'хлопья для завтрака', 'кукурузные хлопья'] }),
  // Хлеб и тесто
  p('loaf', 'Батон', 'bakery', 'g', 'pantry', { pantry: 3, freezer: 90 }, { pack: 400, aliases: ['багет', 'нарезной батон'] }),
  p('rye_bread', 'Хлеб ржаной', 'bakery', 'g', 'pantry', { pantry: 5, freezer: 90 }, { pack: 400, aliases: ['бородинский хлеб', 'чёрный хлеб', 'дарницкий'] }),
  p('toast_bread', 'Хлеб тостовый', 'bakery', 'g', 'pantry', { pantry: 7, freezer: 90 }, { pack: 500, aliases: ['тостовый хлеб', 'хлеб для тостов'] }),
  p('tortilla', 'Тортильи', 'bakery', 'g', 'pantry', { pantry: 30 }, { opened: 5, pack: 250, aliases: ['тортилья', 'пита', 'лепёшки'] }),
  p('buns', 'Булочки', 'bakery', 'pcs', 'pantry', { pantry: 3, freezer: 60 }, { each: 60, aliases: ['булка', 'булочки для бургеров'] }),
  p('crispbread', 'Хлебцы', 'bakery', 'g', 'pantry', { pantry: 180 }, { pack: 100, aliases: ['хлебцы хрустящие', 'сухари'] }),
  p('puff_pastry', 'Тесто слоёное', 'frozen', 'g', 'freezer', { freezer: 180, fridge: 3 }, { pack: 500, aliases: ['слоёное тесто'] }),
  p('yeast_dough', 'Тесто дрожжевое', 'frozen', 'g', 'freezer', { freezer: 90, fridge: 2 }, { pack: 500, aliases: ['тесто для пиццы', 'дрожжевое тесто'] }),
  // Консервы и соусы
  p('coconut_milk', 'Кокосовое молоко', 'canned', 'ml', 'pantry', { pantry: 540 }, { opened: 3, each: 400, aliases: ['кокосовые сливки'] }),
  p('canned_pineapple', 'Ананасы консервированные', 'canned', 'g', 'pantry', { pantry: 730 }, { opened: 3, each: 580, aliases: ['персики консервированные'] }),
  p('pesto', 'Песто', 'sauces', 'g', 'fridge', { fridge: 180 }, { opened: 7, pack: 190, aliases: ['соус песто'] }),
  p('adjika', 'Аджика', 'sauces', 'g', 'fridge', { fridge: 180 }, { opened: 30, pack: 200, aliases: ['хрен', 'хреновина', 'ткемали'] }),
  p('pasta_sauce', 'Соус томатный', 'sauces', 'g', 'pantry', { pantry: 540 }, { opened: 5, pack: 400, aliases: ['соус для пасты', 'томатный соус', 'краснодарский соус'] }),
  p('teriyaki', 'Соус терияки', 'sauces', 'ml', 'pantry', { pantry: 540 }, { opened: 90, pack: 250, aliases: ['терияки', 'устричный соус', 'соус барбекю', 'сладкий соус чили'] }),
  p('hot_sauce', 'Острый соус', 'sauces', 'ml', 'pantry', { pantry: 730 }, { opened: 180, pack: 150, aliases: ['табаско', 'шрирача', 'соус чили'] }),
  p('tahini', 'Тахини', 'sauces', 'g', 'pantry', { pantry: 365 }, { opened: 90, pack: 300, aliases: ['кунжутная паста'] }),
  p('hummus', 'Хумус', 'ready', 'g', 'fridge', { fridge: 14 }, { opened: 3, pack: 200 }),
  p('balsamic', 'Бальзамический уксус', 'other', 'ml', 'pantry', { pantry: 1095 }, { pack: 250, aliases: ['бальзамик', 'яблочный уксус', 'рисовый уксус'] }),
  p('sesame_oil', 'Кунжутное масло', 'other', 'ml', 'pantry', { pantry: 365 }, { opened: 180, pack: 250, aliases: ['льняное масло', 'масло для салата'] }),
  // Заморозка
  p('vareniki', 'Вареники', 'frozen', 'g', 'freezer', { freezer: 180 }, { pack: 900, aliases: ['вареники с картошкой', 'вареники с творогом', 'манты', 'хинкали'] }),
  p('frozen_blini', 'Блинчики с начинкой', 'frozen', 'g', 'freezer', { freezer: 180 }, { pack: 360, aliases: ['блинчики замороженные', 'сырники замороженные'] }),
  p('french_fries', 'Картофель фри', 'frozen', 'g', 'freezer', { freezer: 365 }, { pack: 750, aliases: ['картофель по-деревенски', 'картофельные дольки'] }),
  p('frozen_broccoli', 'Брокколи замороженная', 'frozen', 'g', 'freezer', { freezer: 240 }, { pack: 400, aliases: ['цветная капуста замороженная', 'шпинат замороженный'] }),
  p('frozen_pizza', 'Пицца замороженная', 'frozen', 'pcs', 'freezer', { freezer: 180 }, { each: 400 }),
  p('ice_cream', 'Мороженое', 'sweets', 'g', 'freezer', { freezer: 180 }, { pack: 450, aliases: ['пломбир', 'эскимо'] }),
  // Сладкое
  p('cookies', 'Печенье', 'sweets', 'g', 'pantry', { pantry: 180 }, { opened: 30, pack: 300, aliases: ['вафли', 'пряники', 'крекеры', 'сушки'] }),
  p('jam', 'Варенье', 'sweets', 'g', 'pantry', { pantry: 730, fridge: 730 }, { opened: 60, pack: 350, aliases: ['джем', 'конфитюр', 'повидло'] }),
  p('condensed_milk', 'Сгущёнка', 'sweets', 'g', 'pantry', { pantry: 540 }, { opened: 10, each: 380, aliases: ['сгущенное молоко', 'варёная сгущёнка'] }),
  p('cocoa', 'Какао-порошок', 'sweets', 'g', 'pantry', { pantry: 540 }, { pack: 100, aliases: ['какао', 'несквик'] }),
  p('candies', 'Конфеты', 'sweets', 'g', 'pantry', { pantry: 180 }, { pack: 250, aliases: ['мармелад', 'ирис', 'батончик'] }),
  p('marshmallow', 'Зефир', 'sweets', 'g', 'pantry', { pantry: 60 }, { opened: 14, pack: 250, aliases: ['пастила', 'маршмеллоу'] }),
  p('halva', 'Халва', 'sweets', 'g', 'pantry', { pantry: 180 }, { opened: 30, pack: 250, aliases: ['козинак'] }),
  p('choco_spread', 'Шоколадная паста', 'sweets', 'g', 'pantry', { pantry: 365 }, { opened: 60, pack: 350, aliases: ['нутелла', 'арахисовая паста'] }),
  p('cake', 'Торт', 'ready', 'g', 'fridge', { fridge: 3, freezer: 60 }, { aliases: ['пирожные', 'чизкейк', 'рулет бисквитный'] }),
  // Напитки
  p('tea', 'Чай', 'drinks', 'g', 'pantry', { pantry: 730 }, { pack: 100, aliases: ['чай пакетированный', 'чай зелёный', 'чай чёрный'] }),
  p('coffee', 'Кофе', 'drinks', 'g', 'pantry', { pantry: 365 }, { opened: 60, pack: 250, aliases: ['кофе молотый', 'кофе в зёрнах', 'растворимый кофе'] }),
  p('kvass', 'Квас', 'drinks', 'ml', 'fridge', { fridge: 30 }, { opened: 2, liquid: true, pack: 1500 }),
  p('mors', 'Морс', 'drinks', 'ml', 'fridge', { fridge: 30 }, { opened: 3, liquid: true, pack: 1000, aliases: ['компот', 'лимонад', 'газировка'] }),
  p('cooking_wine', 'Вино сухое', 'drinks', 'ml', 'pantry', { pantry: 730 }, { opened: 5, liquid: true, pack: 750, aliases: ['белое вино', 'красное вино'] }),
  // Специи и для выпечки
  p('cinnamon', 'Корица', 'spices', 'g', 'pantry', { pantry: 730 }, { staple: true, aliases: ['корица молотая'] }),
  p('soda', 'Сода', 'spices', 'g', 'pantry', { pantry: 1095 }, { staple: true, aliases: ['пищевая сода', 'сода пищевая'] }),
  p('starch', 'Крахмал', 'spices', 'g', 'pantry', { pantry: 730 }, { staple: true, aliases: ['крахмал картофельный', 'кукурузный крахмал'] }),
  p('vanilla_sugar', 'Ванильный сахар', 'spices', 'g', 'pantry', { pantry: 730 }, { aliases: ['ванилин'] }),
  p('powdered_sugar', 'Сахарная пудра', 'spices', 'g', 'pantry', { pantry: 730 }, { pack: 250 }),
  p('yeast', 'Дрожжи сухие', 'spices', 'g', 'pantry', { pantry: 365 }, { pack: 11, aliases: ['дрожжи', 'дрожжи прессованные'] }),
  p('gelatin', 'Желатин', 'spices', 'g', 'pantry', { pantry: 730 }, { pack: 10, aliases: ['агар-агар'] }),
  p('red_pepper', 'Перец красный молотый', 'spices', 'g', 'pantry', { pantry: 730 }, { aliases: ['хлопья чили', 'кайенский перец'] }),
  p('bouillon', 'Бульонные кубики', 'spices', 'g', 'pantry', { pantry: 730 }, { aliases: ['бульонный кубик', 'магги'] }),
  // Орехи, семечки, сухофрукты
  p('almonds', 'Миндаль', 'nuts', 'g', 'pantry', { pantry: 270 }, { pack: 150 }),
  p('hazelnuts', 'Фундук', 'nuts', 'g', 'pantry', { pantry: 270 }, { pack: 150, aliases: ['лесной орех'] }),
  p('cashews', 'Кешью', 'nuts', 'g', 'pantry', { pantry: 270 }, { pack: 150, aliases: ['фисташки', 'кедровые орехи'] }),
  p('peanuts', 'Арахис', 'nuts', 'g', 'pantry', { pantry: 270 }, { pack: 200, aliases: ['земляной орех'] }),
  p('seeds', 'Семечки', 'nuts', 'g', 'pantry', { pantry: 270 }, { pack: 200, aliases: ['семена подсолнечника', 'тыквенные семечки', 'семена льна', 'семена чиа'] }),
  p('sesame', 'Кунжут', 'nuts', 'g', 'pantry', { pantry: 365 }, { pack: 100 }),
  p('raisins', 'Изюм', 'nuts', 'g', 'pantry', { pantry: 365 }, { pack: 200 }),
  p('prunes', 'Чернослив', 'nuts', 'g', 'pantry', { pantry: 365 }, { pack: 200, aliases: ['финики', 'инжир сушёный'] }),
  p('dried_apricots', 'Курага', 'nuts', 'g', 'pantry', { pantry: 365 }, { pack: 200 }),
  // Готовая еда
  p('roast_chicken', 'Курица-гриль', 'ready', 'g', 'fridge', { fridge: 2 }, { each: 1000, aliases: ['курица гриль', 'цыплёнок табака'] }),
  p('ready_salad', 'Салат готовый', 'ready', 'g', 'fridge', { fridge: 1 }, { pack: 250, aliases: ['оливье', 'селёдка под шубой', 'салат из кулинарии'] }),
  p('ready_soup', 'Суп', 'ready', 'ml', 'fridge', { fridge: 3, freezer: 90 }, { aliases: ['суп готовый', 'бульон', 'щи', 'борщ готовый'] }),
  p('pirozhki', 'Пирожки', 'ready', 'pcs', 'fridge', { fridge: 3, pantry: 1, freezer: 60 }, { each: 80, aliases: ['пирог', 'беляши', 'чебуреки', 'самса'] }),
  p('sushi', 'Роллы', 'ready', 'g', 'fridge', { fridge: 1 }, { aliases: ['суши'] }),
  p('blini', 'Блины', 'ready', 'pcs', 'fridge', { fridge: 3, freezer: 60 }, { each: 50, aliases: ['блинчики', 'оладьи'] }),
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
