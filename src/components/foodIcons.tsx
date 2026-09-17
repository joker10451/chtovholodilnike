// Значки продуктов и блюд: линейные, в стиле остальных иконок приложения.
import type { ReactNode } from 'react';
import { getProduct, type Category } from '../shared/products';
import type { Recipe } from '../shared/recipeTypes';

const stroke = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

// ——— Продукты (24×24) ———

type ProductGlyph =
  | 'carrot' | 'leaf' | 'apple' | 'carton' | 'egg' | 'steak' | 'drumstick' | 'fish' | 'wheat' | 'bread' | 'can'
  | 'bottle' | 'snowflake' | 'chocolate' | 'glass' | 'shaker' | 'nut' | 'box' | 'jar' | 'cheese' | 'butter' | 'cup'
  | 'tomato' | 'potato' | 'onion' | 'cucumber' | 'mushroom' | 'broccoli' | 'pepper' | 'citrus' | 'banana'
  | 'sausage' | 'shrimp' | 'dumpling' | 'flour' | 'honey' | 'pasta' | 'cabbage' | 'garlic' | 'pumpkin' | 'avocado';

const PRODUCT_GLYPHS: Record<ProductGlyph, ReactNode> = {
  carrot: <><path d="M16 8c2 2 2 4.6.2 6.4L5.4 20.6c-.8.5-1.6-.3-1.1-1.1L10.1 8C11.9 6 14 6 16 8z" /><path d="M16 8l3.2-3.2M17.3 9.6l3.6-.9M14.6 6.3l.9-3.6M9.3 12.8l1.6 1.6M7.3 16.3l1.4 1.4" /></>,
  leaf: <><path d="M5 19C5 11 10 5 19 5c0 9-6 14-14 14z" /><path d="M5 19l8.5-8.5M10 14h3.5M13.5 10.5V14" /></>,
  apple: <><path d="M12 8c-1.6-1.2-3.8-1.4-5.3 0-2.4 2.2-2 6.4.6 9.8 1.3 1.8 2.9 2.6 4.7 1.8 1.8.8 3.4 0 4.7-1.8 2.6-3.4 3-7.6.6-9.8C15.8 6.6 13.6 6.8 12 8z" /><path d="M12 8c0-2 .7-3.6 2.3-4.6" /><path d="M12.8 5.6c1.4-.5 2.9-.2 3.8.8-1.3.7-2.8.6-3.8-.8z" /></>,
  carton: <><path d="M8 9.5 10 5h4l2 4.5V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" /><path d="M8 9.5h8M10 5V3.5h4V5M8 14h8" /></>,
  egg: <path d="M12 3.5c3.3 0 6 5.2 6 9.5a6 6 0 0 1-12 0c0-4.3 2.7-9.5 6-9.5z" />,
  steak: <><path d="M4.5 12.5C4.5 8 8.5 5 13.5 5S20 7.8 20 11.2c0 2.6-2 3.6-3.6 5.2-1.5 1.5-2 4-5.5 4s-6.4-3.4-6.4-7.9z" /><circle cx="11.5" cy="11.5" r="2.2" /></>,
  drumstick: <><ellipse cx="14.8" cy="9.2" rx="5.6" ry="4.4" transform="rotate(-45 14.8 9.2)" /><path d="M11 13 7.4 16.6" /><circle cx="5.8" cy="17" r="1.5" /><circle cx="7" cy="18.2" r="1.5" /></>,
  fish: <><path d="M3.5 12c2.4-3.3 5.5-5 9-5 3 0 5.2 2 6.3 5-1.1 3-3.3 5-6.3 5-3.5 0-6.6-1.7-9-5z" /><path d="M18.8 12 21.5 8.5v7z" /><circle cx="8" cy="11" r=".6" fill="currentColor" /></>,
  wheat: <><path d="M12 21V7" /><path d="M12 8c-2-.8-2.8-2.6-2.4-4.5 2 .6 2.7 2.4 2.4 4.5zM12 8c2-.8 2.8-2.6 2.4-4.5-2 .6-2.7 2.4-2.4 4.5zM12 12.5c-2-.8-2.8-2.6-2.4-4.5 2 .6 2.7 2.4 2.4 4.5zM12 12.5c2-.8 2.8-2.6 2.4-4.5-2 .6-2.7 2.4-2.4 4.5zM12 17c-2-.8-2.8-2.6-2.4-4.5 2 .6 2.7 2.4 2.4 4.5zM12 17c2-.8 2.8-2.6 2.4-4.5-2 .6-2.7 2.4-2.4 4.5z" /></>,
  bread: <><path d="M4 11a4 4 0 0 1 3-3.9C8.5 5.6 10 5 12 5s3.5.6 5 2.1a4 4 0 0 1 3 3.9v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M9 9.5 7.8 11.5M12.8 9.5l-1.2 2M16.6 9.5l-1.2 2" /></>,
  can: <><ellipse cx="12" cy="6" rx="6" ry="2" /><path d="M6 6v12c0 1.1 2.7 2 6 2s6-.9 6-2V6" /><path d="M6 10.5c0 1.1 2.7 2 6 2s6-.9 6-2" /></>,
  bottle: <><path d="M10 3h4M10.5 3v4L8 10.5V20a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-9.5L13.5 7V3" /><path d="M8 14h8" /></>,
  snowflake: <><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" /><path d="M9.8 4.8 12 7l2.2-2.2M9.8 19.2 12 17l2.2 2.2" /></>,
  chocolate: <><rect x="6" y="3.5" width="12" height="17" rx="1.5" /><path d="M6 9h12M6 14.5h12M12 3.5v17" /></>,
  glass: <><path d="M6.5 4h11l-1.5 16.1a1 1 0 0 1-1 .9H9a1 1 0 0 1-1-.9z" /><path d="M7.1 10h9.8" /></>,
  shaker: <><path d="M8.5 9.5h7l.9 10.6a1 1 0 0 1-1 1.1H8.6a1 1 0 0 1-1-1.1z" /><path d="M9 9.5V7a3 3 0 0 1 6 0v2.5" /><path d="M11 6.2h.01M13 6.2h.01" /></>,
  nut: <><path d="M12 4c4 0 7 3.2 7 7.6S16 20 12 20s-7-4-7-8.4S8 4 12 4z" /><path d="M12 4v16M8 9.2c1.2.6 2.3.6 4 0M12 13.8c1.7.6 2.8.6 4 0" /></>,
  box: <><rect x="4" y="10.5" width="16" height="9.5" rx="2" /><path d="M3 10.5h18M6 10.5V8a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 8v2.5" /></>,
  jar: <><rect x="6.5" y="3.5" width="11" height="3.5" rx="1" /><path d="M7 7h10v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" /><path d="M9.5 12.5h5" /></>,
  cheese: <><path d="M3.5 12.5 16 5.5l4.5 4v10h-17z" /><path d="M3.5 12.5h17" /><circle cx="8.5" cy="16" r="1.3" /><circle cx="15" cy="15.8" r="1" /></>,
  butter: <><path d="M3.5 11.5 8 8h12.5v7L16 18.5H3.5z" /><path d="M3.5 11.5H16v7M16 11.5 20.5 8" /></>,
  cup: <><rect x="4" y="5" width="16" height="3" rx="1" /><path d="M5.2 8h13.6l-1.4 11.4a1.5 1.5 0 0 1-1.5 1.3H8.1a1.5 1.5 0 0 1-1.5-1.3z" /><path d="M6 12.5h12" /></>,
  tomato: <><circle cx="12" cy="13.5" r="7" /><path d="M8.8 7.3 12 9l3.2-1.7M12 9V5" /></>,
  potato: <><path d="M6 8.5C8 5 14 4.5 17.5 7s3.5 8 .5 11-10 3-12.5-.5S4 11.5 6 8.5z" /><path d="M9.5 10h.01M14 12.5h.01M10.5 16h.01" /></>,
  onion: <><path d="M12 4.5c0 3 5.5 4.5 5.5 10a5.5 5.5 0 0 1-11 0C6.5 9 12 7.5 12 4.5z" /><path d="M12 4.5V2.5M12 9c-1.5 2-2.2 4-2.2 6.5M12 9c1.5 2 2.2 4 2.2 6.5M10.5 20l-.7 1.5M13.5 20l.7 1.5" /></>,
  cucumber: <><path d="M5.2 18.8c-1.8-1.8-1.6-4.8.5-6.9l6.2-6.2c2.1-2.1 5.1-2.3 6.9-.5s1.6 4.8-.5 6.9l-6.2 6.2c-2.1 2.1-5.1 2.3-6.9.5z" /><path d="M9 13.5h.01M12 10.5h.01M14.5 8h.01M11 16h.01M14 13h.01" /></>,
  mushroom: <><path d="M3.5 12a8.5 8.5 0 0 1 17 0z" /><path d="M9.5 12v6.5a2.5 2.5 0 0 0 5 0V12" /><path d="M9 8.5h.01M14.5 7.5h.01" /></>,
  broccoli: <><path d="M8 13a3 3 0 0 1 .3-6 3.7 3.7 0 0 1 7.4 0 3 3 0 0 1 .3 6z" /><path d="M10 13l-1 8h6l-1-8M12 13v4" /></>,
  pepper: <><path d="M8 8.5c-2.3.4-3.5 2.6-3.3 5.6.3 4 2.4 6.9 4.6 6.9.9 0 1.6-.5 2.7-.5s1.8.5 2.7.5c2.2 0 4.3-2.9 4.6-6.9.2-3-1-5.2-3.3-5.6-1.5-.3-2.6.6-4 .6s-2.5-.9-4-.6z" /><path d="M12 9V6.5c0-1.4.8-2.4 2.3-2.9M12 9c-.6 3.5-.6 7 0 11" /></>,
  citrus: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="5.2" /><path d="M12 6.8v10.4M6.8 12h10.4M8.3 8.3l7.4 7.4M15.7 8.3l-7.4 7.4" /></>,
  banana: <><path d="M4.5 12.5c4.5 3 11 2 13.5-4.6L19.4 5" /><path d="M4.5 12.5c1 5 9 8.2 14-1.4.7-1.3 1-2.8 1-4" /></>,
  sausage: <><path d="M5.5 17.5c-2-2-2-5 0-7l5-5c2-2 5-2 7 0s2 5 0 7l-5 5c-2 2-5 2-7 0z" /><path d="M4 20l1.5-2.5M20 4l-2.5 1.5M9.5 11l2.5-2.5" /></>,
  shrimp: <><path d="M17 5.5c-5.5-1-10.5 2.5-10.5 8 0 3.3 2.5 6 5.5 6 1.7 0 3-1.2 3-2.8 0-1.3-1-2.2-2.2-2.2" /><path d="M17 5.5c2.3 1.3 3.2 4 2.2 6.8-.7 2-2.4 3.3-4.3 3.7M12.8 14.3l-1.8 5.2M9.3 8.8l2.2 2M7.3 12.5l2.8.6M17 5.5l2.8-2" /></>,
  dumpling: <><path d="M3.5 14.5c0-4 3.8-7 8.5-7s8.5 3 8.5 7c-2 2.5-5 3.5-8.5 3.5s-6.5-1-8.5-3.5z" /><path d="M8 9.5l1 2M12 7.5V10M16 9.5l-1 2" /></>,
  flour: <><path d="M7 6.5h10l1 13.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" /><path d="M7 6.5 8.5 3h7L17 6.5M12 11v6M12 13.2l-1.6-1.6M12 13.2l1.6-1.6" /></>,
  honey: <><rect x="6.5" y="4" width="11" height="3" rx="1" /><path d="M7 7h10v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" /><path d="M7 11h10M10 11v2.5a1 1 0 0 0 2 0V11" /></>,
  pasta: <><path d="M3.5 7.5 11 12l-7.5 4.5c-.6-3-.6-6 0-9zM20.5 7.5 13 12l7.5 4.5c.6-3 .6-6 0-9z" /><circle cx="12" cy="12" r="1.8" /><path d="M6 10.5v3M18 10.5v3" /></>,
  avocado: <><path d="M12 3.5c2.6 0 3.6 3.2 5 6 1.3 2.5 2.5 4.2 2.5 6.5A7.5 7.5 0 0 1 12 21a7.5 7.5 0 0 1-7.5-5c0-2.3 1.2-4 2.5-6.5 1.4-2.8 2.4-6 5-6z" /><circle cx="12" cy="15" r="3" /></>,
  cabbage: <><circle cx="12" cy="12" r="8.5" /><path d="M12 20.5V12M12 16.5c-2.5-1-4.5-3.5-5-7M12 16.5c2.5-1 4.5-3.5 5-7M12 12c-1.3-1.4-2-3.3-2-5.5M12 12c1.3-1.4 2-3.3 2-5.5" /></>,
  pumpkin: <><path d="M12 7.5c-2.2-1.6-7.5-1.2-7.5 5.5S8.7 20.6 12 19.6c3.3 1 7.5-1 7.5-6.6S14.2 5.9 12 7.5z" /><path d="M12 7.5c-1.6 2.2-2.1 8.3 0 12.1M12 7.5c1.6 2.2 2.1 8.3 0 12.1M12 7.5V5l2-1.3" /></>,
  garlic: <><path d="M12 4c0 2.5 6.5 5 6.5 10a4.5 4.5 0 0 1-4.5 4.5h-4A4.5 4.5 0 0 1 5.5 14C5.5 9 12 6.5 12 4z" /><path d="M12 4V2.5M12 10c-1.2 2.5-1.5 5.5-.5 8.5M12 10c1.2 2.5 1.5 5.5.5 8.5" /></>,
};

const CATEGORY_GLYPH: Record<Category, ProductGlyph> = {
  vegetables: 'carrot', greens: 'leaf', fruits: 'apple', dairy: 'carton', eggs: 'egg', meat: 'steak', poultry: 'drumstick',
  fish: 'fish', grains: 'wheat', bakery: 'bread', canned: 'can', sauces: 'bottle', frozen: 'snowflake', sweets: 'chocolate',
  drinks: 'glass', spices: 'shaker', nuts: 'nut', ready: 'box', other: 'jar',
};

const PRODUCT_GLYPH: Record<string, ProductGlyph> = {
  cheese: 'cheese', mozzarella: 'cheese', feta: 'cheese', butter: 'butter',
  sour_cream: 'cup', yogurt: 'cup', cottage_cheese: 'cup', cream_cheese: 'cup',
  tomato: 'tomato', potato: 'potato', onion: 'onion', garlic: 'garlic', cucumber: 'cucumber', zucchini: 'cucumber', eggplant: 'cucumber',
  mushrooms: 'mushroom', broccoli: 'broccoli', cauliflower: 'broccoli', bell_pepper: 'pepper', cabbage: 'cabbage', pumpkin: 'pumpkin', beet: 'onion',
  lemon: 'citrus', orange: 'citrus', banana: 'banana', avocado: 'avocado',
  bay_leaf: 'leaf', tomato_paste: 'jar', mayonnaise: 'jar', vinegar: 'bottle',
  sausages: 'sausage', ham: 'sausage', salami: 'sausage', bacon: 'sausage',
  shrimp: 'shrimp', dumplings: 'dumpling', flour: 'flour', honey: 'honey', pasta: 'pasta',
  vegetable_oil: 'bottle', olive_oil: 'bottle', lavash: 'bread', tuna_canned: 'can',
  red_onion: 'onion', leek: 'onion', radish: 'tomato', daikon: 'potato', celery_root: 'potato', sweet_potato: 'potato', ginger: 'potato',
  cherry_tomato: 'tomato', chinese_cabbage: 'cabbage', red_cabbage: 'cabbage', brussels_sprouts: 'cabbage', green_beans: 'cucumber',
  chili: 'pepper', oyster_mushrooms: 'mushroom', forest_mushrooms: 'mushroom', pickled_mushrooms: 'mushroom', pickles: 'cucumber',
  sauerkraut: 'cabbage', squash_caviar: 'jar', pear: 'apple', grapes: 'apple', tangerine: 'citrus', grapefruit: 'citrus', lime: 'citrus',
  ryazhenka: 'carton', ayran: 'carton', drinking_yogurt: 'carton', plant_milk: 'carton', fruit_yogurt: 'cup', grain_cottage: 'cup',
  mascarpone: 'cup', curd_snack: 'chocolate', parmesan: 'cheese', suluguni: 'cheese', adyghe_cheese: 'cheese', processed_cheese: 'cheese',
  ghee: 'butter', quail_egg: 'egg', smoked_sausage: 'sausage', chicken_wings: 'drumstick', turkey: 'drumstick', roast_chicken: 'drumstick',
  squid: 'shrimp', mussels: 'shrimp', crab_sticks: 'sausage', red_caviar: 'jar', herring: 'fish', salted_salmon: 'fish', mackerel: 'fish',
  sprats: 'can', saury_canned: 'can', cod_liver: 'can', stew_canned: 'can', coconut_milk: 'can', canned_pineapple: 'can', olives: 'can',
  condensed_milk: 'can', fish_sticks: 'fish', noodles: 'pasta', vermicelli: 'pasta', lasagna_sheets: 'pasta',
  breadcrumbs: 'flour', starch: 'flour', powdered_sugar: 'flour', puff_pastry: 'flour', yeast_dough: 'flour',
  loaf: 'bread', rye_bread: 'bread', toast_bread: 'bread', buns: 'bread', crispbread: 'bread', tortilla: 'bread', pirozhki: 'bread',
  pesto: 'jar', adjika: 'jar', tahini: 'jar', hummus: 'jar', pasta_sauce: 'jar', cocoa: 'jar', tea: 'jar', coffee: 'jar', yeast: 'jar',
  vareniki: 'dumpling', frozen_blini: 'dumpling', blini: 'dumpling', french_fries: 'potato', frozen_broccoli: 'broccoli',
  jam: 'honey', choco_spread: 'honey', ready_soup: 'cup',
  kvass: 'bottle', mors: 'bottle', cooking_wine: 'bottle', balsamic: 'bottle', sesame_oil: 'bottle',
  pork_ribs: 'steak', lamb: 'steak', beef_liver: 'steak', salo: 'butter',
  chicken_liver: 'drumstick', chicken_hearts: 'drumstick',
  frozen_cutlets: 'steak', frozen_pizza: 'bread',
  ice_cream: 'cup', cookies: 'bread', cake: 'bread', candies: 'chocolate', marshmallow: 'chocolate', halva: 'chocolate',
  ketchup: 'bottle', mustard: 'bottle', teriyaki: 'bottle', hot_sauce: 'bottle', soy_sauce: 'bottle',
  ready_salad: 'leaf', sushi: 'fish',
  dry_beans: 'nut', dry_chickpeas: 'nut', split_peas: 'nut', sesame: 'nut', seeds: 'nut',
  asparagus: 'cucumber', celery: 'cucumber',
  strawberry: 'apple', raspberry: 'apple', cherry: 'apple', blueberry: 'apple',
  cinnamon: 'shaker', vanilla_sugar: 'shaker', soda: 'shaker', gelatin: 'shaker',
};

export const CATEGORY_COLOR: Record<string, string> = {
  vegetables: '#6E9E3F', greens: '#4F9446', fruits: '#E0922A', dairy: '#6F93B8', eggs: '#C9A46A', meat: '#C9604F',
  poultry: '#D98A6E', fish: '#5E93B5', grains: '#B8954F', bakery: '#B77F3E', canned: '#8E8068', sauces: '#C4522F',
  frozen: '#5AA9CE', sweets: '#9A6547', drinks: '#4E9F95', spices: '#A94D32', nuts: '#96723F', ready: '#B8692F', other: '#7E8D86',
};

function productGlyph(productKey: string | null | undefined, category: string): ProductGlyph {
  const byKey = productKey ? PRODUCT_GLYPH[productKey] : undefined;
  if (byKey && PRODUCT_GLYPHS[byKey]) return byKey;
  const cat = (getProduct(productKey)?.category ?? category) as Category;
  return CATEGORY_GLYPH[cat] ?? 'jar';
}

/** Плитка со значком продукта — в холодильнике, покупках и проверке чека */
export function ProductIcon({ productKey, category }: { productKey?: string | null; category: string }) {
  const color = CATEGORY_COLOR[getProduct(productKey)?.category ?? category] ?? CATEGORY_COLOR.other;
  return (
    <span className="dot" style={{ ['--c' as string]: color }}>
      <svg viewBox="0 0 24 24" strokeWidth={1.75} {...stroke}>{PRODUCT_GLYPHS[productGlyph(productKey, category)]}</svg>
    </span>
  );
}

// ——— Блюда (32×32) ———

export type DishKind =
  | 'soup' | 'salad' | 'pancakes' | 'eggs' | 'porridge' | 'pasta' | 'pot' | 'baked' | 'pizza'
  | 'fish' | 'chicken' | 'cutlets' | 'dumplings' | 'toast' | 'mash' | 'fried' | 'drink' | 'dish';

const bowl = <path d="M4.5 14.5h23c0 6-5.1 10.5-11.5 10.5S4.5 20.5 4.5 14.5zM12 25.5h8" />;
const plate = <ellipse cx="16" cy="21" rx="13" ry="5.5" />;

const DISH_GLYPHS: Record<DishKind, ReactNode> = {
  soup: <>{bowl}<path d="M11.5 11c-1-1.5 1-2.5 0-4.5M16 11c-1-1.5 1-2.5 0-4.5M20.5 11c-1-1.5 1-2.5 0-4.5" /></>,
  salad: <>{bowl}<path d="M8.5 14.5c0-3.2 2.2-5.4 5.4-5.4 0 3.2-2.2 5.4-5.4 5.4zM23.5 14.5c0-3.2-2.2-5.4-5.4-5.4 0 3.2 2.2 5.4 5.4 5.4z" /><circle cx="16" cy="11.8" r="2.3" /></>,
  porridge: <>{bowl}<path d="M19.5 14.5 24.5 6" /><ellipse cx="25.3" cy="4.6" rx="1.6" ry="2.4" transform="rotate(30 25.3 4.6)" /><circle cx="11" cy="12.3" r="1.3" /><circle cx="14.5" cy="11.6" r="1.3" /></>,
  pancakes: <><ellipse cx="16" cy="12.5" rx="11" ry="3.5" /><path d="M5 12.5v3.2c0 1.9 4.9 3.5 11 3.5s11-1.6 11-3.5v-3.2M5 15.7v3.2c0 1.9 4.9 3.5 11 3.5s11-1.6 11-3.5v-3.2M21 15.2v3.3" /><rect x="13.5" y="9.3" width="5" height="3" rx=".8" /></>,
  eggs: <><circle cx="13" cy="17" r="9" /><path d="M21.3 13.2 28.5 8" /><path d="M8.6 16c0-2.3 2-4 4.4-4s4.7 1.2 4.7 4-1.8 4.6-4.7 4.6-4.4-2.2-4.4-4.6z" /><circle cx="13" cy="16.2" r="1.9" /></>,
  pasta: <>{plate}<path d="M8 20.5c2-3 4 1 6-2s4 1 6-2 3 .5 4 0M9.5 23c2-3 4 1 6-2s4 1 6-2" /><path d="M24 3.5v9M22 3.5V8a2 2 0 0 0 4 0V3.5" /></>,
  pot: <><path d="M6 14h20v7.5a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5z" /><path d="M5 14h22M9 14a7 4 0 0 1 14 0M16 8.2V10M6 17H3.5M26 17h2.5" /></>,
  baked: <><path d="M4 15h24v5.5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M4 17H2M28 17h2M7 15c1.5-3 4-4.5 9-4.5s7.5 1.5 9 4.5M13 7.5c-.7-1 .7-2 0-3M19 7.5c-.7-1 .7-2 0-3" /></>,
  pizza: <><path d="M16 27.5 5 8c6.5-3.5 15.5-3.5 22 0z" /><path d="M6.6 10.8c6-3 12.8-3 18.8 0" /><circle cx="13" cy="13.5" r="1.7" /><circle cx="19.2" cy="14.3" r="1.7" /><circle cx="16" cy="19.5" r="1.7" /></>,
  fish: <><path d="M4.5 16c3-4.5 7-6.5 11-6.5 4 0 7 2.5 8.5 6.5-1.5 4-4.5 6.5-8.5 6.5-4 0-8-2-11-6.5z" /><path d="M24 16l4.5-4.5v9zM15 10l2-3M15 22l2 3" /><circle cx="9.5" cy="15" r="1" fill="currentColor" /></>,
  chicken: <><ellipse cx="19" cy="12.5" rx="7.5" ry="6" transform="rotate(-45 19 12.5)" /><path d="M13.7 17.8 9 22.5" /><circle cx="7" cy="23" r="2" /><circle cx="9" cy="25" r="2" /></>,
  cutlets: <>{plate}<ellipse cx="11.5" cy="18.5" rx="5" ry="3.3" /><ellipse cx="20.5" cy="19" rx="5" ry="3.3" /><path d="M16 10.5c0-2 1.3-3.5 3.3-3.8M16 10.5c-1-1.7-2.8-2.3-4.5-1.7" /></>,
  dumplings: <>{plate}<path d="M6.5 19.5c0-3 2.3-5 5-5s5 2 5 5c-1.5 1-3 1.4-5 1.4s-3.5-.4-5-1.4zM15.5 18.5c0-3 2.3-5 5-5s5 2 5 5c-1.5 1-3 1.4-5 1.4s-3.5-.4-5-1.4z" /><path d="M13 11c0-1.5 1.3-2.5 3-2.5s3 1 3 2.5-1.3 2-3 2-3-.5-3-2z" /></>,
  toast: <><path d="M7 26.5V13.5A5.5 5.5 0 0 1 9 5c2-1 4.5-1.5 7-1.5s5 .5 7 1.5a5.5 5.5 0 0 1 2 8.5v13z" /><path d="M11 16.5c0-3 2.3-5 5-5s5.5 2 5.5 5-2.5 5-5.5 5-5-2-5-5z" /><circle cx="16" cy="16.5" r="2.2" /></>,
  mash: <>{plate}<path d="M7 20.5c1-5 4.5-8.5 9-8.5s8 3.5 9 8.5" /><rect x="13.5" y="9" width="5" height="3.2" rx=".8" /></>,
  fried: <><circle cx="13" cy="17" r="9" /><path d="M21.3 13.2 28.5 8M9 14.5l3 1.5M12.5 19.5l3.5-1M14.5 13l2.5 2.5M8.5 19l1.5-2.5" /></>,
  drink: <><path d="M9 9h14l-2 17.5a1.5 1.5 0 0 1-1.5 1.3h-7a1.5 1.5 0 0 1-1.5-1.3z" /><path d="M9.7 15h12.6M18 13 21.5 3.5H25" /><circle cx="10" cy="8.5" r="3" /></>,
  dish: <><path d="M4 22.5h24M6 22.5a10 10 0 0 1 20 0M16 12.5v-2M14 10.5h4M3 26h26" /></>,
};

const KIND_RULES: [RegExp, DishKind][] = [
  [/суп|борщ|(^|[^а-яё])щи([^а-яё]|$)|солянк|(^|[^а-яё])ух[аеи]([^а-яё]|$)|бульон|окрошк|рассольник|харчо/i, 'soup'],
  [/салат|цезарь|винегрет|капрезе|оливье|мимоз/i, 'salad'],
  [/пицц/i, 'pizza'],
  [/пельмен|вареник|манты|хинкал/i, 'dumplings'],
  [/оладь|панкейк|блин|сырник|вафл|пончик|хачапур/i, 'pancakes'],
  [/гренк|тост|бутерброд|сэндвич|брускет|кесадиль|намазк/i, 'toast'],
  [/омлет|яичниц|шакшук|яйц|фриттат|менемен/i, 'eggs'],
  [/каш|овсян|гранол|мюсли/i, 'porridge'],
  [/паст|макарон|спагетти|лапш|феттучин/i, 'pasta'],
  [/треск|лосос|рыб|форел|с[её]мг|минта|скумбр|тунц|кревет|судак|горбуш|миди|кальмар|шпрот/i, 'fish'],
  [/котлет|тефтел|биточ|фрикадел|отбивн/i, 'cutlets'],
  [/куриц|курин|индейк|окорочк|цыпл|крылыш|чахохбили/i, 'chicken'],
  [/запеканк|запеч|лазань|гратен|пирог|киш|шарлотк|слойк|кекс|печен|печ[её]н|сло[её]н|в тесте|в духовке/i, 'baked'],
  [/пюре/i, 'mash'],
  [/картош|картофел|драник/i, 'fried'],
  [/плов|гречк|рис\b|ризотто|рагу|голубц|туш[её]н|жарк|гуляш|чечевиц|нут|перлов|булгур|чили|лобио|кускус|киноа|фахитас|бефстроганов|рулет|баклажан|капуст/i, 'pot'],
  [/смузи|коктейл|лимонад|морс|компот|мохито|\bчай\b|кофе|какао|фреш/i, 'drink'],
];

export function dishKind(recipe: Pick<Recipe, 'title' | 'tags' | 'ingredients'>): DishKind {
  if (recipe.tags.includes('напиток')) return 'drink';
  const title = recipe.title.toLowerCase();
  for (const [re, kind] of KIND_RULES) if (re.test(title)) return kind;
  const main = recipe.ingredients.find((i) => i.role === 'key' && getProduct(i.key));
  const category = getProduct(main?.key)?.category;
  if (category === 'fish') return 'fish';
  if (category === 'poultry') return 'chicken';
  if (category === 'meat') return 'pot';
  if (category === 'eggs') return 'eggs';
  return 'dish';
}

/** Картинка блюда: фото, если есть, иначе значок по типу блюда на фоне его цвета */
export function Plate({ recipe, big }: { recipe: Pick<Recipe, 'title' | 'tags' | 'ingredients' | 'color' | 'image'>; big?: boolean }) {
  return (
    <div className={`plate${big ? ' big' : ''}${recipe.image ? ' photo' : ''}`} style={{ ['--plate' as string]: recipe.color }}>
      {recipe.image
        ? <img src={recipe.image} alt="" loading="lazy" />
        : <svg viewBox="0 0 32 32" strokeWidth={big ? 1.4 : 1.7} {...stroke}>{DISH_GLYPHS[dishKind(recipe)]}</svg>}
    </div>
  );
}
